/**
 * Canonical state machine for store-inventory v2 demands.
 *
 * This is the SINGLE source of truth for demand status normalization and
 * transition rules. It mirrors the Prisma `StoreInventoryDemandStatus` enum
 * exactly (DRAFT, SENT, APPROVED, REJECTED, PARTIALLY_FULFILLED, FULFILLED,
 * CANCELLED) — do NOT invent statuses (e.g. `PENDING`, which belongs to
 * `StoreInventoryDemandResponseStatus`, not to demands).
 *
 * Imported by:
 *   - api/store-inventory/v2/demands/route.ts        (list + create)
 *   - api/store-inventory/v2/demands/[id]/route.ts   (PATCH transition gate)
 */
import { StoreInventoryDemandStatus } from "@prisma/client"

/** All demand statuses, mirroring the Prisma enum. */
export const DEMAND_STATUSES = [
  StoreInventoryDemandStatus.DRAFT,
  StoreInventoryDemandStatus.SENT,
  StoreInventoryDemandStatus.APPROVED,
  StoreInventoryDemandStatus.REJECTED,
  StoreInventoryDemandStatus.PARTIALLY_FULFILLED,
  StoreInventoryDemandStatus.FULFILLED,
  StoreInventoryDemandStatus.CANCELLED,
] as const

/**
 * Statuses a demand is allowed to be created in. A freshly created demand is
 * either a working DRAFT or already SENT for warehouse action. All other
 * states (APPROVED/FULFILLED/…) must be reached through the transition gate,
 * never set directly on create.
 */
export const INITIAL_DEMAND_STATUSES = [
  StoreInventoryDemandStatus.DRAFT,
  StoreInventoryDemandStatus.SENT,
] as const

/** The canonical demand transition map. Each key lists its valid next states. */
const DEMAND_TRANSITIONS: Record<StoreInventoryDemandStatus, readonly StoreInventoryDemandStatus[]> = {
  DRAFT: [StoreInventoryDemandStatus.SENT, StoreInventoryDemandStatus.CANCELLED],
  SENT: [
    StoreInventoryDemandStatus.APPROVED,
    StoreInventoryDemandStatus.REJECTED,
    StoreInventoryDemandStatus.CANCELLED,
  ],
  APPROVED: [
    StoreInventoryDemandStatus.PARTIALLY_FULFILLED,
    StoreInventoryDemandStatus.FULFILLED,
    StoreInventoryDemandStatus.CANCELLED,
  ],
  REJECTED: [],
  PARTIALLY_FULFILLED: [StoreInventoryDemandStatus.FULFILLED, StoreInventoryDemandStatus.CANCELLED],
  FULFILLED: [],
  CANCELLED: [],
}

const DEMAND_STATUS_VALUES = new Set<string>(DEMAND_STATUSES)
const INITIAL_DEMAND_STATUS_VALUES = new Set<StoreInventoryDemandStatus>(INITIAL_DEMAND_STATUSES)

/**
 * Coerces an unknown input to a valid `StoreInventoryDemandStatus`, or returns
 * null when the value is missing/invalid. Does NOT default — callers decide the
 * default for their own context (create vs filter vs patch).
 */
export function normalizeDemandStatus(input: unknown): StoreInventoryDemandStatus | null {
  const value = String(input ?? "").trim().toUpperCase()
  if (!value) return null
  return DEMAND_STATUS_VALUES.has(value) ? (value as StoreInventoryDemandStatus) : null
}

/** True when `status` is a permitted initial (create-time) state. */
export function isInitialDemandStatus(status: StoreInventoryDemandStatus): boolean {
  return INITIAL_DEMAND_STATUS_VALUES.has(status)
}

/**
 * True when a demand may transition from `from` to `to`. A no-op transition
 * (from === to) is always allowed.
 */
export function canTransitionDemand(
  from: StoreInventoryDemandStatus,
  to: StoreInventoryDemandStatus
): boolean {
  if (from === to) return true
  return DEMAND_TRANSITIONS[from].includes(to)
}
