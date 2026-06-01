import assert from "node:assert/strict"
import { selectManualScopedRate, type ScopedRate } from "../src/lib/invoicing/rateSelection.ts"

const base = { rate: 0, extraHourRate: null, isCurrentRate: true, rateStartDate: null, rateEndDate: null }
const branch: ScopedRate   = { ...base, id: "b", scopeLevel: "BRANCH",   scopeBranchId: "B1", scopeRegionId: null, scopeProvince: null, rate: 100 }
const region: ScopedRate   = { ...base, id: "r", scopeLevel: "REGION",   scopeBranchId: null, scopeRegionId: "R1", scopeProvince: null, rate: 200 }
const province: ScopedRate = { ...base, id: "p", scopeLevel: "PROVINCE", scopeBranchId: null, scopeRegionId: null, scopeProvince: "PUNJAB", rate: 300 }
const global: ScopedRate   = { ...base, id: "g", scopeLevel: "GLOBAL",   scopeBranchId: null, scopeRegionId: null, scopeProvince: null, rate: 400 }
const ctx = { branchId: "B1", regionId: "R1", province: "PUNJAB", asOf: new Date("2026-05-15") }

assert.equal(selectManualScopedRate([global, province, region, branch], ctx)?.rate, 100)
assert.equal(selectManualScopedRate([global, province, region], ctx)?.rate, 200)
assert.equal(selectManualScopedRate([global, province], ctx)?.rate, 300)
assert.equal(selectManualScopedRate([global], ctx)?.rate, 400)
assert.equal(selectManualScopedRate([{ ...branch, rateStartDate: new Date("2026-09-01") }, region], ctx)?.rate, 200)
assert.equal(selectManualScopedRate([{ ...branch, scopeBranchId: "OTHER" }], ctx), null)

// Two REGION rows for the SAME scope, both in-window: the one with the later
// rateStartDate must win (rateStartDate desc is the primary sort key — a
// back-dated/older overlapping row must never override the newer effective one).
const regionOld: ScopedRate = { ...region, id: "r-old", rate: 200, rateStartDate: new Date("2026-01-01"), isCurrentRate: true }
const regionNew: ScopedRate = { ...region, id: "r-new", rate: 250, rateStartDate: new Date("2026-05-01"), isCurrentRate: false }
assert.equal(selectManualScopedRate([regionOld, regionNew], ctx)?.rate, 250)
assert.equal(selectManualScopedRate([regionNew, regionOld], ctx)?.rate, 250)

console.log("manual scope resolver tests passed")
