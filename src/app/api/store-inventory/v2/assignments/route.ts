import { NextRequest } from "next/server"
import { Prisma, StoreInventoryAssignmentStatus, StoreInventoryMovementType } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, parsePositiveInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

const assignmentInclude = {
  store: true,
  product: true,
  assignedToUser: { select: { id: true, name: true, email: true } },
  assignedByUser: { select: { id: true, name: true, email: true } },
  returnedByUser: { select: { id: true, name: true, email: true } },
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
    const productId = String(body.productId ?? "").trim()
    const assignedToUserId = String(body.assignedToUserId ?? "").trim()
    const quantity = parsePositiveInt(body.quantity)

    if (!storeId || !productId || !assignedToUserId || quantity == null) {
      return badRequest("storeId, productId, assignedToUserId, and positive quantity are required.")
    }

    const created = await prisma.$transaction(async (tx) => {
      const balance = await tx.storeInventoryBalance.findUnique({
        where: {
          storeId_productId: {
            storeId,
            productId,
          },
        },
      })

      const onHand = balance?.quantityOnHand ?? 0
      if (onHand < quantity) {
        throw new Error("INSUFFICIENT_STOCK")
      }

      await tx.storeInventoryBalance.upsert({
        where: {
          storeId_productId: {
            storeId,
            productId,
          },
        },
        create: {
          storeId,
          productId,
          quantityOnHand: 0,
          quantityIssued: quantity,
        },
        update: {
          quantityOnHand: { decrement: quantity },
          quantityIssued: { increment: quantity },
        },
      })

      const createdAssignment = await tx.storeInventoryAssignment.create({
        data: {
          storeId,
          productId,
          assignedToUserId,
          assignedByUserId: session.userId,
          quantity,
          status: StoreInventoryAssignmentStatus.ASSIGNED,
          expectedReturnAt: body.expectedReturnAt ? new Date(String(body.expectedReturnAt)) : null,
          notes: asText(body.notes),
        },
        include: assignmentInclude,
      })

      await tx.storeInventoryMovement.create({
        data: {
          movementType: StoreInventoryMovementType.ASSIGNMENT_OUT,
          quantity,
          storeId,
          productId,
          performedById: session.userId,
          referenceType: "ASSIGNMENT",
          referenceId: createdAssignment.id,
          notes: `Assignment checkout to user ${assignedToUserId}`,
        },
      })

      return createdAssignment
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "ASSIGNMENT_CREATED",
      description: `Created assignment ${created.id} for user ${created.assignedToUserId}`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2003") return badRequest("Invalid store/product/user reference.")
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return badRequest("Insufficient stock available for assignment.")
    }

    console.error("store-inventory v2 assignments POST failed", error)
    return internalServerError("Failed to create assignment.")
  }
}
