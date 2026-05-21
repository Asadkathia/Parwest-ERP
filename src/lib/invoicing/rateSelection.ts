/**
 * Pure, prisma-free contract-rate selection logic for client invoicing.
 *
 * Selection keys (per the 2026-05-21 redesign):
 *   contract scope (resolved by the caller: branch overrides client)
 *   + exService + province/city + effective date.
 * `guardType` is display-only and never participates here.
 */

export const CIVILIAN = "CIVILIAN"

export type CandidateRate = {
  id: string
  exService: string | null
  province: string | null
  city: string | null
  rate: number
  extraHourRate: number | null
  isCurrentRate: boolean
  rateStartDate: Date | null
  rateEndDate: Date | null
}

export type BillingGeo = { province: string | null; city: string | null }

function norm(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t.toUpperCase() : null
}

/**
 * Resolve the exService bucket to bill against from a guard's ex-service fields.
 * Returns the value to match, or `null` when the guard is flagged ex-service but
 * has no type recorded — a data gap the caller must surface (do not silently
 * treat as civilian).
 */
export function resolveBillingExService(guard: {
  isExService: boolean | null
  exServiceType: string | null
}): string | null {
  const type = guard.exServiceType?.trim() || null
  if (!guard.isExService || type?.toUpperCase() === CIVILIAN) return CIVILIAN
  if (!type) return null // ex-service yes but no type => data gap
  return type.toUpperCase()
}

/**
 * Derive billing province/city. Branch-specific contracts use the branch's own
 * geography; client-level contracts use the client's operational territory
 * (province) and region (operating city).
 */
export function resolveBillingGeo(args: {
  hasBranch: boolean
  branch: { province: string | null; city: string | null } | null
  client: { operationalProvinces: string | null; regionName: string | null }
}): BillingGeo {
  if (args.hasBranch) {
    return {
      province: args.branch?.province?.trim() || null,
      city: args.branch?.city?.trim() || null,
    }
  }
  return {
    province: args.client.operationalProvinces?.trim() || null,
    city: args.client.regionName?.trim() || null,
  }
}

/**
 * Pick the contract rate that applies for an exService + geo as of a date.
 *  1. exService must match (case-insensitive).
 *  2. province: a set province on the rate must match; blank = wildcard.
 *  3. city: a set city on the rate must match; blank = region-wide wildcard.
 *  4. rows whose effective window covers `asOf`
 *     (rateStartDate <= asOf <= rateEndDate, nulls = open) are candidates;
 *     sorted: latest rateStartDate desc, then isCurrentRate desc (tie-breaker
 *     among equally-dated rows), then id asc (stable final key).
 *  5. returns null when no row's effective window covers `asOf` — an
 *     expired/future-only set must not bill.
 */
export function selectContractRate(
  rates: CandidateRate[],
  args: { exService: string; province: string | null; city: string | null; asOf: Date },
): CandidateRate | null {
  const wantedEx = norm(args.exService)
  const wantedProvince = norm(args.province)
  const wantedCity = norm(args.city)

  const inScope = rates.filter((r) => {
    if (norm(r.exService) !== wantedEx) return false
    const rp = norm(r.province)
    if (rp && rp !== wantedProvince) return false
    const rc = norm(r.city)
    if (rc && rc !== wantedCity) return false
    return true
  })
  if (inScope.length === 0) return null

  const t = args.asOf.getTime()
  const dated = inScope
    .filter((r) => {
      const startOk = !r.rateStartDate || r.rateStartDate.getTime() <= t
      const endOk = !r.rateEndDate || r.rateEndDate.getTime() >= t
      return startOk && endOk
    })
    .sort((a, b) => {
      const byStart = (b.rateStartDate?.getTime() ?? 0) - (a.rateStartDate?.getTime() ?? 0)
      if (byStart !== 0) return byStart
      // tie-break: a row explicitly flagged current wins among equally-dated rows…
      const byCurrent = Number(b.isCurrentRate) - Number(a.isCurrentRate)
      if (byCurrent !== 0) return byCurrent
      // …then a stable key so selection never depends on DB/array order.
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })

  return dated[0] ?? null
}
