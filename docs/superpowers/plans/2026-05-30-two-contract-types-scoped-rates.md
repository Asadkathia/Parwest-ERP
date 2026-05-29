# Two Contract Types + Scoped Rates + Province Tier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `ClientContract` a `billingMode` (MANUAL = scoped standard rates with 4 location tiers; DYNAMIC = per-enrolled-guard rates), introduce a real Province tier on the Region entity, and make billing resolve rates deterministically by scope. Both types bill `deployment days × daily rate` monthly.

**Architecture:** Evolve `ClientContractRate` in place with explicit scope columns (MANUAL); add a new `ContractGuardRate` table (DYNAMIC). Province becomes an enum tagged on `Region`; branch province is derived. The invoicing rate lookup branches on `billingMode`. Migration is ordered so the app deploys before the DB unique-index swap.

**Tech Stack:** Next.js 14, Prisma + `@prisma/adapter-pg` (Neon Postgres), TypeScript, React + shadcn UI. **Tests:** the repo has NO vitest/jest — pure-logic tests are standalone `node:assert/strict` scripts under `scripts/`, run with `node scripts/<name>.ts` (Node 25 strips TS types). Pattern: `scripts/test-rate-selection.ts`. All test steps below follow that pattern, NOT vitest.

**Spec:** `docs/superpowers/specs/2026-05-29-scoped-contract-rates-design.md`

**Conventions (must follow):** API helpers `@/lib/api/response`; auth via `auth()` + `hasAction`; scope via `checkClientScope` (`@/lib/clients/access.ts`); audit via `safeAuditLog` (target fields); shadcn primitives; toasts read `data.message`. Do NOT run `prisma migrate deploy` against prod inside steps — create migration files; the human applies them (mirrors `scripts/inspect-dup-current-rates.mjs` dry-run pattern). Run `npx tsc --noEmit` (ignore stale `.next/` errors) + `npx eslint <changed>` after each code task.

---

## File map

- `prisma/schema.prisma` — `Province` enum, `Region.province`, `BillingMode` enum, `ClientContract.billingMode`, scope columns on `ClientContractRate`, new `ContractGuardRate` model.
- `prisma/migrations/<ts>_province_tier/` — province enum + Region column + backfill.
- `prisma/migrations/<ts>_contract_billing_mode_and_scope/` — billingMode, scope columns, ContractGuardRate, data-migrate rows, index swap, drop legacy cols.
- `src/lib/geo/province.ts` (new) — `Province` constant + `provinceForBranch(db, branchId)`.
- `src/lib/invoicing/rateSelection.ts` — rewrite to scope-specificity resolver (`selectManualScopedRate`) + keep date-window logic.
- `src/lib/invoicing/guardRate.ts` (new) — `selectGuardRate` (DYNAMIC).
- `src/lib/invoicing/rates.ts` — `fromContract` dispatches on `billingMode`.
- `src/app/api/clients/[id]/contracts/route.ts` — accept `billingMode`.
- `src/app/api/clients/[id]/contracts/[contractId]/rates/route.ts` — scope payload (MANUAL).
- `src/app/api/clients/[id]/contracts/[contractId]/guard-rates/route.ts` (new) — DYNAMIC per-guard rates.
- `src/components/clients/PricingManager.tsx` — billingMode toggle, scope picker (MANUAL), enrolled-guard list (DYNAMIC).
- `src/app/(dashboard)/clients/branches/[id]/page.tsx` — branch contract entry point.

---

## Phase 0 — Province tier

### Task 1: Add `Province` enum + `Region.province`

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/<ts>_province_tier/migration.sql`

- [ ] **Step 1: Edit schema** — add enum + column:

```prisma
enum Province {
  PUNJAB
  SINDH
  KPK
  BALOCHISTAN
  ICT
  AJK
  GILGIT_BALTISTAN
}

model Region {
  // ...existing fields...
  province Province?
}
```

- [ ] **Step 2: Generate migration SQL (do not apply)** — create `migration.sql`:

```sql
-- Province tier: enum + nullable column on Region (backfilled below).
CREATE TYPE "Province" AS ENUM
  ('PUNJAB','SINDH','KPK','BALOCHISTAN','ICT','AJK','GILGIT_BALTISTAN');
ALTER TABLE "Region" ADD COLUMN "province" "Province";
```

- [ ] **Step 3: Backfill (separate, data-only block in same migration)** — map existing cities → province. First inspect actual region names (read-only, mirrors `scripts/inspect-dup-current-rates.mjs`): `SELECT id,name FROM "Region";` then emit one UPDATE per region. Template:

```sql
-- Backfill — adjust the name list to the actual Region rows seen in prod.
UPDATE "Region" SET "province"='PUNJAB'      WHERE name IN ('Lahore','Rawalpindi','Faisalabad','Multan','Gujranwala');
UPDATE "Region" SET "province"='SINDH'       WHERE name IN ('Karachi','Hyderabad','Sukkur');
UPDATE "Region" SET "province"='KPK'         WHERE name IN ('Peshawar','Abbottabad','Mardan');
UPDATE "Region" SET "province"='BALOCHISTAN' WHERE name IN ('Quetta');
UPDATE "Region" SET "province"='ICT'         WHERE name IN ('Islamabad');
```

- [ ] **Step 4:** `npx prisma generate` (regen client locally; required before tsc trusts the new field — see CLAUDE.md). Run `npx tsc --noEmit` (ignore stale `.next/`). Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(geo): add Province enum + Region.province with backfill"
```

### Task 2: `provinceForBranch` helper (TDD)

**Files:** Create `src/lib/geo/province.ts`; Create `scripts/test-province.ts`

- [ ] **Step 1: Failing test** (`scripts/test-province.ts`, node:assert pattern):

```ts
import assert from "node:assert/strict"
import { resolveProvinceFromRegion } from "../src/lib/geo/province"

assert.equal(resolveProvinceFromRegion({ province: "PUNJAB" }), "PUNJAB")
assert.equal(resolveProvinceFromRegion(null), null)
assert.equal(resolveProvinceFromRegion({ province: null }), null)
console.log("province tests passed")
```

- [ ] **Step 2: Run, expect FAIL** — `node scripts/test-province.ts` → import/resolve error (function not defined yet).

- [ ] **Step 3: Implement** `src/lib/geo/province.ts`:

```ts
import type { Db } from "@/lib/geo/regionCity" // existing Db type used by cityForBranch

export const PROVINCES = [
  "PUNJAB","SINDH","KPK","BALOCHISTAN","ICT","AJK","GILGIT_BALTISTAN",
] as const
export type Province = (typeof PROVINCES)[number]

export function resolveProvinceFromRegion(
  region: { province: Province | string | null } | null,
): Province | null {
  const p = region?.province
  return p && (PROVINCES as readonly string[]).includes(p) ? (p as Province) : null
}

/** DB lookup: branch -> regionalOffice.region.province (fallback client.region.province). */
export async function provinceForBranch(
  db: Db,
  args: { regionalOfficeId?: string | null; regionId?: string | null; clientId?: string | null },
): Promise<Province | null> {
  if (args.regionalOfficeId) {
    const o = await db.regionalOffice.findUnique({
      where: { id: args.regionalOfficeId },
      select: { region: { select: { province: true } } },
    })
    const p = resolveProvinceFromRegion(o?.region ?? null)
    if (p) return p
  }
  if (args.regionId) {
    const r = await db.region.findUnique({ where: { id: args.regionId }, select: { province: true } })
    const p = resolveProvinceFromRegion(r)
    if (p) return p
  }
  if (args.clientId) {
    const c = await db.client.findUnique({
      where: { id: args.clientId },
      select: { region: { select: { province: true } } },
    })
    return resolveProvinceFromRegion(c?.region ?? null)
  }
  return null
}
```

- [ ] **Step 4: Run, expect PASS** — `node scripts/test-province.ts` → "province tests passed".
- [ ] **Step 5: Commit** — `git commit -am "feat(geo): provinceForBranch + resolveProvinceFromRegion helper"`.

---

## Phase 1 — Schema for two contract types

### Task 3: `billingMode`, scope columns, `ContractGuardRate`

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/<ts>_contract_billing_mode_and_scope/migration.sql`

- [ ] **Step 1: Edit schema** (add, don't remove old cols yet):

```prisma
enum BillingMode { MANUAL DYNAMIC }
enum RateScopeLevel { BRANCH REGION PROVINCE GLOBAL }

model ClientContract {
  // ...existing...
  billingMode BillingMode @default(MANUAL)
}

model ClientContractRate {
  // ...existing rate/extraHourRate/isCurrentRate/dates/guardType/exService...
  scopeLevel    RateScopeLevel? // nullable in this migration; made required in Task 5
  scopeBranchId String?
  scopeRegionId String?
  scopeProvince Province?
  // province/city kept for now; dropped in Task 5
}

model ContractGuardRate {
  id            String   @id @default(cuid())
  contractId    String
  contract      ClientContract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  guardId       String
  guard         Guard    @relation(fields: [guardId], references: [id], onDelete: Cascade)
  rate          Float
  extraHourRate Float?
  isCurrentRate Boolean  @default(true)
  rateStartDate DateTime?
  rateEndDate   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([contractId, guardId])
  @@index([contractId])
  @@index([guardId])
}
```
Add back-relations: `ClientContract.guardRates ContractGuardRate[]` and `Guard.contractGuardRates ContractGuardRate[]`.

- [ ] **Step 2: migration.sql (additive only):**

```sql
CREATE TYPE "BillingMode" AS ENUM ('MANUAL','DYNAMIC');
CREATE TYPE "RateScopeLevel" AS ENUM ('BRANCH','REGION','PROVINCE','GLOBAL');
ALTER TABLE "ClientContract" ADD COLUMN "billingMode" "BillingMode" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ClientContractRate"
  ADD COLUMN "scopeLevel" "RateScopeLevel",
  ADD COLUMN "scopeBranchId" TEXT,
  ADD COLUMN "scopeRegionId" TEXT,
  ADD COLUMN "scopeProvince" "Province";
CREATE TABLE "ContractGuardRate" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL REFERENCES "ClientContract"("id") ON DELETE CASCADE,
  "guardId" TEXT NOT NULL REFERENCES "Guard"("id") ON DELETE CASCADE,
  "rate" DOUBLE PRECISION NOT NULL,
  "extraHourRate" DOUBLE PRECISION,
  "isCurrentRate" BOOLEAN NOT NULL DEFAULT true,
  "rateStartDate" TIMESTAMP(3),
  "rateEndDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ContractGuardRate_contractId_guardId_key" ON "ContractGuardRate"("contractId","guardId");
CREATE INDEX "ContractGuardRate_contractId_idx" ON "ContractGuardRate"("contractId");
CREATE INDEX "ContractGuardRate_guardId_idx" ON "ContractGuardRate"("guardId");
```

- [ ] **Step 3:** `npx prisma generate` → `npx tsc --noEmit` (clean, ignore `.next/`).
- [ ] **Step 4: Commit** — `git commit -am "feat(contracts): add billingMode, rate scope columns, ContractGuardRate"`.

### Task 4: Data-migrate existing rate rows → scope rows

**Files:** Append to `prisma/migrations/<ts>_contract_billing_mode_and_scope/migration.sql`

- [ ] **Step 1: Inspect first (read-only):** run against prod via the inspector pattern: `SELECT r.id, r.province, r.city, c."branchId" FROM "ClientContractRate" r JOIN "ClientContract" c ON c.id=r."contractId";` Confirm the 7 rows' shapes.

- [ ] **Step 2: Append data migration** (deterministic mapping):

```sql
-- Branch-contract rows -> BRANCH scope.
UPDATE "ClientContractRate" r SET "scopeLevel"='BRANCH', "scopeBranchId"=c."branchId"
FROM "ClientContract" c WHERE c.id=r."contractId" AND c."branchId" IS NOT NULL;

-- Client-contract rows with a city -> REGION (match Region by name).
UPDATE "ClientContractRate" r SET "scopeLevel"='REGION', "scopeRegionId"=reg.id
FROM "ClientContract" c JOIN "Region" reg ON LOWER(reg.name)=LOWER(r.city)
WHERE c.id=r."contractId" AND c."branchId" IS NULL AND r.city IS NOT NULL AND r."scopeLevel" IS NULL;

-- Client-contract rows with province only -> PROVINCE (best-effort enum cast; NULL if unmapped, fix manually).
UPDATE "ClientContractRate" r SET "scopeLevel"='PROVINCE',
  "scopeProvince" = CASE UPPER(r.province)
     WHEN 'PUNJAB' THEN 'PUNJAB'::"Province" WHEN 'SINDH' THEN 'SINDH'::"Province"
     WHEN 'KPK' THEN 'KPK'::"Province" WHEN 'BALOCHISTAN' THEN 'BALOCHISTAN'::"Province"
     WHEN 'ICT' THEN 'ICT'::"Province" ELSE NULL END
WHERE r."scopeLevel" IS NULL AND r.province IS NOT NULL AND r.city IS NULL;

-- Remaining client-contract rows -> GLOBAL.
UPDATE "ClientContractRate" SET "scopeLevel"='GLOBAL' WHERE "scopeLevel" IS NULL;
```

- [ ] **Step 3:** Add a verification query to the PR description (not the migration): `SELECT "scopeLevel", count(*) FROM "ClientContractRate" GROUP BY 1;` — expect zero NULL `scopeLevel`.
- [ ] **Step 4: Commit** — `git commit -am "feat(contracts): data-migrate legacy rate rows to scope rows"`.

### Task 5: Enforce scope + swap the unique index

**Files:** Create `prisma/migrations/<ts>_contract_rate_scope_constraints/migration.sql`; Modify `prisma/schema.prisma`

- [ ] **Step 1: Schema** — make `scopeLevel` required; remove `province`/`city` columns from `ClientContractRate`.
- [ ] **Step 2: migration.sql:**

```sql
ALTER TABLE "ClientContractRate" ALTER COLUMN "scopeLevel" SET NOT NULL;

-- exactly one scope target matches the level
ALTER TABLE "ClientContractRate" ADD CONSTRAINT "ccr_scope_target_ck" CHECK (
  ("scopeLevel"='BRANCH'   AND "scopeBranchId" IS NOT NULL AND "scopeRegionId" IS NULL AND "scopeProvince" IS NULL) OR
  ("scopeLevel"='REGION'   AND "scopeRegionId" IS NOT NULL AND "scopeBranchId" IS NULL AND "scopeProvince" IS NULL) OR
  ("scopeLevel"='PROVINCE' AND "scopeProvince" IS NOT NULL AND "scopeBranchId" IS NULL AND "scopeRegionId" IS NULL) OR
  ("scopeLevel"='GLOBAL'   AND "scopeBranchId" IS NULL AND "scopeRegionId" IS NULL AND "scopeProvince" IS NULL)
);

-- swap one-current-rate index from old combo to scope identity
DROP INDEX IF EXISTS "ClientContractRate_current_combo_key";
CREATE UNIQUE INDEX "ClientContractRate_current_scope_key"
  ON "ClientContractRate" (
    "contractId", "scopeLevel",
    COALESCE("scopeBranchId",''), COALESCE("scopeRegionId",''),
    COALESCE("scopeProvince"::text,'')
  ) WHERE "isCurrentRate" = true;

ALTER TABLE "ClientContractRate" DROP COLUMN "province", DROP COLUMN "city";
```

- [ ] **Step 3:** `npx prisma generate` → `npx tsc --noEmit`. (Type errors in `rateSelection.ts` referencing `province`/`city` are EXPECTED — fixed in Phase 2; this task is schema-only, do not fix code here.) Note: this migration is applied LAST, after app deploy (see §8 of spec).
- [ ] **Step 4: Commit** — `git commit -am "feat(contracts): enforce scope CHECK + swap one-current-rate index to scope key"`.

---

## Phase 2 — Rate resolution (TDD)

### Task 6: MANUAL scope-specificity resolver

**Files:** Modify `src/lib/invoicing/rateSelection.ts`; Create `scripts/test-manual-scope.ts`

- [ ] **Step 1: Failing tests** (`scripts/test-manual-scope.ts`, node:assert pattern):

```ts
import assert from "node:assert/strict"
import { selectManualScopedRate, type ScopedRate } from "../src/lib/invoicing/rateSelection"

const base = { rate: 0, extraHourRate: null, isCurrentRate: true, rateStartDate: null, rateEndDate: null }
const branch: ScopedRate   = { ...base, id: "b", scopeLevel: "BRANCH",   scopeBranchId: "B1", scopeRegionId: null, scopeProvince: null, rate: 100 }
const region: ScopedRate   = { ...base, id: "r", scopeLevel: "REGION",   scopeBranchId: null, scopeRegionId: "R1", scopeProvince: null, rate: 200 }
const province: ScopedRate = { ...base, id: "p", scopeLevel: "PROVINCE", scopeBranchId: null, scopeRegionId: null, scopeProvince: "PUNJAB", rate: 300 }
const global: ScopedRate   = { ...base, id: "g", scopeLevel: "GLOBAL",   scopeBranchId: null, scopeRegionId: null, scopeProvince: null, rate: 400 }
const ctx = { branchId: "B1", regionId: "R1", province: "PUNJAB", asOf: new Date("2026-05-15") }

assert.equal(selectManualScopedRate([global, province, region, branch], ctx)?.rate, 100) // branch wins
assert.equal(selectManualScopedRate([global, province, region], ctx)?.rate, 200)         // region
assert.equal(selectManualScopedRate([global, province], ctx)?.rate, 300)                 // province
assert.equal(selectManualScopedRate([global], ctx)?.rate, 400)                           // global
assert.equal(selectManualScopedRate([{ ...branch, rateStartDate: new Date("2026-09-01") }, region], ctx)?.rate, 200) // out-of-window branch skipped
assert.equal(selectManualScopedRate([{ ...branch, scopeBranchId: "OTHER" }], ctx), null) // no match
console.log("manual scope resolver tests passed")
```

- [ ] **Step 2: Run, expect FAIL** — `node scripts/test-manual-scope.ts` → import/resolve error.

- [ ] **Step 3: Implement** — add to `rateSelection.ts` (keep `resolveBillingExService`; replace the province/city `selectContractRate` body or add the new fn and deprecate the old):

```ts
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
    (r) => r.scopeLevel === "BRANCH"   && !!ctx.branchId  && r.scopeBranchId === ctx.branchId,
    (r) => r.scopeLevel === "REGION"   && !!ctx.regionId  && r.scopeRegionId === ctx.regionId,
    (r) => r.scopeLevel === "PROVINCE" && !!ctx.province  && r.scopeProvince === ctx.province,
    (r) => r.scopeLevel === "GLOBAL",
  ]
  for (const matches of matchers) {
    const hit = rates.filter((r) => matches(r) && inWindow(r, t))
      .sort((a, b) => Number(b.isCurrentRate) - Number(a.isCurrentRate) || (a.id < b.id ? -1 : 1))[0]
    if (hit) return hit
  }
  return null
}
```

- [ ] **Step 4: Run, expect PASS** — `node scripts/test-manual-scope.ts`.
- [ ] **Step 5: Commit** — `git commit -am "feat(invoicing): scope-specificity rate resolver (manual contracts)"`.

### Task 7: DYNAMIC per-guard resolver

**Files:** Create `src/lib/invoicing/guardRate.ts`; Create `scripts/test-guard-rate.ts`

- [ ] **Step 1: Failing test** (`scripts/test-guard-rate.ts`, node:assert pattern):

```ts
import assert from "node:assert/strict"
import { selectGuardRate, type GuardRate } from "../src/lib/invoicing/guardRate"
const r = (id: string, guardId: string, rate: number, cur = true): GuardRate =>
  ({ id, guardId, rate, extraHourRate: null, isCurrentRate: cur, rateStartDate: null, rateEndDate: null })

assert.equal(selectGuardRate([r("1","G1",100), r("2","G2",200)], "G1", new Date())?.rate, 100)
assert.equal(selectGuardRate([r("1","G1",100)], "G9", new Date()), null)
console.log("guard rate resolver tests passed")
```

- [ ] **Step 2: Run, expect FAIL** — `node scripts/test-guard-rate.ts`.
- [ ] **Step 3: Implement** `guardRate.ts`:

```ts
export type GuardRate = {
  id: string; guardId: string; rate: number; extraHourRate: number | null
  isCurrentRate: boolean; rateStartDate: Date | null; rateEndDate: Date | null
}
export function selectGuardRate(rates: GuardRate[], guardId: string, asOf: Date): GuardRate | null {
  const t = asOf.getTime()
  return rates.filter((r) =>
    r.guardId === guardId &&
    (!r.rateStartDate || r.rateStartDate.getTime() <= t) &&
    (!r.rateEndDate || r.rateEndDate.getTime() >= t),
  ).sort((a, b) => Number(b.isCurrentRate) - Number(a.isCurrentRate) || (a.id < b.id ? -1 : 1))[0] ?? null
}
```

- [ ] **Step 4: Run, expect PASS** — `node scripts/test-guard-rate.ts`.
- [ ] **Step 5: Commit** — `git commit -am "feat(invoicing): per-guard rate resolver (dynamic contracts)"`.

### Task 8: Dispatch by `billingMode` in `rates.ts`

**Files:** Modify `src/lib/invoicing/rates.ts`

- [ ] **Step 1:** Update `resolveContractRateContext` to also `select { billingMode: true }` on the contract, and load `ContractGuardRate` rows when `DYNAMIC`, scoped `ClientContractRate` rows when `MANUAL`. Resolve the branch's `{regionId, province}` via `cityForBranch`/`provinceForBranch`.
- [ ] **Step 2:** In `fromContract`, branch:
```ts
if (mode === "DYNAMIC") return toRateLookup(selectGuardRate(guardRates, args.guardId, args.asOf), contractId)
return toRateLookup(selectManualScopedRate(scopedRates, { branchId, regionId, province, asOf: args.asOf }), contractId)
```
Add `guardId` to `fromContract` args (callers in `buildLines.ts` already iterate per guard — pass `deployment.guardId`).
- [ ] **Step 3:** `npx tsc --noEmit` clean (this resolves the expected Task 5 type errors). Run all logic tests: `node scripts/test-manual-scope.ts && node scripts/test-guard-rate.ts && node scripts/test-rate-selection.ts`.
- [ ] **Step 4: Commit** — `git commit -am "feat(invoicing): dispatch rate lookup by contract billingMode"`.

---

## Phase 3 — API

### Task 9: Contract create accepts `billingMode`

**Files:** Modify `src/app/api/clients/[id]/contracts/route.ts`

- [ ] **Step 1:** In POST, read `billingMode` (validate `MANUAL`|`DYNAMIC`, default `MANUAL`), persist it. Keep `endDate ≥ startDate+1d` validation + `safeAuditLog` target fields.
- [ ] **Step 2:** `npx tsc --noEmit` + eslint clean.
- [ ] **Step 3: Commit** — `git commit -am "feat(api): contract create accepts billingMode"`.

### Task 10: MANUAL scoped-rate route

**Files:** Modify `src/app/api/clients/[id]/contracts/[contractId]/rates/route.ts`

- [ ] **Step 1:** Replace derived province/city write with explicit scope payload: accept `{ scopeLevel, scopeBranchId?, scopeRegionId?, scopeProvince?, rate, extraHourRate?, guardType?, exService?, isCurrentRate, rateStartDate?, rateEndDate? }`. Validate exactly one target matches `scopeLevel` (mirror the DB CHECK). For BRANCH/REGION verify the target belongs to this client (IDOR guard, like the existing branch check). Keep demote-before-create (re-keyed to the scope combo) + `P2002 → conflict` + `safeAuditLog`.
- [ ] **Step 2:** `npx tsc --noEmit` + eslint clean.
- [ ] **Step 3: Commit** — `git commit -am "feat(api): manual contract rates keyed by explicit scope"`.

### Task 11: DYNAMIC guard-rate route

**Files:** Create `src/app/api/clients/[id]/contracts/[contractId]/guard-rates/route.ts`

- [ ] **Step 1:** `GET` lists the client's enrolled/deployed guards joined with any existing `ContractGuardRate` (so the UI shows guard + current rate). `POST`/`PATCH` upserts `{ guardId, rate, extraHourRate? }`. Auth `hasAction(CLIENTS, CREATE|UPDATE)` + `checkClientScope` + verify the contract is `DYNAMIC` and belongs to `clientId` (IDOR) + verify guard is enrolled under this client. `safeAuditLog` target `Client`.
- [ ] **Step 2:** `npx tsc --noEmit` + eslint clean.
- [ ] **Step 3: Commit** — `git commit -am "feat(api): dynamic contract per-guard rates endpoint"`.

---

## Phase 4 — UI

### Task 12: PricingManager — billingMode + scope picker + guard list

**Files:** Modify `src/components/clients/PricingManager.tsx`

- [ ] **Step 1:** `ContractFormModal`: add a `billingMode` select (Manual / Dynamic), default Manual; send in the create payload.
- [ ] **Step 2:** Render rate UI by the contract's `billingMode`:
  - **MANUAL:** replace the auto province/city display in `AddRateModal` with a **Scope picker** — `scopeLevel` select; when REGION show a Region dropdown (client's regions), when PROVINCE a Province dropdown (the `PROVINCES` constant), when GLOBAL no target, when BRANCH the branch is implied by a branch contract. Post the scope payload to the Task 10 route. Keep guardType (label, from the system guard-type list) + ex-service (label) + manual rate + extraHourRate + isCurrentRate.
  - **DYNAMIC:** a table of enrolled guards (from the Task 11 `GET`) with an editable rate (+ extraHourRate) per row; save via the Task 11 `POST`/`PATCH`.
- [ ] **Step 3:** `npx tsc --noEmit` + eslint clean; manual smoke per `/run` if available.
- [ ] **Step 4: Commit** — `git commit -am "feat(clients): PricingManager billingMode + scope picker + dynamic guard rates"`.

### Task 13: Branch contract entry on branches page

**Files:** Modify `src/app/(dashboard)/clients/branches/[id]/page.tsx`

- [ ] **Step 1:** Add an entry point (button → modal or link) to create/manage that branch's BRANCH-scope contract + rates, reusing the PricingManager primitives scoped to `branchId`. Permission-gate via `PermissionGate module="CLIENTS" action="CREATE"`.
- [ ] **Step 2:** `npx tsc --noEmit` + eslint clean.
- [ ] **Step 3: Commit** — `git commit -am "feat(clients): branch-page entry for branch-scoped contracts"`.

---

## Phase 5 — Verify & ship

### Task 14: Parity + full gate

- [ ] **Step 1:** `node scripts/test-province.ts && node scripts/test-manual-scope.ts && node scripts/test-guard-rate.ts && node scripts/test-rate-selection.ts` — all pass.
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep -v "^.next/" | grep "error TS"` — zero.
- [ ] **Step 3:** `npx eslint <all changed files>` — clean.
- [ ] **Step 4: Parity check** — pick a recent month; before the index swap, snapshot `generate-monthly` output (dry run / preview) for a sample client; after deploy, re-run; diff totals. Expected differences only where: (a) scope-specificity changes which rate applies, (b) ex-service no longer changes the rate. Document the diff in the PR.
- [ ] **Step 5:** Update `CLAUDE.md` (clients section) — note `billingMode`, the scope model, `ContractGuardRate`, the new index name, and that province lives on `Region`.
- [ ] **Step 6: Commit** — `git commit -am "docs/test: parity check + CLAUDE.md for two-type contracts"`.

### Deploy ordering (human-run, NOT in a step)

1. Merge + deploy app (Tasks 1–14) — resolver/UI/validation live, reading new columns; old index still present is harmless.
2. Apply migrations in order: `province_tier` → `contract_billing_mode_and_scope` (incl. data migrate) → **verify zero NULL `scopeLevel`** → `contract_rate_scope_constraints` (CHECK + index swap + drop legacy cols).
3. Post-deploy: run the parity check on the next monthly invoice run.

---

## Self-review notes

- **Spec coverage:** Province (T1–2), billingMode (T3,9), scope cols + ContractGuardRate (T3), data migrate (T4), CHECK + index swap (T5), MANUAL resolver (T6), DYNAMIC resolver (T7), dispatch (T8), APIs (T9–11), UI (T12–13), parity/migration ordering (T14 + deploy). ✓
- **Open items the executor must surface, not guess:** the Region→Province backfill name list (T1 step 3) and the legacy-row mapping (T4) must be built from the actual prod rows via the read-only inspector before applying.
- **Test runner (confirmed):** no vitest/jest in the repo; tests are standalone `node:assert/strict` scripts run via `node scripts/<name>.ts` (Node 25 strips TS types), per `scripts/test-rate-selection.ts`. All test steps above use this pattern.
