const INVENTORY_DEMAND_STATUSES = ["PENDING", "APPROVED", "REJECTED", "FULFILLED"] as const

export type InventoryDemandStatus = (typeof INVENTORY_DEMAND_STATUSES)[number]

const INVENTORY_DEMAND_TRANSITIONS: Record<InventoryDemandStatus, ReadonlySet<InventoryDemandStatus>> = {
  PENDING: new Set(["APPROVED", "REJECTED"]),
  APPROVED: new Set(["FULFILLED", "REJECTED"]),
  REJECTED: new Set(),
  FULFILLED: new Set(),
}

const TERMINAL_INVENTORY_DEMAND_STATUSES = new Set<InventoryDemandStatus>(["REJECTED", "FULFILLED"])

export function normalizeInventoryDemandStatus(input: unknown): InventoryDemandStatus | null {
  const value = String(input || "").trim().toUpperCase()
  if (!value) return null
  return (INVENTORY_DEMAND_STATUSES as readonly string[]).includes(value) ? (value as InventoryDemandStatus) : null
}

export function isInitialInventoryDemandStatus(status: InventoryDemandStatus): boolean {
  return status === "PENDING"
}

export function canTransitionInventoryDemandStatus(
  current: InventoryDemandStatus,
  next: InventoryDemandStatus
): boolean {
  if (current === next) return true
  return INVENTORY_DEMAND_TRANSITIONS[current].has(next)
}

export function isTerminalInventoryDemandStatus(status: InventoryDemandStatus): boolean {
  return TERMINAL_INVENTORY_DEMAND_STATUSES.has(status)
}

export function getInventoryDemandStatuses(): readonly InventoryDemandStatus[] {
  return INVENTORY_DEMAND_STATUSES
}
