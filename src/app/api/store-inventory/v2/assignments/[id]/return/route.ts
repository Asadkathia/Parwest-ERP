import { NextRequest } from "next/server"
import { Prisma, StoreInventoryAssignmentStatus, StoreInventoryMovementType } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, ensureStoreInScope, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { applyStockMovement } from "@/lib/inventory/stock-movement"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id } = await params

  try {
    const body = (await request.json()) as Record<string, unknown>
    const nextStatusRaw = String(body.status ?? "RETURNED").trim().toUpperCase()
    const nextStatus =
      nextStatusRaw === "DAMAGED"
        ? StoreInventoryAssignmentStatus.DAMAGED
        : nextStatusRaw === "LOST"
          ? StoreInventoryAssignmentStatus.LOST
          : StoreInventoryAssignmentStatus.RETURNED

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.storeInventoryAssignment.findUnique({ where: { id } })
      if (!current) throw new Error("ASSIGNMENT_NOT_FOUND")
      const denied = await ensureStoreInScope(current.storeId, session.scope, "Assignment not found.")
      if (denied) throw Object.assign(new Error("ASSIGNMENT_OUT_OF_SCOPE"), { response: denied })
      if (current.status !== StoreInventoryAssignmentStatus.ASSIGNED) {
        throw new Error("ASSIGNMENT_NOT_OPEN")
      }

      const returnConditionId = asText(body.returnConditionId) ?? null
      const returned = await tx.storeInventoryAssignment.update({
        where: { id },
        data: {
          status: nextStatus,
          returnedAt: new Date(),
          returnedByUserId: session.userId,
          returnConditionId: returnConditionId || null,
          notes: asText(body.notes) ?? current.notes,
        },
        include: {
          store: true,
          product: true,
          condition: true,
          returnCondition: true,
          assignedToGuard: { select: { id: true, name: true, parwestId: true, cnic: true } },
          assignedToClient: { select: { id: true, name: true, type: true } },
          assignedToUser: { select: { id: true, name: true, email: true } },
          assignedByUser: { select: { id: true, name: true, email: true } },
          returnedByUser: { select: { id: true, name: true, email: true } },
        },
      })

      if (nextStatus === StoreInventoryAssignmentStatus.RETURNED) {
        await applyStockMovement(tx, {
          storeId: current.storeId,
          productId: current.productId,
          onHandDelta: current.quantity,
          issuedDelta: -current.quantity,
        })

        await tx.storeInventoryMovement.create({
          data: {
            movementType: StoreInventoryMovementType.ASSIGNMENT_RETURN,
            quantity: current.quantity,
            storeId: current.storeId,
            productId: current.productId,
            performedById: session.userId,
            referenceType: "ASSIGNMENT_RETURN",
            referenceId: current.id,
            notes:
              current.assignedToType === "GUARD"
                ? `Assignment return from guard ${current.assignedToGuardId}`
                : current.assignedToType === "CLIENT"
                  ? `Assignment return from client ${current.assignedToClientId}`
                  : `Assignment return from employee ${current.assignedToUserId}`,
          },
        })
      }

      return returned
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "ASSIGNMENT_RETURNED",
      description: `Closed assignment ${id} with status ${result.status}`,
      request,
    })

    return ok(result)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2003") return badRequest("Invalid related reference during return.")

    if (error instanceof Error && error.message === "ASSIGNMENT_NOT_FOUND") {
      return notFound("Assignment not found.")
    }

    if (error instanceof Error && error.message === "ASSIGNMENT_OUT_OF_SCOPE") {
      const response = (error as Error & { response?: Response }).response
      if (response) return response
    }

    if (error instanceof Error && error.message === "ASSIGNMENT_NOT_OPEN") {
      return badRequest("Only ASSIGNED records can be returned/closed.")
    }

    console.error(`store-inventory v2 assignments return POST (${id}) failed`, error)
    return internalServerError("Failed to process assignment return.")
  }
}
