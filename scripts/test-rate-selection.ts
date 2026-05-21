import assert from "node:assert/strict"
import {
  CIVILIAN,
  resolveBillingExService,
  resolveBillingGeo,
  selectContractRate,
  type CandidateRate,
} from "../src/lib/invoicing/rateSelection"

function rate(partial: Partial<CandidateRate>): CandidateRate {
  return {
    id: "r",
    exService: "ARMY",
    province: "Punjab",
    city: "Lahore",
    rate: 100,
    extraHourRate: 10,
    isCurrentRate: false,
    rateStartDate: null,
    rateEndDate: null,
    ...partial,
  }
}

// ── resolveBillingExService ───────────────────────────────────────────────
assert.equal(
  resolveBillingExService({ isExService: false, exServiceType: null }),
  CIVILIAN,
  "non-ex-service guard -> CIVILIAN",
)
assert.equal(
  resolveBillingExService({ isExService: true, exServiceType: "Army" }),
  "ARMY",
  "ex-service type normalised to upper",
)
assert.equal(
  resolveBillingExService({ isExService: true, exServiceType: "CIVILIAN" }),
  CIVILIAN,
  "explicit CIVILIAN type -> CIVILIAN",
)
assert.equal(
  resolveBillingExService({ isExService: true, exServiceType: null }),
  null,
  "ex-service yes but no type -> null (data gap)",
)

// ── resolveBillingGeo ─────────────────────────────────────────────────────
assert.deepEqual(
  resolveBillingGeo({
    hasBranch: true,
    branch: { province: "Sindh", city: "Karachi" },
    client: { operationalProvinces: "Punjab", regionName: "Lahore" },
  }),
  { province: "Sindh", city: "Karachi" },
  "branch contract -> branch geo",
)
assert.deepEqual(
  resolveBillingGeo({
    hasBranch: false,
    branch: null,
    client: { operationalProvinces: "Punjab", regionName: "Lahore" },
  }),
  { province: "Punjab", city: "Lahore" },
  "client-level -> operationalProvinces + region(city)",
)

// ── selectContractRate ────────────────────────────────────────────────────
const asOf = new Date("2026-05-15")

// exService must match
assert.equal(
  selectContractRate([rate({ id: "a", exService: "POLICE" })], {
    exService: "ARMY",
    province: "Punjab",
    city: "Lahore",
    asOf,
  }),
  null,
  "no exService match -> null",
)

// effective window picks period-correct row over a future one
{
  const chosen = selectContractRate(
    [
      rate({ id: "old", rate: 100, rateStartDate: new Date("2026-01-01"), rateEndDate: new Date("2026-03-31") }),
      rate({ id: "cur", rate: 120, rateStartDate: new Date("2026-04-01"), rateEndDate: null }),
      rate({ id: "future", rate: 200, rateStartDate: new Date("2026-09-01"), rateEndDate: null }),
    ],
    { exService: "ARMY", province: "Punjab", city: "Lahore", asOf },
  )
  assert.equal(chosen?.id, "cur", "effective-dated row covering asOf wins")
}

// rateEndDate expiry excludes expired row even if isCurrentRate
{
  const chosen = selectContractRate(
    [rate({ id: "expired", isCurrentRate: true, rateStartDate: new Date("2026-01-01"), rateEndDate: new Date("2026-02-01") })],
    { exService: "ARMY", province: "Punjab", city: "Lahore", asOf },
  )
  assert.equal(chosen, null, "expired row (even if current) does not match the window and has no fallback peer")
}

// isCurrentRate used only as fallback when no dated row matches
{
  const chosen = selectContractRate(
    [
      rate({ id: "nodate", isCurrentRate: true, rateStartDate: null, rateEndDate: null }),
    ],
    { exService: "ARMY", province: "Punjab", city: "Lahore", asOf },
  )
  assert.equal(chosen?.id, "nodate", "undated current row matches as effective (open-ended)")
}

// blank city on rate = region-wide wildcard
{
  const chosen = selectContractRate(
    [rate({ id: "wide", city: null })],
    { exService: "ARMY", province: "Punjab", city: "Lahore", asOf },
  )
  assert.equal(chosen?.id, "wide", "blank city row matches any city")
}

// city mismatch when rate specifies a different city
assert.equal(
  selectContractRate([rate({ id: "x", city: "Karachi" })], {
    exService: "ARMY",
    province: "Punjab",
    city: "Lahore",
    asOf,
  }),
  null,
  "specific city mismatch -> null",
)

// multiple undated matching rows: isCurrentRate wins the tie (not array order)
{
  const chosen = selectContractRate(
    [
      rate({ id: "b-noncurrent", isCurrentRate: false, rateStartDate: null, rateEndDate: null }),
      rate({ id: "a-current", isCurrentRate: true, rateStartDate: null, rateEndDate: null }),
    ],
    { exService: "ARMY", province: "Punjab", city: "Lahore", asOf },
  )
  assert.equal(chosen?.id, "a-current", "among undated ties, isCurrentRate wins regardless of array order")
}

// equal start dates, neither current: stable id ordering decides (deterministic)
{
  const chosen = selectContractRate(
    [
      rate({ id: "zzz", isCurrentRate: false, rateStartDate: new Date("2026-04-01"), rateEndDate: null }),
      rate({ id: "aaa", isCurrentRate: false, rateStartDate: new Date("2026-04-01"), rateEndDate: null }),
    ],
    { exService: "ARMY", province: "Punjab", city: "Lahore", asOf },
  )
  assert.equal(chosen?.id, "aaa", "equal dates + no current -> lowest id wins deterministically")
}

console.log("rateSelection tests OK")
