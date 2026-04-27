import { NextRequest } from "next/server"
import { Prisma, StoreInventoryDemandResponseStatus, StoreInventoryDemandStatus, StoreInventoryMovementType } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, parseNonNegativeInt, emitInventoryV2Audit, ensureStoreInScope, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { parseDemandResponseMeta, serializeDemandResponseMeta } from "@/lib/inventory/demand-response-meta"

type Params = { params: Promise<{ id: string; responseId: string }> }

type ReceiveLineInput = {
  demandLineId: string
  productId: string
  receivedNewQty: number
  receivedReusableQty: number
  remarks: string | null
}

function normalizeLines(raw: unknown): ReceiveLineInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null

  const lines: ReceiveLineInput[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") return null
    const payload = row as Record<string, unknown>
    const demandLineId = String(payload.demandLineId ?? "").trim()
    const productId = String(payload.productId ?? "").trim()
    const receivedNewQty = parseNonNegativeInt(payload.receivedNewQty)
    const receivedReusableQty = parseNonNegativeInt(payload.receivedReusableQty)

    if (!demandLineId || !productId) return null
    if (receivedNewQty == null || receivedReusableQty == null) return null

    lines.push({
      demandLineId,
      productId,
      receivedNewQty,
      receivedReusableQty,
      remarks: asText(payload.remarks),
    })
  }

  return lines
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id: demandId, responseId } = await params

  try {
    const body = (await request.json()) as Record<string, unknown>
    const lines = normalizeLines(body.lines)
    const receiveRemarks = asText(body.receiveRemarks ?? body.remarks)

    if (!lines) {
      return badRequest("lines are required for receive confirmation.")
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const demand = await tx.storeInventoryDemand.findUnique({
          where: { id: demandId },
          include: { lines: true },
        })
        if (!demand) throw new Error("DEMAND_NOT_FOUND")

        if (!demand.fromStoreId) {
          throw new Error("DEMAND_FROM_STORE_MISSING")
        }

        // Receiving deposits stock into demand.fromStore — gate on scope over
        // that store (the receiving site).
        const denied = await ensureStoreInScope(demand.fromStoreId, session.scope, "Demand not found.")
        if (denied) throw Object.assign(new Error("RECEIVE_OUT_OF_SCOPE"), { response: denied })

        const response = await tx.storeInventoryDemandResponse.findFirst({
          where: { id: responseId, demandId },
          include: { lines: true },
        })
        if (!response) throw new Error("RESPONSE_NOT_FOUND")

        const meta = parseDemandResponseMeta(response.notes)
        if (!meta.transport) throw new Error("TRANSPORT_REQUIRED")
        if (meta.receive?.receivedAt) throw new Error("ALREADY_RECEIVED")

        const allocationByLineId = new Map(
          meta.allocations.map((line) => [
            line.demandLineId,
            {
              productId: line.productId,
              allowedNew: line.fulfilledNewQty,
              allowedReusable: line.fulfilledReusableQty,
            },
          ])
        )

        for (const line of lines) {
          const allocation = allocationByLineId.get(line.demandLineId)
          if (!allocation) {
            throw new Error(`LINE_NOT_ALLOCATED:${line.demandLineId}`)
          }
          if (allocation.productId !== line.productId) {
            throw new Error(`PRODUCT_MISMATCH:${line.demandLineId}`)
          }
          if (line.receivedNewQty > allocation.allowedNew || line.receivedReusableQty > allocation.allowedReusable) {
            throw new Error(`RECEIVED_EXCEEDS_ALLOCATED:${line.demandLineId}`)
          }
        }

        for (const line of lines) {
          const receivedTotal = line.receivedNewQty + line.receivedReusableQty
          if (receivedTotal <= 0) continue

          await tx.storeInventoryBalance.upsert({
            where: {
              storeId_productId: {
                storeId: demand.fromStoreId,
                productId: line.productId,
              },
            },
            create: {
              storeId: demand.fromStoreId,
              productId: line.productId,
              quantityOnHand: receivedTotal,
              quantityHeld: line.receivedReusableQty,
              quantityIssued: 0,
            },
            update: {
              quantityOnHand: { increment: receivedTotal },
              quantityHeld: { increment: line.receivedReusableQty },
            },
          })

          await tx.storeInventoryMovement.create({
            data: {
              movementType: StoreInventoryMovementType.DEMAND_IN,
              quantity: receivedTotal,
              storeId: demand.fromStoreId,
              productId: line.productId,
              performedById: session.userId,
              referenceType: "DEMAND_RECEIVE",
              referenceId: response.id,
              notes: `Demand receive for ${demandId}`,
            },
          })
        }

        const updatedMeta = {
          ...meta,
          receive: {
            receivedAt: new Date().toISOString(),
            receivedByUserId: session.userId,
            remarks: receiveRemarks,
            lines,
          },
        }

        const allocationTotal = meta.allocations.reduce(
          (sum, line) => sum + line.fulfilledNewQty + line.fulfilledReusableQty,
          0
        )
        const receivedTotal = lines.reduce((sum, line) => sum + line.receivedNewQty + line.receivedReusableQty, 0)

        const updatedResponse = await tx.storeInventoryDemandResponse.update({
          where: { id: response.id },
          data: {
            status:
              allocationTotal > 0 && receivedTotal >= allocationTotal
                ? StoreInventoryDemandResponseStatus.FULFILLED
                : StoreInventoryDemandResponseStatus.APPROVED,
            notes: serializeDemandResponseMeta(updatedMeta),
          },
          include: {
            lines: true,
            responderStore: true,
            responder: { select: { id: true, name: true, email: true } },
          },
        })

        const refreshedDemandLines = await tx.storeInventoryDemandLine.findMany({
          where: { demandId },
        })

        const totalRequested = refreshedDemandLines.reduce((sum, line) => sum + line.requestedQty, 0)
        const totalFulfilled = refreshedDemandLines.reduce((sum, line) => sum + line.fulfilledQty, 0)

        const nextDemandStatus =
          totalRequested > 0 && totalFulfilled >= totalRequested
            ? StoreInventoryDemandStatus.FULFILLED
            : StoreInventoryDemandStatus.PARTIALLY_FULFILLED

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

        return { updatedResponse, updatedDemand }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    )

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "DEMAND_RESPONSE_RECEIVED",
      description: `Confirmed receive for demand response ${responseId}`,
      request,
    })

    return ok(result)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Demand response not found.")
    if (code === "P2003") return badRequest("Invalid demand/store/line reference.")

    if (error instanceof Error) {
      if (error.message === "DEMAND_NOT_FOUND") return notFound("Demand not found.")
      if (error.message === "RECEIVE_OUT_OF_SCOPE") {
        const response = (error as Error & { response?: Response }).response
        if (response) return response
      }
      if (error.message === "RESPONSE_NOT_FOUND") return notFound("Demand response not found.")
      if (error.message === "DEMAND_FROM_STORE_MISSING") {
        return badRequest("Demand from-store is missing.")
      }
      if (error.message === "TRANSPORT_REQUIRED") {
        return badRequest("Add transport details before confirming receive.")
      }
      if (error.message === "ALREADY_RECEIVED") {
        return badRequest("This response is already marked as received.")
      }
      if (error.message.startsWith("LINE_NOT_ALLOCATED:")) {
        return badRequest("Received line is not part of allocated response.")
      }
      if (error.message.startsWith("PRODUCT_MISMATCH:")) {
        return badRequest("Product mismatch in received lines.")
      }
      if (error.message.startsWith("RECEIVED_EXCEEDS_ALLOCATED:")) {
        return badRequest("Received quantity cannot exceed allocated quantity.")
      }
    }

    console.error(`store-inventory v2 demand response receive PATCH (${responseId}) failed`, error)
    return internalServerError("Failed to confirm demand receive.")
  }
}
