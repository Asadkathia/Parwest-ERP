# Client Pricing — Contract Rate Entry & Billing Selection Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make client invoicing select the correct contract rate (branch overrides client, by exService + region/city + effective date) and make rate entry capture ex-service as a yes/no+type (civilian = `"CIVILIAN"`) with auto-derived, server-authoritative province/city.

**Architecture:** Extract the rate-selection decision into a pure, prisma-free module (`rateSelection.ts`) that is unit-testable with `ts-node`. The DB-touching resolver (`rates.ts`) fetches the single applicable contract + its rates and delegates the decision to the pure module. `buildLines.ts` and `auto-fill` feed it resolved ex-service (from the guard) and geo (from branch/client). Rate-entry writes derive province/city server-side from the contract's branch or the client's territory/region; the UI shows them read-only and exposes an ex-service yes/no toggle.

**Tech Stack:** Next.js 14 App Router, Prisma (`@prisma/adapter-pg`), TypeScript, React client components, `ts-node` for the unit test (no vitest/jest in this repo).

**Spec:** `docs/superpowers/specs/2026-05-21-client-pricing-contract-rate-redesign-design.md`

**Commit policy for this plan:** The user will commit at the end, working on `main`. Do **not** run `git commit` between tasks. Each task ends with a verification command instead. A final `git add`/commit is left to the user.

---

## File Structure

- **Create** `src/lib/invoicing/rateSelection.ts` — pure logic: `resolveBillingExService`, `resolveBillingGeo`, `selectContractRate`, types, `CIVILIAN` constant. No prisma, no `@/` imports.
- **Create** `scripts/test-rate-selection.ts` — `node:assert` test runner for the pure module, run via `ts-node`.
- **Modify** `src/lib/invoicing/rates.ts` — replace `fromContract` internals; add `resolveContractRateContext` + `toRateLookup`.
- **Modify** `src/lib/invoicing/buildLines.ts` — capture `isExService`/`exServiceType`, resolve geo once, select rate via pure module.
- **Modify** `src/app/api/invoices/auto-fill/route.ts` — mirror `buildLines` changes.
- **Modify** `src/app/api/clients/[id]/contracts/[contractId]/rates/route.ts` — server-side geo derivation; require `exService`; rescope `isCurrentRate` unset to `(contractId, exService, province, city)` in POST and PATCH.
- **Modify** `src/app/api/clients/[id]/contracts/route.ts` — GET/POST include `branch { province, city }`.
- **Modify** `src/components/clients/PricingManager.tsx` — ex-service yes/no toggle, read-only derived province/city, drop hardcoded geo lists, thread client geo.
- **Modify** `src/app/(dashboard)/clients/[id]/page.tsx` — pass `operationalProvinces` + `regionName` to `PricingManager`.

---

## Task 1: Pure rate-selection module + tests

**Files:**
- Create: `src/lib/invoicing/rateSelection.ts`
- Test: `scripts/test-rate-selection.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-rate-selection.ts`:

```ts
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

console.log("rateSelection tests OK")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/test-rate-selection.ts`
Expected: FAIL — `Cannot find module '../src/lib/invoicing/rateSelection'` (module not created yet).

- [ ] **Step 3: Write the pure module**

Create `src/lib/invoicing/rateSelection.ts`:

```ts
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
 *  4. prefer rows whose effective window covers `asOf`
 *     (rateStartDate <= asOf <= rateEndDate, nulls = open); latest start wins.
 *  5. fallback to the isCurrentRate row only when no dated row matches.
 * Returns null when nothing matches.
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
    .sort((a, b) => (b.rateStartDate?.getTime() ?? 0) - (a.rateStartDate?.getTime() ?? 0))

  if (dated.length > 0) return dated[0]
  return inScope.find((r) => r.isCurrentRate) ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/test-rate-selection.ts`
Expected: PASS — prints `rateSelection tests OK`.

---

## Task 2: Rewrite `rates.ts` to use the pure module

**Files:**
- Modify: `src/lib/invoicing/rates.ts` (full rewrite of file)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/lib/invoicing/rates.ts` with:

```ts
import { prisma } from "@/lib/db"
import { selectContractRate, type CandidateRate } from "@/lib/invoicing/rateSelection"

export type RateLookup = {
  dailyRate: number
  overtimeHourly: number
  source: "CONTRACT" | "NONE"
  note?: string
}

const NONE: RateLookup = { dailyRate: 0, overtimeHourly: 0, source: "NONE" }

/**
 * Resolve the single applicable contract for a (client, branch) and return its
 * candidate rates. A branch-specific active contract overrides the client-level
 * one; the client-level contract is the fallback. Returns empty when neither
 * exists.
 */
export async function resolveContractRateContext(args: {
  clientId: string
  branchId: string | null
}): Promise<{ rates: CandidateRate[]; contractId: string | null }> {
  let contract: { id: string } | null = null

  if (args.branchId) {
    contract = await prisma.clientContract.findFirst({
      where: { clientId: args.clientId, branchId: args.branchId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
  }
  if (!contract) {
    contract = await prisma.clientContract.findFirst({
      where: { clientId: args.clientId, branchId: null, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
  }
  if (!contract) return { rates: [], contractId: null }

  const rates = await prisma.clientContractRate.findMany({
    where: { contractId: contract.id },
    select: {
      id: true,
      exService: true,
      province: true,
      city: true,
      rate: true,
      extraHourRate: true,
      isCurrentRate: true,
      rateStartDate: true,
      rateEndDate: true,
    },
  })
  return { rates, contractId: contract.id }
}

/** Map a selected candidate rate to the billing RateLookup shape. */
export function toRateLookup(rate: CandidateRate | null, contractId: string | null): RateLookup {
  if (!rate) return NONE
  return {
    dailyRate: Number(rate.rate ?? 0),
    overtimeHourly: Number(rate.extraHourRate ?? 0),
    source: "CONTRACT",
    note: contractId ? `contract ${contractId.slice(-6)}` : undefined,
  }
}

/**
 * Single-shot lookup: resolve the contract for the (client, branch) and select
 * the rate for the given exService + geo as of a date.
 */
export async function fromContract(args: {
  clientId: string
  branchId: string | null
  exService: string
  province: string | null
  city: string | null
  asOf: Date
}): Promise<RateLookup> {
  const { rates, contractId } = await resolveContractRateContext({
    clientId: args.clientId,
    branchId: args.branchId,
  })
  const selected = selectContractRate(rates, {
    exService: args.exService,
    province: args.province,
    city: args.city,
    asOf: args.asOf,
  })
  return toRateLookup(selected, contractId)
}
```

- [ ] **Step 2: Type-check (will still error in callers — expected)**

Run: `npx tsc --noEmit 2>&1 | grep -E "invoicing/rates.ts" || echo "rates.ts clean"`
Expected: `rates.ts clean` (errors in `buildLines.ts`/`auto-fill` are fixed in Tasks 3–4).

---

## Task 3: Update `buildLines.ts`

**Files:**
- Modify: `src/lib/invoicing/buildLines.ts` (full rewrite)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/lib/invoicing/buildLines.ts` with:

```ts
import { prisma } from "@/lib/db"
import { resolveContractRateContext, toRateLookup } from "@/lib/invoicing/rates"
import { resolveBillingExService, resolveBillingGeo, selectContractRate } from "@/lib/invoicing/rateSelection"

export type GeneratedLineKind = "GUARD_SALARY" | "SPECIAL_DUTY"

export type GeneratedLine = {
  kind: GeneratedLineKind
  refId: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type BuildLinesResult = {
  items: GeneratedLine[]
  warnings: string[]
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function buildInvoiceLines(args: {
  clientId: string
  branchId: string | null
  monthStart: Date
  monthEnd: Date
  /** When set, restricts deployment & special duty windows to [monthStart, asOf). Used by daily accrual. */
  asOf?: Date
}): Promise<BuildLinesResult> {
  const items: GeneratedLine[] = []
  const warnings: string[] = []
  const upper = args.asOf && args.asOf < args.monthEnd ? args.asOf : args.monthEnd

  const specialDuties = await prisma.payrollSpecialDuty.findMany({
    where: {
      clientId: args.clientId,
      ...(args.branchId ? { branchId: args.branchId } : {}),
      status: "ACTIVE",
      dateFrom: { lt: upper },
      dateTo: { gte: args.monthStart },
    },
    include: { guard: { select: { name: true, parwestId: true } } },
  })
  for (const sd of specialDuties) {
    items.push({
      kind: "SPECIAL_DUTY",
      refId: sd.id,
      description: `Special duty: ${sd.guard.name} (${sd.guard.parwestId}) ${fmtDate(sd.dateFrom)}..${fmtDate(sd.dateTo)}`,
      quantity: sd.hours,
      unitPrice: sd.hourRate,
      lineTotal: round2(sd.hours * sd.hourRate),
    })
  }

  const deployments = await prisma.deployment.findMany({
    where: {
      clientId: args.clientId,
      ...(args.branchId ? { branchId: args.branchId } : {}),
      deploymentDate: { gte: args.monthStart, lt: upper },
    },
    select: {
      id: true,
      guardId: true,
      deploymentDate: true,
      extraHours: true,
      guard: { select: { name: true, parwestId: true, isExService: true, exServiceType: true } },
    },
  })

  type Guard = { name: string; parwestId: string; isExService: boolean | null; exServiceType: string | null }
  type Agg = {
    guard: Guard
    days: Set<string>
    latestId: string
    latestDate: Date
    otHours: number
  }
  const byGuard = new Map<string, Agg>()
  for (const d of deployments) {
    const dayKey = fmtDate(d.deploymentDate)
    let agg = byGuard.get(d.guardId)
    if (!agg) {
      agg = {
        guard: d.guard,
        days: new Set(),
        latestId: d.id,
        latestDate: d.deploymentDate,
        otHours: 0,
      }
      byGuard.set(d.guardId, agg)
    }
    agg.days.add(dayKey)
    if (d.deploymentDate > agg.latestDate) {
      agg.latestDate = d.deploymentDate
      agg.latestId = d.id
    }
    const oh = Number(d.extraHours ?? 0)
    if (oh > 0) agg.otHours += oh
  }

  // Resolve the applicable contract + its rates once, plus billing geo.
  const { rates, contractId } = await resolveContractRateContext({
    clientId: args.clientId,
    branchId: args.branchId,
  })
  const client = await prisma.client.findUnique({
    where: { id: args.clientId },
    select: { operationalProvinces: true, region: { select: { name: true } } },
  })
  const branch = args.branchId
    ? await prisma.branch.findUnique({ where: { id: args.branchId }, select: { province: true, city: true } })
    : null
  const geo = resolveBillingGeo({
    hasBranch: Boolean(args.branchId),
    branch,
    client: {
      operationalProvinces: client?.operationalProvinces ?? null,
      regionName: client?.region?.name ?? null,
    },
  })

  for (const agg of byGuard.values()) {
    const days = agg.days.size
    const exService = resolveBillingExService({
      isExService: agg.guard.isExService,
      exServiceType: agg.guard.exServiceType,
    })
    if (exService === null) {
      warnings.push(
        `Ex-service type missing for ${agg.guard.name} (${agg.guard.parwestId}) — cannot resolve a contract rate.`,
      )
      continue
    }
    const selected = selectContractRate(rates, {
      exService,
      province: geo.province,
      city: geo.city,
      asOf: agg.latestDate,
    })
    const rate = toRateLookup(selected, contractId)
    if (rate.dailyRate <= 0) {
      warnings.push(
        `No contract rate for ${agg.guard.name} (${agg.guard.parwestId}) — exService "${exService}", ${geo.province ?? "?"}/${geo.city ?? "?"}.`,
      )
      continue
    }
    items.push({
      kind: "GUARD_SALARY",
      refId: agg.latestId,
      description: `Salary: ${agg.guard.name} (${agg.guard.parwestId}) — ${days} day${days === 1 ? "" : "s"} @ ${rate.dailyRate}`,
      quantity: days,
      unitPrice: rate.dailyRate,
      lineTotal: round2(days * rate.dailyRate),
    })
    if (agg.otHours > 0 && rate.overtimeHourly > 0) {
      items.push({
        kind: "GUARD_SALARY",
        refId: agg.latestId,
        description: `Overtime: ${agg.guard.name} (${agg.guard.parwestId}) — ${agg.otHours}h @ ${rate.overtimeHourly}`,
        quantity: agg.otHours,
        unitPrice: rate.overtimeHourly,
        lineTotal: round2(agg.otHours * rate.overtimeHourly),
      })
    }
  }

  return { items, warnings }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "buildLines.ts" || echo "buildLines.ts clean"`
Expected: `buildLines.ts clean`.

---

## Task 4: Update `auto-fill` route to mirror buildLines

**Files:**
- Modify: `src/app/api/invoices/auto-fill/route.ts`

- [ ] **Step 1: Replace the import line**

Change line 7 from:

```ts
import { fromContract } from "@/lib/invoicing/rates"
```

to:

```ts
import { resolveContractRateContext, toRateLookup } from "@/lib/invoicing/rates"
import { resolveBillingExService, resolveBillingGeo, selectContractRate } from "@/lib/invoicing/rateSelection"
```

- [ ] **Step 2: Add geo + contract resolution before the GUARD_SALARY loop**

The deployment query currently selects `guard: { select: { id: true, name: true, parwestId: true } }`. Change it to include ex-service fields:

```ts
      select: {
        id: true,
        guardId: true,
        deploymentDate: true,
        extraHours: true,
        guard: { select: { id: true, name: true, parwestId: true, isExService: true, exServiceType: true } },
      },
```

Update the `GuardAgg` type and its construction to carry the guard ex-service fields. Replace the `GuardAgg` type block and the aggregation `agg = { ... }` initializer so the stored `guard` includes `isExService` and `exServiceType` (they already come from the new select; just widen the type):

```ts
    type GuardAgg = {
      guard: { id: string; name: string; parwestId: string; isExService: boolean | null; exServiceType: string | null }
      days: Set<string>
      latestDeploymentId: string
      latestDeploymentDate: Date
      overtimeHoursTotal: number
    }
```

Remove the `guardType` field from `GuardAgg`, its initializer, and the `if (!agg.guardType && d.guardType) agg.guardType = d.guardType` line (guardType is no longer used).

Immediately before the `for (const agg of byGuard.values())` loop, resolve the contract context + geo once:

```ts
    const { rates, contractId } = await resolveContractRateContext({ clientId, branchId })
    const clientGeo = await prisma.client.findUnique({
      where: { id: clientId },
      select: { operationalProvinces: true, region: { select: { name: true } } },
    })
    const branchGeo = branchId
      ? await prisma.branch.findUnique({ where: { id: branchId }, select: { province: true, city: true } })
      : null
    const geo = resolveBillingGeo({
      hasBranch: Boolean(branchId),
      branch: branchGeo,
      client: {
        operationalProvinces: clientGeo?.operationalProvinces ?? null,
        regionName: clientGeo?.region?.name ?? null,
      },
    })
```

- [ ] **Step 3: Replace the per-guard rate lookup**

Inside `for (const agg of byGuard.values()) { ... }`, replace the existing `const rate = await fromContract({ ... })` block and its `if (rate.dailyRate <= 0)` guard with:

```ts
      const dayCount = agg.days.size
      const exService = resolveBillingExService({
        isExService: agg.guard.isExService,
        exServiceType: agg.guard.exServiceType,
      })
      if (exService === null) {
        warnings.push(
          `Ex-service type missing for ${agg.guard.name} (${agg.guard.parwestId}) — cannot resolve a contract rate.`,
        )
        continue
      }
      const selected = selectContractRate(rates, {
        exService,
        province: geo.province,
        city: geo.city,
        asOf: agg.latestDeploymentDate,
      })
      const rate = toRateLookup(selected, contractId)

      if (rate.dailyRate <= 0) {
        warnings.push(
          `No contract rate for ${agg.guard.name} (${agg.guard.parwestId}) — exService "${exService}", ${geo.province ?? "?"}/${geo.city ?? "?"}.`,
        )
        continue
      }
```

The existing line-item pushes below (`GUARD_SALARY` + overtime) keep using `rate.dailyRate`, `rate.overtimeHourly`, `rate.source`, and `dayCount` — leave those as-is.

**Important:** the existing overtime "no overtime rate" warning branch references the now-removed `agg.guardType`. Change that warning to use `exService` (in scope after this replacement):

```ts
          warnings.push(
            `Overtime hours present for ${agg.guard.name} but no overtime rate for exService "${exService}".`,
          )
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "auto-fill/route.ts" || echo "auto-fill clean"`
Expected: `auto-fill clean`.

---

## Task 5: Server-side geo derivation + isCurrentRate rescope in the rates route

**Files:**
- Modify: `src/app/api/clients/[id]/contracts/[contractId]/rates/route.ts`

- [ ] **Step 1: Load branch + client geo with the contract (POST)**

In `POST`, replace the contract lookup (currently `select: { id: true, name: true }`):

```ts
        const contract = await prisma.clientContract.findUnique({
            where: { id: contractId },
            select: {
                id: true,
                name: true,
                branchId: true,
                branch: { select: { province: true, city: true } },
                client: { select: { operationalProvinces: true, region: { select: { name: true } } } },
            },
        })
        if (!contract) return notFound("Contract not found")

        // Province/city are authoritative: derived from the contract's branch
        // (branch-specific) or the client's territory + region (client-level).
        const derivedProvince = contract.branchId
            ? (contract.branch?.province ?? null)
            : (contract.client?.operationalProvinces ?? null)
        const derivedCity = contract.branchId
            ? (contract.branch?.city ?? null)
            : (contract.client?.region?.name ?? null)
```

- [ ] **Step 2: Require exService and store derived geo (POST)**

Just after the existing `rate` parse + validation (`if (isNaN(rate)) return badRequest(...)`), add:

```ts
        const exService = String(body?.exService || "").trim()
        if (!exService) return badRequest("Ex-service selection is required.")
```

In the `tx.clientContractRate.create` data, change `province`, `city`, and `exService`:

```ts
                    province: derivedProvince,
                    city: derivedCity,
                    guardType,
                    exService,
```

And change the `isCurrentRate` unset `updateMany` where-clause from `{ contractId, guardType, exService: ..., isCurrentRate: true, id: { not: created.id } }` to:

```ts
                await tx.clientContractRate.updateMany({
                    where: {
                        contractId,
                        exService,
                        province: derivedProvince,
                        city: derivedCity,
                        isCurrentRate: true,
                        id: { not: created.id },
                    },
                    data: { isCurrentRate: false },
                })
```

Update the audit description to use `exService` (already in scope).

- [ ] **Step 3: Rescope the PATCH unset**

In `PATCH`, change the `tx.clientContractRate.updateMany` where-clause from `{ contractId, guardType: rate.guardType, exService: rate.exService, isCurrentRate: true }` to:

```ts
            await tx.clientContractRate.updateMany({
                where: {
                    contractId,
                    exService: rate.exService,
                    province: rate.province,
                    city: rate.city,
                    isCurrentRate: true,
                },
                data: { isCurrentRate: false },
            })
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "rates/route.ts" || echo "rates route clean"`
Expected: `rates route clean`.

---

## Task 6: Expose branch geo in contracts GET + pass client geo to PricingManager

**Files:**
- Modify: `src/app/api/clients/[id]/contracts/route.ts`
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx`

- [ ] **Step 1: Include branch province/city in GET and POST**

In `GET`, change the include `branch: { select: { id: true, name: true } }` to:

```ts
                branch: { select: { id: true, name: true, province: true, city: true } },
```

In `POST`, change the same `branch: { select: { id: true, name: true } }` include to:

```ts
                branch: { select: { id: true, name: true, province: true, city: true } },
```

- [ ] **Step 2: Pass client geo props at the PricingManager mount**

In `src/app/(dashboard)/clients/[id]/page.tsx`, the `<PricingManager ... />` element (around line 679) currently passes `clientId`, `clientName`, `branches`, `isBranchless`. Add two props:

```tsx
            <PricingManager
              clientId={client.id}
              clientName={client.name}
              branches={client.branches.map((b) => ({ id: b.id, name: b.name }))}
              isBranchless={client.isBranchless}
              operationalProvinces={client.operationalProvinces ?? null}
              regionName={client.region?.name ?? null}
            />
```

(`client.region` is already selected on the page query — confirmed at `page.tsx:126 region: true`. `operationalProvinces` is a scalar column, already on `client`.)

- [ ] **Step 3: Type-check (PricingManager prop types updated in Task 7)**

Run: `npx tsc --noEmit 2>&1 | grep -E "clients/\[id\]/page.tsx|contracts/route.ts" || echo "task6 clean"`
Expected: a type error on the new `operationalProvinces`/`regionName` props (PricingManager not yet updated) — that is fixed in Task 7. The `contracts/route.ts` change should produce no error.

---

## Task 7: PricingManager UI — ex-service toggle + read-only derived geo

**Files:**
- Modify: `src/components/clients/PricingManager.tsx`

- [ ] **Step 1: Remove hardcoded geo lists**

Delete the `PROVINCE_OPTIONS` constant (line 7) and the `CITY_OPTIONS` constant (lines 9–16). They are no longer used (province/city are derived).

- [ ] **Step 2: Extend the branch type and Props**

In the `Contract` type, change the `branch` field:

```ts
    branch: { id: string; name: string; province: string | null; city: string | null } | null
```

In `Props`, add the two client-geo props:

```ts
type Props = {
    clientId: string
    clientName: string
    branches: Branch[]
    isBranchless: boolean
    operationalProvinces: string | null
    regionName: string | null
}
```

- [ ] **Step 3: Rewrite `AddRateModal`**

Replace the entire `AddRateModal` function (lines 192–307) with:

```tsx
function AddRateModal({
    clientId, contractId, branch, operationalProvinces, regionName, guardTypes, exServiceTypes, onClose, onCreated,
}: {
    clientId: string
    contractId: string
    branch: { province: string | null; city: string | null } | null
    operationalProvinces: string | null
    regionName: string | null
    guardTypes: string[]
    exServiceTypes: string[]
    onClose: () => void
    onCreated: (r: ContractRate) => void
}) {
    // Province/city are derived (server is authoritative); shown read-only here.
    const isBranchContract = !!branch
    const derivedProvince = (isBranchContract ? branch?.province : operationalProvinces) || "—"
    const derivedCity = (isBranchContract ? branch?.city : regionName) || "—"

    const [form, setForm] = useState({
        guardType: guardTypes[0] ?? "",
        exServiceYes: false,
        exServiceType: exServiceTypes[0] ?? "",
        rate: "", extraHourRate: "", isCurrentRate: false,
        rateStartDate: "", rateEndDate: "",
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

    async function submit() {
        if (!form.guardType) { setError("Guard type is required."); return }
        if (form.exServiceYes && !form.exServiceType) { setError("Select an ex-service type."); return }
        if (!form.rate || isNaN(Number(form.rate))) { setError("A valid rate is required."); return }
        setLoading(true); setError("")
        try {
            const exService = form.exServiceYes ? form.exServiceType : "CIVILIAN"
            const res = await fetch(`/api/clients/${clientId}/contracts/${contractId}/rates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guardType: form.guardType,
                    exService,
                    rate: Number(form.rate),
                    extraHourRate: form.extraHourRate ? Number(form.extraHourRate) : null,
                    isCurrentRate: form.isCurrentRate,
                    rateStartDate: form.rateStartDate || null,
                    rateEndDate: form.rateEndDate || null,
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            onCreated(await res.json())
        } catch {
            setError("Failed to add rate.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal title="Add Contract Rate" onClose={onClose}>
            <div className="space-y-4">
                {/* Is Current Rate toggle */}
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--text)]">Mark as Current Rate</p>
                        <p className="text-xs text-[var(--text-muted)]">Deactivates previous current rate for this ex-service + location</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => set("isCurrentRate", !form.isCurrentRate)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.isCurrentRate ? "bg-green-500" : "bg-muted-foreground/30 dark:bg-muted-foreground/40"}`}
                    >
                        <span className={`inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ${form.isCurrentRate ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                </div>

                {/* Derived location (read-only) */}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Province (auto)">
                        <div className={`${inputCls} bg-muted text-[var(--text-muted)]`}>{derivedProvince}</div>
                    </Field>
                    <Field label={isBranchContract ? "City (branch, auto)" : "City (region, auto)"}>
                        <div className={`${inputCls} bg-muted text-[var(--text-muted)]`}>{derivedCity}</div>
                    </Field>
                </div>

                {/* Ex-service yes/no + type */}
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--text)]">Ex-Service</p>
                        <p className="text-xs text-[var(--text-muted)]">Has the guard previously served? If no, the rate is stored as Civilian.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => set("exServiceYes", !form.exServiceYes)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.exServiceYes ? "bg-green-500" : "bg-muted-foreground/30 dark:bg-muted-foreground/40"}`}
                    >
                        <span className={`inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ${form.exServiceYes ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {form.exServiceYes && (
                        <Field label="Ex-Service Type *">
                            <select value={form.exServiceType} onChange={(e) => set("exServiceType", e.target.value)} className={inputCls}>
                                {exServiceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                    )}
                    <Field label="Guard Type *">
                        <select value={form.guardType} onChange={(e) => set("guardType", e.target.value)} className={inputCls}>
                            {guardTypes.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </Field>
                    <Field label="Rate Start Date">
                        <input type="date" value={form.rateStartDate} onChange={(e) => set("rateStartDate", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Rate End Date">
                        <input type="date" value={form.rateEndDate} onChange={(e) => set("rateEndDate", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Effective Rate (PKR) *">
                        <input type="number" value={form.rate} onChange={(e) => set("rate", e.target.value)} placeholder="e.g. 40000" className={inputCls} />
                    </Field>
                    <Field label="Extra Hour Rate (PKR/hr)">
                        <input type="number" value={form.extraHourRate} onChange={(e) => set("extraHourRate", e.target.value)} placeholder="e.g. 500" className={inputCls} />
                    </Field>
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="ui-btn ui-btn-secondary">Cancel</button>
                    <button onClick={submit} disabled={loading} className="ui-btn ui-btn-primary">
                        {loading ? "Adding…" : "Add Rate"}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
```

- [ ] **Step 4: Thread client geo through ContractCard**

In the `ContractCard` function signature/props, add `operationalProvinces` and `regionName`:

```tsx
function ContractCard({
    contract, clientId, operationalProvinces, regionName, guardTypes, exServiceTypes, onContractUpdated, onRateAdded, onRatesUpdated,
}: {
    contract: Contract
    clientId: string
    operationalProvinces: string | null
    regionName: string | null
    guardTypes: string[]
    exServiceTypes: string[]
    onContractUpdated: (c: Contract) => void
    onRateAdded: (contractId: string, rate: ContractRate) => void
    onRatesUpdated: (contractId: string, rates: ContractRate[]) => void
}) {
```

Update the `<AddRateModal ... />` render inside `ContractCard` to pass branch + geo:

```tsx
                <AddRateModal
                    clientId={clientId}
                    contractId={contract.id}
                    branch={contract.branch ? { province: contract.branch.province, city: contract.branch.city } : null}
                    operationalProvinces={operationalProvinces}
                    regionName={regionName}
                    guardTypes={guardTypes}
                    exServiceTypes={exServiceTypes}
                    onClose={() => setShowAddRate(false)}
                    onCreated={(rate) => { onRateAdded(contract.id, rate); setShowAddRate(false) }}
                />
```

- [ ] **Step 5: Pass geo from PricingManager into ContractCard**

In the main `PricingManager` component, accept the new props in the signature:

```tsx
export default function PricingManager({ clientId, clientName, branches, isBranchless, operationalProvinces, regionName }: Props) {
```

And pass them to each `<ContractCard ... />` (in the `filtered.map(...)`):

```tsx
                        <ContractCard
                            key={contract.id}
                            contract={contract}
                            clientId={clientId}
                            operationalProvinces={operationalProvinces}
                            regionName={regionName}
                            guardTypes={guardTypes}
                            exServiceTypes={exServiceTypes}
                            onContractUpdated={onContractUpdated}
                            onRateAdded={onRateAdded}
                            onRatesUpdated={onRatesUpdated}
                        />
```

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "PricingManager.tsx|clients/\[id\]/page.tsx" || echo "task7 clean"`
Expected: `task7 clean`.

Run: `npm run lint 2>&1 | grep -E "PricingManager.tsx" || echo "no new lint in PricingManager"`
Expected: `no new lint in PricingManager` (the removed `PROVINCE_OPTIONS`/`CITY_OPTIONS` must not leave unused references).

---

## Task 8: Full verification

- [ ] **Step 1: Pure-logic tests**

Run: `npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/test-rate-selection.ts`
Expected: `rateSelection tests OK`.

- [ ] **Step 2: Whole-project type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint budget**

Run: `npm run lint:json && npm run lint:guard`
Expected: lint guard passes (no new errors over baseline).

- [ ] **Step 4: Manual smoke checklist** (record results; do not auto-commit)

1. Client detail → Pricing tab: add a **client-level** contract; open *Add Rate* — Province shows the client's operational province, City shows the client's region (city), both read-only. Toggle Ex-Service off → save → row shows `CIVILIAN`. Toggle on → pick ARMY → save → row shows `ARMY`.
2. Add a **branch-specific** contract; *Add Rate* shows that branch's province/city.
3. Generate/auto-fill an invoice for a client+month with deployments where the guard's `exServiceType` matches a rate → line uses that rate. Civilian guard → matches the `CIVILIAN` rate.
4. A branch with a branch-specific contract bills from the branch rate, not the client-level one.

- [ ] **Step 5: Hand off for commit**

Report results to the user. The user commits on `main`.

---

## Self-Review Notes

- **Spec coverage:** A=Task 7; B=Tasks 5,6,7; C=Tasks 1,2,3,4; D=Task 5; E=Task 1 (+ smoke in Task 8). All spec sections mapped.
- **Refinement vs spec §4.C step 4:** province matching treats a *blank* `rate.province` as a wildcard (set province must match exactly), mirroring the city rule. This is a graceful superset of the spec's "province exact" and avoids dead legacy/"All Pakistan" rows. Behaviorally identical when province is always derived (the new normal).
- **guardType:** retained as a required column + UI label (no schema change); removed only from *selection* and from the `buildLines`/`auto-fill` aggregation where it was an unused input.
- **Type consistency:** `CandidateRate`, `resolveContractRateContext`, `toRateLookup`, `selectContractRate`, `resolveBillingExService`, `resolveBillingGeo` signatures are identical across rates.ts/buildLines.ts/auto-fill.ts and the test.
- **Out of scope (unchanged):** auto-provisioning client-level contracts; de-duplicating buildLines vs auto-fill; removing guardType from schema; migrating legacy rate rows (billing warns rather than mis-bills).
