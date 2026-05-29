import { NextRequest } from "next/server"
import { StoreInventoryDemandStatus } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, ensureStoreInScope, parseNonNegativeInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { canTransitionDemand, normalizeDemandStatus } from "@/lib/inventory/demand-status-machine"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

/**
 * Terminal demand statuses — once a demand reaches one of these, its core
 * fields (lines/quantities, reason) are frozen when
 * `inventoryDemand.blockCoreEditsAfterTerminal` is enabled.
 */
const TERMINAL_DEMAND_STATUSES = new Set<StoreInventoryDemandStatus>([
  StoreInventoryDemandStatus.FULFILLED,
  StoreInventoryDemandStatus.REJECTED,
  StoreInventoryDemandStatus.CANCELLED,
])

/**
 * Predicate: does this PATCH body attempt to mutate any "core" demand field?
 *
 * Core = fields that change what was requested or how much
 * (`lines` for qty/items and `reason` for the originating justification).
 * Non-core (metadata) = `notes`, `status`. Status transitions are governed by
 * the transition-map rule, not by the terminal-edit-block rule.
 */
function patchTouchesCoreFields(body: Record<string, unknown>): boolean {
  if (Array.isArray(body.lines) && body.lines.length > 0) return true
  if (body.reason !== undefined) return true
  return false
}

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

type Params = { params: Promise<{ id: string }> }

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

    const nextStatus = body.status != null ? normalizeDemandStatus(body.status) : null
    if (body.status != null && !nextStatus) {
      return badRequest("Invalid demand status.")
    }

    // Workflow rule `inventoryDemand.enforceTransitionMap`:
    //   ENABLED  → enforce the canonical demand transition map
    //              (canTransitionDemand from the shared state machine).
    //   DISABLED → allow any normalized status transition. Unknown statuses
    //              are still rejected above by normalizeDemandStatus.
    if (
      nextStatus &&
      nextStatus !== current.status &&
      isWorkflowRuleEnabled("inventoryDemand.enforceTransitionMap") &&
      !canTransitionDemand(current.status, nextStatus)
    ) {
      return badRequest(`Invalid status transition from ${current.status} to ${nextStatus}.`)
    }

    // Workflow rule `inventoryDemand.blockCoreEditsAfterTerminal`:
    //   ENABLED  → reject core-field edits (lines/qty, reason) on demands
    //              already in a terminal state (FULFILLED/REJECTED/CANCELLED).
    //              Metadata-only edits (notes, status) remain allowed; status
    //              transitions are independently governed by the transition
    //              map above.
    //   DISABLED → allow core-field edits on terminal demands.
    if (
      isWorkflowRuleEnabled("inventoryDemand.blockCoreEditsAfterTerminal") &&
      TERMINAL_DEMAND_STATUSES.has(current.status) &&
      patchTouchesCoreFields(body)
    ) {
      return badRequest(
        `Demand is in terminal status ${current.status}; core fields (lines, reason) cannot be edited.`,
      )
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
