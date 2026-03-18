import { NextRequest } from "next/server"
import { Prisma, StoreInventoryAssignmentStatus, StoreInventoryMovementType } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, parsePositiveInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

const assignmentInclude = {
  store: true,
  product: true,
  condition: true,
  assignedToUser: { select: { id: true, name: true, email: true } },
  assignedByUser: { select: { id: true, name: true, email: true } },
  returnedByUser: { select: { id: true, name: true, email: true } },
}

type AssignmentLineInput = {
  productId: string
  quantity: number
  conditionId: string | null
  notes: string | null
}

function normalizeLines(body: Record<string, unknown>): AssignmentLineInput[] | null {
  if (Array.isArray(body.lines) && body.lines.length > 0) {
    const lines: AssignmentLineInput[] = []
    for (const raw of body.lines) {
      if (!raw || typeof raw !== "object") return null
      const row = raw as Record<string, unknown>
      const productId = String(row.productId ?? "").trim()
      const quantity = parsePositiveInt(row.quantity)
      if (!productId || quantity == null) return null
      lines.push({
        productId,
        quantity,
        conditionId: asText(row.conditionId),
        notes: asText(row.notes),
      })
    }
    return lines
  }

  const productId = String(body.productId ?? "").trim()
  const quantity = parsePositiveInt(body.quantity)
  if (!productId || quantity == null) return null
  return [
    {
      productId,
      quantity,
      conditionId: asText(body.conditionId),
      notes: asText(body.notes),
    },
  ]
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")?.trim() || undefined
  const assignedToUserId = searchParams.get("assignedToUserId")?.trim() || undefined
  const storeId = searchParams.get("storeId")?.trim() || undefined

  try {
    const rows = await prisma.storeInventoryAssignment.findMany({
      where: {
        status: status ? (status as StoreInventoryAssignmentStatus) : undefined,
        assignedToUserId,
        storeId,
      },
      include: assignmentInclude,
      orderBy: { assignedAt: "desc" },
      take: 500,
    })

    return ok(rows)
  } catch (error) {
    console.error("store-inventory v2 assignments GET failed", error)
    return internalServerError("Failed to fetch assignments.")
  }
}

export async function POST(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  try {
    const body = (await request.json()) as Record<string, unknown>
    const storeId = String(body.storeId ?? "").trim()
    const assignedToUserId = String(body.assignedToUserId ?? "").trim()
    const lines = normalizeLines(body)

    if (!storeId || !assignedToUserId || !lines) {
      return badRequest("storeId, assignedToUserId, and non-empty assignment lines are required.")
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdAssignments: Array<Record<string, unknown>> = []

      for (const line of lines) {
        const balance = await tx.storeInventoryBalance.findUnique({
          where: {
            storeId_productId: {
              storeId,
              productId: line.productId,
            },
          },
        })

        const onHand = balance?.quantityOnHand ?? 0
        if (onHand < line.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${line.productId}`)
        }

        await tx.storeInventoryBalance.upsert({
          where: {
            storeId_productId: {
              storeId,
              productId: line.productId,
            },
          },
          create: {
            storeId,
            productId: line.productId,
            quantityOnHand: 0,
            quantityIssued: line.quantity,
          },
          update: {
            quantityOnHand: { decrement: line.quantity },
            quantityIssued: { increment: line.quantity },
          },
        })

        const assignmentData: Prisma.StoreInventoryAssignmentUncheckedCreateInput = {
            storeId,
            productId: line.productId,
            conditionId: line.conditionId,
            assignedToUserId,
            assignedByUserId: session.userId,
            quantity: line.quantity,
            status: StoreInventoryAssignmentStatus.ASSIGNED,
            expectedReturnAt: body.expectedReturnAt ? new Date(String(body.expectedReturnAt)) : null,
            notes: line.notes ?? asText(body.notes),
        }

        const createdAssignment = await tx.storeInventoryAssignment.create({
          data: assignmentData,
          include: assignmentInclude,
        })

        await tx.storeInventoryMovement.create({
          data: {
            movementType: StoreInventoryMovementType.ASSIGNMENT_OUT,
            quantity: line.quantity,
            storeId,
            productId: line.productId,
            performedById: session.userId,
            referenceType: "ASSIGNMENT",
            referenceId: createdAssignment.id,
            notes: `Assignment checkout to user ${assignedToUserId}`,
          },
        })

        createdAssignments.push(createdAssignment as unknown as Record<string, unknown>)
      }

      return createdAssignments
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "ASSIGNMENT_CREATED",
      description: `Created ${created.length} assignment line(s) for user ${assignedToUserId}`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2003") return badRequest("Invalid store/product/condition/user reference.")
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK")) {
      return badRequest("Insufficient stock available for one or more assignment lines.")
    }

    console.error("store-inventory v2 assignments POST failed", error)
    return internalServerError("Failed to create assignment.")
  }
}
