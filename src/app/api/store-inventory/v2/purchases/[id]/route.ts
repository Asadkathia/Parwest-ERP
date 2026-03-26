import { NextRequest } from "next/server"
import { StoreInventoryPurchaseStatus } from "@prisma/client"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { emitInventoryV2Audit, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { parsePurchaseNotes, serializePurchaseNotes } from "@/lib/inventory/purchase-workflow-meta"

const purchaseInclude = {
  store: true,
  vendor: true,
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: true,
    },
  },
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { id } = await params

  try {
    const row = await prisma.storeInventoryPurchase.findUnique({
      where: { id },
      include: purchaseInclude,
    })
    if (!row) return notFound("Purchase not found.")

    const decoded = parsePurchaseNotes(row.notes)
    return ok({
      ...row,
      notes: decoded.note,
      purchaseOrder: decoded.purchaseOrder,
      workflow: decoded.workflow,
    })
  } catch (error) {
    console.error(`store-inventory v2 purchases GET (${id}) failed`, error)
    return internalServerError("Failed to fetch purchase.")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id } = await params

  try {
    const body = (await request.json()) as Record<string, unknown>
    const nextStatusRaw = String(body.status ?? "").trim().toUpperCase()
    if (nextStatusRaw !== "CANCELLED") return badRequest("Only CANCELLED transition is supported on this endpoint.")

    const current = await prisma.storeInventoryPurchase.findUnique({ where: { id } })
    if (!current) return notFound("Purchase not found.")
    if (current.status === StoreInventoryPurchaseStatus.RECEIVED) {
      return badRequest("Received purchase cannot be rejected.")
    }

    const decoded = parsePurchaseNotes(current.notes)
    decoded.workflow.history.push({
      status: "CANCELLED",
      changedByUserId: session.userId,
      changedAt: new Date().toISOString(),
      remarks: String(body.reason ?? body.remarks ?? "Purchase rejected"),
    })

    const updated = await prisma.storeInventoryPurchase.update({
      where: { id },
      data: {
        status: StoreInventoryPurchaseStatus.CANCELLED,
        notes: serializePurchaseNotes(decoded),
      },
      include: purchaseInclude,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "PURCHASE_REJECTED",
      description: `Rejected purchase ${id}`,
      request,
    })

    const updatedDecoded = parsePurchaseNotes(updated.notes)
    return ok({
      ...updated,
      notes: updatedDecoded.note,
      purchaseOrder: updatedDecoded.purchaseOrder,
      workflow: updatedDecoded.workflow,
    })
  } catch (error) {
    console.error(`store-inventory v2 purchases PATCH (${id}) failed`, error)
    return internalServerError("Failed to update purchase.")
  }
}
