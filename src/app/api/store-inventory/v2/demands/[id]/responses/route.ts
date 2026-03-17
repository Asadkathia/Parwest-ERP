import { NextRequest } from "next/server"
import { Prisma, StoreInventoryDemandResponseStatus, StoreInventoryDemandStatus, StoreInventoryMovementType } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, parsePositiveInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

type Params = { params: Promise<{ id: string }> }

type ResponseLineInput = {
  demandLineId: string
  productId: string
  quantity: number
  notes: string | null
}

function normalizeStatus(raw: unknown): StoreInventoryDemandResponseStatus {
  const value = String(raw ?? "APPROVED").trim().toUpperCase()
  if (value === "PENDING") return StoreInventoryDemandResponseStatus.PENDING
  if (value === "REJECTED") return StoreInventoryDemandResponseStatus.REJECTED
  if (value === "FULFILLED") return StoreInventoryDemandResponseStatus.FULFILLED
  return StoreInventoryDemandResponseStatus.APPROVED
}

function normalizeLines(input: unknown): ResponseLineInput[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const lines: ResponseLineInput[] = []

  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null
    const row = raw as Record<string, unknown>
    const demandLineId = String(row.demandLineId ?? "").trim()
    const productId = String(row.productId ?? "").trim()
    const quantity = parsePositiveInt(row.quantity)
    if (!demandLineId || !productId || quantity == null) return null

    lines.push({
      demandLineId,
      productId,
      quantity,
      notes: asText(row.notes),
    })
  }

  return lines
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id: demandId } = await params

  try {
    const body = (await request.json()) as Record<string, unknown>
    const responderStoreId = String(body.responderStoreId ?? "").trim()
    const lines = normalizeLines(body.lines)
    const status = normalizeStatus(body.status)

    if (!responderStoreId || !lines) {
      return badRequest("responderStoreId and non-empty lines are required.")
    }

    const result = await prisma.$transaction(async (tx) => {
      const demand = await tx.storeInventoryDemand.findUnique({
        where: { id: demandId },
      })
      if (!demand) throw new Error("DEMAND_NOT_FOUND")

      const createdResponse = await tx.storeInventoryDemandResponse.create({
        data: {
          demandId,
          responderStoreId,
          responderId: session.userId,
          status,
          notes: asText(body.notes),
          lines: {
            create: lines.map((line) => ({
              demandLineId: line.demandLineId,
              productId: line.productId,
              quantity: line.quantity,
              notes: line.notes,
            })),
          },
        },
        include: {
          lines: true,
        },
      })

      if (status === StoreInventoryDemandResponseStatus.APPROVED || status === StoreInventoryDemandResponseStatus.FULFILLED) {
        for (const line of lines) {
          const balance = await tx.storeInventoryBalance.findUnique({
            where: {
              storeId_productId: {
                storeId: responderStoreId,
                productId: line.productId,
              },
            },
          })

          const onHand = balance?.quantityOnHand ?? 0
          if (onHand < line.quantity) {
            throw new Error(`INSUFFICIENT_STOCK:${line.productId}`)
          }

          await tx.storeInventoryBalance.update({
            where: {
              storeId_productId: {
                storeId: responderStoreId,
                productId: line.productId,
              },
            },
            data: {
              quantityOnHand: { decrement: line.quantity },
            },
          })

          await tx.storeInventoryMovement.create({
            data: {
              movementType: StoreInventoryMovementType.DEMAND_OUT,
              quantity: line.quantity,
              storeId: responderStoreId,
              productId: line.productId,
              performedById: session.userId,
              referenceType: "DEMAND_RESPONSE",
              referenceId: createdResponse.id,
              notes: `Demand response for ${demandId}`,
            },
          })

          const demandLine = await tx.storeInventoryDemandLine.findUnique({ where: { id: line.demandLineId } })
          if (demandLine) {
            await tx.storeInventoryDemandLine.update({
              where: { id: line.demandLineId },
              data: {
                fulfilledQty: { increment: line.quantity },
              },
            })
          }
        }
      }

      const refreshedLines = await tx.storeInventoryDemandLine.findMany({ where: { demandId } })
      const totalRequested = refreshedLines.reduce((sum, line) => sum + line.requestedQty, 0)
      const totalFulfilled = refreshedLines.reduce((sum, line) => sum + line.fulfilledQty, 0)

      let nextDemandStatus = demand.status
      if (totalFulfilled >= totalRequested && totalRequested > 0) {
        nextDemandStatus = StoreInventoryDemandStatus.FULFILLED
      } else if (totalFulfilled > 0) {
        nextDemandStatus = StoreInventoryDemandStatus.PARTIALLY_FULFILLED
      }

      const updatedDemand = await tx.storeInventoryDemand.update({
        where: { id: demandId },
        data: {
          status: nextDemandStatus,
          fulfilledAt: nextDemandStatus === StoreInventoryDemandStatus.FULFILLED ? new Date() : null,
        },
        include: {
          lines: true,
          responses: { include: { lines: true } },
        },
      })

      return { createdResponse, updatedDemand }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "DEMAND_RESPONSE_CREATED",
      description: `Created demand response ${result.createdResponse.id} for demand ${demandId}`,
      request,
    })

    return ok(result, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Demand or line not found.")
    if (code === "P2003") return badRequest("Invalid demand/store/user/product reference.")

    if (error instanceof Error && error.message === "DEMAND_NOT_FOUND") {
      return notFound("Demand not found.")
    }

    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      const productId = error.message.split(":")[1] ?? "unknown"
      return badRequest(`Insufficient stock for product ${productId}.`)
    }

    console.error(`store-inventory v2 demand response POST (${demandId}) failed`, error)
    return internalServerError("Failed to create demand response.")
  }
}
