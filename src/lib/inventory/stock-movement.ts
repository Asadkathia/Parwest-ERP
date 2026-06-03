import type { Prisma } from "@prisma/client"

/**
 * Single source of truth for all `StoreInventoryBalance` mutations.
 *
 * Every store-inventory writer (purchases receive, assignments, returns,
 * adjustments, demand-response allocate/receive) MUST funnel its balance math
 * through `applyStockMovement`. This guarantees:
 *   - All quantity deltas use atomic Prisma `{ increment }` (no read-then-write,
 *     so concurrent movements within the same serializable transaction cannot
 *     clobber each other's deltas).
 *   - `avgUnitCost` is recomputed as a quantity-weighted moving average on
 *     inflow, never the naive `(old + new) / 2`.
 *
 * The balance row is keyed by the `(storeId, productId)` compound unique.
 */

/** Minimal balance shape used by the availability invariant. */
export type StockBalanceLike = {
  quantityOnHand: number
  quantityHeld: number
  quantityIssued: number
}

/**
 * Canonical availability invariant.
 *
 * `quantityIssued` is disjoint from `quantityOnHand`: an assignment MOVES a unit out
 * of on-hand into issued (`onHandDelta:-q, issuedDelta:+q`) and a return moves it back
 * (`onHandDelta:+q, issuedDelta:-q`). Issued stock has therefore already left
 * `quantityOnHand` — subtracting it again double-counts. `quantityHeld` is the opposite:
 * a SUBSET of on-hand (reusable units are added to BOTH on receive), reserved and not
 * freely assignable. So freely-assignable stock is on-hand minus the held portion:
 *
 *   available = quantityOnHand - quantityHeld
 *
 * (Previously this subtracted `quantityIssued` as well, which under-reported
 * availability by the issued amount — e.g. receive 10 then assign 3 showed 4, not 7 —
 * and made the assignment/demand sufficiency gate spuriously reject valid stock.)
 */
export function availableQty(balance: StockBalanceLike | null | undefined): number {
  if (!balance) return 0
  return (balance.quantityOnHand ?? 0) - (balance.quantityHeld ?? 0)
}

export type ApplyStockMovementArgs = {
  storeId: string
  productId: string
  /** Delta applied to `quantityOnHand` (atomic increment; may be negative). */
  onHandDelta?: number
  /** Delta applied to `quantityHeld` (atomic increment; may be negative). */
  heldDelta?: number
  /** Delta applied to `quantityIssued` (atomic increment; may be negative). */
  issuedDelta?: number
  /**
   * Unit cost of the inflow being recorded. When supplied together with
   * `qtyForAvg`, `avgUnitCost` is recomputed as a quantity-weighted average over
   * the prior on-hand quantity. Has no effect on outflows.
   */
  unitCost?: number | null
  /**
   * Quantity (units) priced at `unitCost`, used as the weight in the
   * quantity-weighted average. Typically the accepted inflow quantity.
   */
  qtyForAvg?: number | null
}

/**
 * Apply a stock movement to the `(storeId, productId)` balance using atomic
 * increments for every quantity field, and a quantity-weighted moving average
 * for `avgUnitCost`.
 *
 * Must be called inside a `$transaction` (pass the transaction client as `tx`).
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  args: ApplyStockMovementArgs,
): Promise<void> {
  const {
    storeId,
    productId,
    onHandDelta = 0,
    heldDelta = 0,
    issuedDelta = 0,
    unitCost = null,
    qtyForAvg = null,
  } = args

  // Recompute the quantity-weighted average cost only when we have both a unit
  // cost and a positive weight. This needs the prior on-hand quantity + avg, so
  // we read the current row for the cost math ONLY — all quantity writes still
  // go through atomic `{ increment }` so concurrent deltas are never clobbered.
  //
  // CONCURRENCY CAVEAT: `avgUnitCost` is written as an absolute (it is derived
  // from a non-atomic read of priorQty/priorAvg), so two genuinely-concurrent
  // inflows could each compute a slightly stale weighted cost. This is why every
  // caller MUST run inside a SERIALIZABLE `$transaction` (the inflow paths do).
  // Quantities are never affected — they always use atomic `{ increment }`.
  let nextAvg: number | null | undefined
  if (unitCost != null && qtyForAvg != null && qtyForAvg > 0) {
    const current = await tx.storeInventoryBalance.findUnique({
      where: { storeId_productId: { storeId, productId } },
      select: { quantityOnHand: true, avgUnitCost: true },
    })
    const priorQty = current?.quantityOnHand ?? 0
    const priorAvg = current?.avgUnitCost ?? null
    if (priorAvg == null || priorQty <= 0) {
      // No meaningful prior cost basis — the inflow defines the average.
      nextAvg = Number(unitCost.toFixed(2))
    } else {
      const weighted = (priorAvg * priorQty + unitCost * qtyForAvg) / (priorQty + qtyForAvg)
      nextAvg = Number(weighted.toFixed(2))
    }
  }

  await tx.storeInventoryBalance.upsert({
    where: { storeId_productId: { storeId, productId } },
    create: {
      storeId,
      productId,
      quantityOnHand: onHandDelta,
      quantityHeld: heldDelta,
      quantityIssued: issuedDelta,
      avgUnitCost: nextAvg ?? (unitCost != null ? Number(unitCost.toFixed(2)) : null),
    },
    update: {
      ...(onHandDelta !== 0 ? { quantityOnHand: { increment: onHandDelta } } : {}),
      ...(heldDelta !== 0 ? { quantityHeld: { increment: heldDelta } } : {}),
      ...(issuedDelta !== 0 ? { quantityIssued: { increment: issuedDelta } } : {}),
      ...(nextAvg !== undefined ? { avgUnitCost: nextAvg } : {}),
    },
  })
}
