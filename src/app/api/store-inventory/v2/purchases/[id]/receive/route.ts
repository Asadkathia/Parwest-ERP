import { NextRequest } from "next/server"
import { Prisma, StoreInventoryMovementType, StoreInventoryPurchaseStatus } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { emitInventoryV2Audit, ensureStoreInScope, parseNonNegativeInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { parsePurchaseNotes, serializePurchaseNotes } from "@/lib/inventory/purchase-workflow-meta"

type Params = { params: Promise<{ id: string }> }

type ReceiveLineInput = {
  purchaseLineId: string
  receivedNewQty: number
  damagedQty: number
  reusableQty: number
  remarks: string | null
}

function normalizeLines(raw: unknown): ReceiveLineInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null

  const lines: ReceiveLineInput[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") return null
    const payload = row as Record<string, unknown>
    const purchaseLineId = String(payload.purchaseLineId ?? "").trim()
    const receivedNewQty = parseNonNegativeInt(payload.receivedNewQty)
    const damagedQty = parseNonNegativeInt(payload.damagedQty)
    const reusableQty = parseNonNegativeInt(payload.reusableQty)
    const remarks = String(payload.remarks ?? "").trim() || null
    if (!purchaseLineId || receivedNewQty == null || damagedQty == null || reusableQty == null) return null
    lines.push({ purchaseLineId, receivedNewQty, damagedQty, reusableQty, remarks })
  }

  return lines
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id } = await params

  try {
    const body = (await request.json()) as Record<string, unknown>
    const lines = normalizeLines(body.lines)
    if (!lines) return badRequest("Valid receiving lines are required.")

    const transportType = String(body.transportType ?? "").trim().toUpperCase()
    if (transportType !== "SELF" && transportType !== "COURIER") {
      return badRequest("transportType must be SELF or COURIER.")
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.storeInventoryPurchase.findUnique({
        where: { id },
        include: { lines: { include: { product: true } }, store: true },
      })
      if (!purchase) throw new Error("PURCHASE_NOT_FOUND")
      const denied = await ensureStoreInScope(purchase.storeId, session.scope, "Purchase not found.")
      if (denied) throw Object.assign(new Error("PURCHASE_OUT_OF_SCOPE"), { response: denied })
      if (purchase.status === StoreInventoryPurchaseStatus.CANCELLED) throw new Error("PURCHASE_REJECTED")

      const decoded = parsePurchaseNotes(purchase.notes)
      const priorReceiveEvents = decoded.workflow.history.filter((entry) => Array.isArray(entry.lines) && entry.lines.length > 0)

      const alreadyReceivedByLine = new Map<string, number>()
      for (const event of priorReceiveEvents) {
        for (const line of event.lines || []) {
          alreadyReceivedByLine.set(line.purchaseLineId, (alreadyReceivedByLine.get(line.purchaseLineId) || 0) + (line.newReceivedQty + line.okQty))
        }
      }

      for (const line of lines) {
        const purchaseLine = purchase.lines.find((row) => row.id === line.purchaseLineId)
        if (!purchaseLine) throw new Error(`LINE_NOT_FOUND:${line.purchaseLineId}`)
        const nextReceived = (alreadyReceivedByLine.get(line.purchaseLineId) || 0) + line.receivedNewQty + line.reusableQty
        if (nextReceived > purchaseLine.quantity) throw new Error(`RECEIVE_EXCEEDS_REQUESTED:${line.purchaseLineId}`)
      }

      for (const line of lines) {
        const purchaseLine = purchase.lines.find((row) => row.id === line.purchaseLineId)
        if (!purchaseLine) continue
        const acceptedQty = line.receivedNewQty + line.reusableQty
        if (acceptedQty <= 0) continue

        await tx.storeInventoryBalance.upsert({
          where: {
            storeId_productId: {
              storeId: purchase.storeId,
              productId: purchaseLine.productId,
            },
          },
          create: {
            storeId: purchase.storeId,
            productId: purchaseLine.productId,
            quantityOnHand: acceptedQty,
            quantityHeld: line.reusableQty,
          },
          update: {
            quantityOnHand: { increment: acceptedQty },
            quantityHeld: { increment: line.reusableQty },
          },
        })

        await tx.storeInventoryMovement.create({
          data: {
            movementType: StoreInventoryMovementType.PURCHASE,
            quantity: acceptedQty,
            storeId: purchase.storeId,
            productId: purchaseLine.productId,
            performedById: session.userId,
            referenceType: "PURCHASE_RECEIVE",
            referenceId: purchase.id,
            notes: `Purchase receiving for ${purchase.id}`,
          },
        })
      }

      const receivedNowTotal = lines.reduce((sum, row) => sum + row.receivedNewQty + row.reusableQty, 0)
      const requestedTotal = purchase.lines.reduce((sum, row) => sum + row.quantity, 0)
      const historicalReceivedTotal = Array.from(alreadyReceivedByLine.values()).reduce((sum, value) => sum + value, 0)
      const newTotalReceived = historicalReceivedTotal + receivedNowTotal

      const nextStatus =
        requestedTotal > 0 && newTotalReceived >= requestedTotal
          ? StoreInventoryPurchaseStatus.RECEIVED
          : StoreInventoryPurchaseStatus.DRAFT

      decoded.workflow.transport = {
        transportType: transportType as "SELF" | "COURIER",
        driverName: String(body.driverName ?? "").trim() || null,
        driverPhone: String(body.driverPhone ?? "").trim() || null,
        vehicleNumber: String(body.vehicleNumber ?? "").trim() || null,
        courierCompany: String(body.courierCompany ?? "").trim() || null,
        courierTrackingId: String(body.courierTrackingId ?? "").trim() || null,
        courierBy: String(body.courierBy ?? "").trim() || null,
        courierDate: String(body.courierDate ?? "").trim() || null,
      }

      decoded.workflow.history.push({
        status: nextStatus === StoreInventoryPurchaseStatus.RECEIVED ? "RECEIVED" : "PENDING",
        changedByUserId: session.userId,
        changedByName: null,
        changedAt: new Date().toISOString(),
        remarks:
          nextStatus === StoreInventoryPurchaseStatus.RECEIVED
            ? `Received ${receivedNowTotal} items out of ${requestedTotal} total ordered items. Purchase fully received and confirmed.`
            : `Received ${receivedNowTotal} items out of ${requestedTotal} total ordered items. Purchase partially received. Remaining quantity to fulfill: ${Math.max(0, requestedTotal - newTotalReceived)}.`,
        lines: lines.map((line) => {
          const purchaseLine = purchase.lines.find((row) => row.id === line.purchaseLineId)!
          return {
            purchaseLineId: line.purchaseLineId,
            productId: purchaseLine.productId,
            productName: `${purchaseLine.product.name} (${purchaseLine.product.sku})`,
            variant: null,
            requestedQty: purchaseLine.quantity,
            newReceivedQty: line.receivedNewQty,
            damagedQty: line.damagedQty,
            okQty: line.receivedNewQty,
            reusableQty: line.reusableQty,
            remarks: line.remarks,
          }
        }),
      })

      const updated = await tx.storeInventoryPurchase.update({
        where: { id },
        data: {
          status: nextStatus,
          receivedAt: nextStatus === StoreInventoryPurchaseStatus.RECEIVED ? new Date() : purchase.receivedAt,
          notes: serializePurchaseNotes(decoded),
        },
        include: {
          store: true,
          vendor: true,
          createdBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          lines: { include: { product: true } },
        },
      })

      return updated
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "PURCHASE_RECEIVED",
      description: `Processed regular receiving for purchase ${id}`,
      request,
    })

    const decoded = parsePurchaseNotes(result.notes)
    return ok({
      ...result,
      notes: decoded.note,
      purchaseOrder: decoded.purchaseOrder,
      workflow: decoded.workflow,
    })
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Purchase not found.")
    if (code === "P2003") return badRequest("Invalid reference in receiving payload.")
    if (error instanceof Error && error.message === "PURCHASE_NOT_FOUND") return notFound("Purchase not found.")
    if (error instanceof Error && error.message === "PURCHASE_OUT_OF_SCOPE") {
      const response = (error as Error & { response?: Response }).response
      if (response) return response
    }
    if (error instanceof Error && error.message === "PURCHASE_REJECTED") return badRequest("Rejected purchase cannot be received.")
    if (error instanceof Error && error.message.startsWith("LINE_NOT_FOUND:")) return badRequest("One or more receiving lines are invalid.")
    if (error instanceof Error && error.message.startsWith("RECEIVE_EXCEEDS_REQUESTED:")) return badRequest("Receiving quantity exceeds requested quantity.")
    console.error(`store-inventory v2 purchases receive PATCH (${id}) failed`, error)
    return internalServerError("Failed to process purchase receiving.")
  }
}
