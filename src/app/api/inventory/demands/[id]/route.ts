import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, serviceUnavailable, unauthorized } from "@/lib/api/response"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import {
  canTransitionInventoryDemandStatus,
  getInventoryDemandStatuses,
  type InventoryDemandStatus,
  isTerminalInventoryDemandStatus,
  normalizeInventoryDemandStatus,
} from "@/lib/inventory/demand-status"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await context.params
    const body = await request.json()
    const data: {
      quantity?: number
      categoryId?: string | null
      regionalOfficeId?: string | null
      reason?: string | null
      status?: InventoryDemandStatus
      requiredBy?: Date | null
    } = {}

    if (body.quantity != null) {
      const quantity = Number(body.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return badRequest("quantity must be a positive number.")
      }
      data.quantity = quantity
    }
    if (body.categoryId !== undefined) data.categoryId = body.categoryId ? String(body.categoryId) : null
    if (body.regionalOfficeId !== undefined) data.regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId) : null
    if (body.reason !== undefined) data.reason = body.reason ? String(body.reason) : null
    if (body.status !== undefined) {
      const nextStatus = normalizeInventoryDemandStatus(body.status)
      if (!nextStatus) {
        return badRequest(`Invalid demand status. Allowed values: ${getInventoryDemandStatuses().join(", ")}.`)
      }
      data.status = nextStatus
    }
    if (body.requiredBy !== undefined) {
      if (!body.requiredBy) {
        data.requiredBy = null
      } else {
        const requiredBy = new Date(String(body.requiredBy))
        if (Number.isNaN(requiredBy.getTime())) return badRequest("Invalid requiredBy date.")
        data.requiredBy = requiredBy
      }
    }
    if (Object.keys(data).length === 0) return badRequest("No fields provided.")

    if (isRuntimeMockEnabled()) return NextResponse.json({ id, ...data })

    const existing = await prisma.inventoryDemand.findUnique({
      where: { id },
      select: {
        id: true,
        quantity: true,
        categoryId: true,
        regionalOfficeId: true,
        status: true,
      },
    })
    if (!existing) return notFound("Demand not found.")

    const currentStatus = normalizeInventoryDemandStatus(existing.status)
    if (!currentStatus) {
      return internalServerError("Demand has unsupported status in database.")
    }

    const transitionStatus = data.status
    if (
      isWorkflowRuleEnabled("inventoryDemand.enforceTransitionMap") &&
      transitionStatus &&
      !canTransitionInventoryDemandStatus(currentStatus, transitionStatus)
    ) {
      return conflict(`Cannot transition demand status from ${currentStatus} to ${transitionStatus}.`)
    }

    const mutatesCoreFields =
      data.quantity !== undefined ||
      data.categoryId !== undefined ||
      data.regionalOfficeId !== undefined ||
      data.requiredBy !== undefined
    if (
      isWorkflowRuleEnabled("inventoryDemand.blockCoreEditsAfterTerminal") &&
      isTerminalInventoryDemandStatus(currentStatus) &&
      mutatesCoreFields
    ) {
      return conflict(`Cannot modify demand fields after ${currentStatus}.`)
    }

    if (transitionStatus === "FULFILLED" && isWorkflowRuleEnabled("inventoryDemand.requireSufficientStockForFulfillment")) {
      const effectiveCategoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId
      const effectiveRegionalOfficeId = data.regionalOfficeId !== undefined ? data.regionalOfficeId : existing.regionalOfficeId
      const effectiveQuantity = data.quantity !== undefined ? data.quantity : existing.quantity

      if (!effectiveCategoryId) {
        return badRequest("Demand must have categoryId before being fulfilled.")
      }
      const availableStock = await prisma.inventoryItem.count({
        where: {
          categoryId: effectiveCategoryId,
          status: "AVAILABLE",
          regionalOfficeId: effectiveRegionalOfficeId ?? undefined,
        },
      })
      if (availableStock < effectiveQuantity) {
        return conflict(
          `Insufficient available stock to fulfill demand. Required ${effectiveQuantity}, available ${availableStock}.`
        )
      }
    }

    const updated = await prisma.inventoryDemand.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for inventory demand yet.")
    if (getPrismaCode(error) === "P2025") return notFound("Demand not found.")
    if (getPrismaCode(error) === "P2003") return badRequest("Invalid category or regional office.")
    console.error("Error updating inventory demand:", error)
    return internalServerError("Failed to update demand.")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await context.params

    if (isRuntimeMockEnabled()) return NextResponse.json({ success: true, id })

    await prisma.inventoryDemand.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for inventory demand yet.")
    if (getPrismaCode(error) === "P2025") return notFound("Demand not found.")
    console.error("Error deleting inventory demand:", error)
    return internalServerError("Failed to delete demand.")
  }
}
