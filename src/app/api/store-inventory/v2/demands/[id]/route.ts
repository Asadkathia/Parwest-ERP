import { NextRequest } from "next/server"
import { StoreInventoryDemandStatus } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, ensureStoreInScope, parseNonNegativeInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

const demandInclude = {
  fromStore: true,
  toStore: true,
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      product: true,
    },
  },
  responses: {
    include: {
      responderStore: true,
      responder: { select: { id: true, name: true, email: true } },
      lines: true,
    },
  },
}

const allowedTransitions: Record<StoreInventoryDemandStatus, StoreInventoryDemandStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"],
  REJECTED: [],
  PARTIALLY_FULFILLED: ["FULFILLED", "CANCELLED"],
  FULFILLED: [],
  CANCELLED: [],
}

type Params = { params: Promise<{ id: string }> }

function normalizeStatus(raw: unknown): StoreInventoryDemandStatus | null {
  const value = String(raw ?? "").trim().toUpperCase()
  if (value === "DRAFT") return StoreInventoryDemandStatus.DRAFT
  if (value === "SENT") return StoreInventoryDemandStatus.SENT
  if (value === "APPROVED") return StoreInventoryDemandStatus.APPROVED
  if (value === "REJECTED") return StoreInventoryDemandStatus.REJECTED
  if (value === "PARTIALLY_FULFILLED") return StoreInventoryDemandStatus.PARTIALLY_FULFILLED
  if (value === "FULFILLED") return StoreInventoryDemandStatus.FULFILLED
  if (value === "CANCELLED") return StoreInventoryDemandStatus.CANCELLED
  return null
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { id } = await params

  try {
    const row = await prisma.storeInventoryDemand.findUnique({
      where: { id },
      include: demandInclude,
    })
    if (!row) return notFound("Demand not found.")

    // Allow access if user has scope over either source or destination store.
    const fromDenied = row.fromStoreId
      ? await ensureStoreInScope(row.fromStoreId, session.scope, "Demand not found.")
      : null
    const toDenied = row.toStoreId
      ? await ensureStoreInScope(row.toStoreId, session.scope, "Demand not found.")
      : null
    if (fromDenied && toDenied) return fromDenied

    return ok(row)
  } catch (error) {
    console.error(`store-inventory v2 demands GET (${id}) failed`, error)
    return internalServerError("Failed to fetch demand.")
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

    const current = await prisma.storeInventoryDemand.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!current) return notFound("Demand not found.")

    // Mutating the demand requires scope over either side; downstream fulfilment
    // (warehouse approval) needs `toStore` access, while cancellation needs source.
    const fromDenied = current.fromStoreId
      ? await ensureStoreInScope(current.fromStoreId, session.scope, "Demand not found.")
      : null
    const toDenied = current.toStoreId
      ? await ensureStoreInScope(current.toStoreId, session.scope, "Demand not found.")
      : null
    if (fromDenied && toDenied) return fromDenied

    const nextStatus = body.status != null ? normalizeStatus(body.status) : null
    if (body.status != null && !nextStatus) {
      return badRequest("Invalid demand status.")
    }

    if (nextStatus && nextStatus !== current.status) {
      const allowed = allowedTransitions[current.status]
      if (!allowed.includes(nextStatus)) {
        return badRequest(`Invalid status transition from ${current.status} to ${nextStatus}.`)
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(body.lines)) {
        for (const rawLine of body.lines) {
          if (!rawLine || typeof rawLine !== "object") continue
          const line = rawLine as Record<string, unknown>
          const lineId = asText(line.id)
          if (!lineId) continue
          const approvedQtyParsed = line.approvedQty != null ? parseNonNegativeInt(line.approvedQty) : undefined
          const fulfilledQtyParsed = line.fulfilledQty != null ? parseNonNegativeInt(line.fulfilledQty) : undefined
          if ((line.approvedQty != null && approvedQtyParsed == null) || (line.fulfilledQty != null && fulfilledQtyParsed == null)) {
            throw new Error("INVALID_LINE_QUANTITY")
          }
          const approvedQty = approvedQtyParsed == null ? undefined : approvedQtyParsed
          const fulfilledQty = fulfilledQtyParsed == null ? undefined : fulfilledQtyParsed

          await tx.storeInventoryDemandLine.update({
            where: { id: lineId },
            data: {
              approvedQty,
              fulfilledQty,
              notes: line.notes != null ? asText(line.notes) : undefined,
            },
          })
        }
      }

      return tx.storeInventoryDemand.update({
        where: { id },
        data: {
          status: nextStatus ?? undefined,
          reason: body.reason != null ? asText(body.reason) : undefined,
          notes: body.notes != null ? asText(body.notes) : undefined,
          approvedById: nextStatus === StoreInventoryDemandStatus.APPROVED ? session.userId : undefined,
          approvedAt: nextStatus === StoreInventoryDemandStatus.APPROVED ? new Date() : undefined,
          fulfilledAt: nextStatus === StoreInventoryDemandStatus.FULFILLED ? new Date() : undefined,
        },
        include: demandInclude,
      })
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "DEMAND_UPDATED",
      description: `Updated demand ${id}${nextStatus ? ` status=${nextStatus}` : ""}`,
      request,
    })

    return ok(updated)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Demand record not found.")
    if (code === "P2003") return badRequest("Invalid related reference.")
    if (error instanceof Error && error.message === "INVALID_LINE_QUANTITY") {
      return badRequest("Demand line quantities must be non-negative integers.")
    }

    console.error(`store-inventory v2 demands PATCH (${id}) failed`, error)
    return internalServerError("Failed to update demand.")
  }
}
