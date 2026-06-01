/**
 * Pure, prisma-free contract-rate selection logic for client invoicing.
 *
 * MANUAL contracts resolve by most-specific location scope
 * (branch → region → province → global, most-specific wins); within a scope the
 * most-recently-effective in-window row wins. `guardType` is display-only and
 * never participates here.
 */

// ─── MANUAL contract scope-specificity resolver ──────────────────────────────
// Resolves billing rates for MANUAL contracts by most-specific location scope:
// BRANCH → REGION → PROVINCE → GLOBAL.

export type ScopedRate = {
  id: string
  scopeLevel: "BRANCH" | "REGION" | "PROVINCE" | "GLOBAL"
  scopeBranchId: string | null
  scopeRegionId: string | null
  scopeProvince: string | null
  rate: number
  extraHourRate: number | null
  isCurrentRate: boolean
  rateStartDate: Date | null
  rateEndDate: Date | null
}

function inWindow(r: ScopedRate, t: number): boolean {
  const s = !r.rateStartDate || r.rateStartDate.getTime() <= t
  const e = !r.rateEndDate || r.rateEndDate.getTime() >= t
  return s && e
}

export function selectManualScopedRate(
  rates: ScopedRate[],
  ctx: { branchId: string | null; regionId: string | null; province: string | null; asOf: Date },
): ScopedRate | null {
  const t = ctx.asOf.getTime()
  const matchers: Array<(r: ScopedRate) => boolean> = [
    (r) => r.scopeLevel === "BRANCH"   && !!ctx.branchId && r.scopeBranchId === ctx.branchId,
    (r) => r.scopeLevel === "REGION"   && !!ctx.regionId && r.scopeRegionId === ctx.regionId,
    (r) => r.scopeLevel === "PROVINCE" && !!ctx.province && r.scopeProvince === ctx.province,
    (r) => r.scopeLevel === "GLOBAL",
  ]
  for (const matches of matchers) {
    const hit = rates
      .filter((r) => matches(r) && inWindow(r, t))
      // Most-recently-effective row wins for the same scope: rateStartDate desc
      // FIRST so a historical/back-dated month never picks an older overlapping
      // row, then isCurrentRate desc as a tie-break among equally-dated rows,
      // then id asc as a stable final key (selection never depends on DB order).
      .sort((a, b) =>
        ((b.rateStartDate?.getTime() ?? 0) - (a.rateStartDate?.getTime() ?? 0)) ||
        (Number(b.isCurrentRate) - Number(a.isCurrentRate)) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      )[0]
    if (hit) return hit
  }
  return null
}
