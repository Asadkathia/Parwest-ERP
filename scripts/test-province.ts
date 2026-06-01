import assert from "node:assert/strict"
import { resolveProvinceFromRegion } from "../src/lib/geo/province.ts"

assert.equal(resolveProvinceFromRegion({ province: "PUNJAB" }), "PUNJAB")
assert.equal(resolveProvinceFromRegion(null), null)
assert.equal(resolveProvinceFromRegion({ province: null }), null)
console.log("province tests passed")
