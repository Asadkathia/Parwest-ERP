import assert from "node:assert/strict"
import { selectGuardRate, type GuardRate } from "../src/lib/invoicing/guardRate.ts"
const r = (id: string, guardId: string, rate: number, cur = true): GuardRate =>
  ({ id, guardId, rate, extraHourRate: null, isCurrentRate: cur, rateStartDate: null, rateEndDate: null })

assert.equal(selectGuardRate([r("1","G1",100), r("2","G2",200)], "G1", new Date())?.rate, 100)
assert.equal(selectGuardRate([r("1","G1",100)], "G9", new Date()), null)
console.log("guard rate resolver tests passed")
