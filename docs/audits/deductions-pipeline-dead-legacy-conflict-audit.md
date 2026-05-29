# Deductions Pipeline — Dead / Legacy / Conflicting-Logic Audit

**Module:** DEDUCTIONS (calculation/resolver pipeline + trigger endpoints + override + enrollments + legacy-system question)
**Mode:** Read-only forensic audit. No source modified.
**Method:** graphify graph index (built 2026-04-28) used for routing; every "dead"/"live" claim proven with repo-wide grep of real call sites. Graphify importer counts treated as unreliable for string-fetched API routes.
**Scope boundary:** Rate-table CRUD (`api/deductions/*-rates|*-plans|*-tiers`, `routeFactory.ts`, `rates.ts` propose/approve/supersede) was cleared by the Settings audit — only its *consumption* by the resolver side is reviewed here. Payroll calc/state/loans owned by the parallel Payroll agent.

---

## (1) Legacy-vs-canonical verdict — `payroll/other-deductions` + `deduction-types`

| Surface | Verdict | Proof |
|---|---|---|
| `api/payroll/other-deductions/route.ts` (GET/POST) | **LEGACY-but-LIVE, writes to canonical SoT via wrong path** | Wired into nav (`src/lib/navigation/items.ts:93` → `/payroll/other-deductions`) and `PayrollOtherDeductionsManager.tsx` POSTs to it (`:165`). It does NOT write a legacy float — it upserts a `PayrollDeductionEntry` under code **`OTHER`** then recalcs. So it is *not* a parallel deduction system; it is a thin manual-entry front-end onto the canonical entry table. **However** it writes the entry with `isOverride=false`, which makes the amount non-durable across recompute (see CONFLICT #1). |
| `api/payroll/other-deductions/[id]/route.ts` (PATCH/DELETE) | **DEAD + DIVERGENT-CODE** | No caller anywhere (`grep` for `other-deductions/${`/PATCH/DELETE in `src` outside `api/` returns nothing). Worse, it reads/writes code **`MISC`** (`:19 MISC_CODE = "MISC"`) and `upsert`s a brand-new `MISC` deduction type that is **not seeded** (migration seeds `OTHER` only — `prisma/migrations/20260506100000_deductions_policy/migration.sql:523`). If ever invoked it would mint a *second* "Other Deductions" type, splitting manual deductions across two type ids. |
| `api/payroll/deduction-types/route.ts` (+`[id]`) | **LIVE, canonical metadata CRUD** | Consumed by `src/app/(dashboard)/payroll/settings/deductions-manager.tsx:73,110,141,163`. Manages `PayrollDeductionType` rows (the type catalogue the resolver dispatches on). Not a deduction-writing system — keep. Minor: lets users create free-form codes that have no resolver (see DRIFT). |

**Bottom line:** There is **no live parallel deduction-writing system**. The old float columns are gone and `other-deductions` POST routes through `PayrollDeductionEntry`. The legacy debt is (a) a **dead, code-divergent `[id]` sub-route** and (b) a **durability bug** in how the live POST records the OTHER entry.

---

## (2) Code ↔ resolver completeness table

Dispatch source: `src/lib/deductions/index.ts:97-137` (`switch (t.code)`). Seeded types: migration `:513-523`.

| Code (seeded) | Resolver | Dispatched? | Rate / data source | Status |
|---|---|---|---|---|
| APSAA | `resolveApsaa` | ✅ | `ApsaaBranchRate` (per-branch, effective-dated) via `resolveApsaaBranchRate` | OK (label `CLIENT_BRANCH_RATE` is cosmetic — does NOT read invoicing; see domain note) |
| CWF | `resolveCwf` | ✅ | `CwfRegionRate` (per-region) | OK |
| ADVANCE_SALARY | `resolveAdvanceSalary` | ✅ | `AdvanceSalaryRecovery` PENDING rows | OK (no PAID transition — see CONFLICT #4) |
| UNIFORM | `resolveUniform` | ✅ | `UniformInstallment` + `UniformResignationRecovery` PENDING | OK (no PAID transition) |
| APSAA_PUNJAB | `resolveApsaaPunjab` | ✅ | `ApsaaPunjabRate` (global) | OK |
| NIGHT_CALL | `resolveNightCall` | ✅ | `NightCallDeduction` PENDING + `NightCallRule` | OK (rule lookup uses month; ingest does not — see CONFLICT #5) |
| ABSENT | `resolveAbsent` | ✅ | `Attendance` status="ABSENT" | DRIFT — hardcoded `status:"ABSENT"` string assumption; resolver header admits "adjust when wiring against actual schema" |
| EOBI | `resolveEobi` | ✅ | `EobiRate` + `EobiEnrollment.isActive` gate | OK |
| ESSI | `resolveEssi` | ✅ | `EssiRate` + `EssiEnrollment.isActive` gate | OK |
| TRAINING_SCHOOL_FEES | `resolveTrainingSchoolFees` | ✅ | `TrainingSchoolFeeInstallment` PENDING | OK (no PAID transition) |
| OTHER | *default branch* (`index.ts:128-136`) | ✅ (falls through) | `defaultAmount` (=0) | **CONFLICT #1** — manual `amount` is wiped to 0 on recompute |
| *any user-created code* | *default branch* | ✅ (falls through) | `defaultAmount` | DRIFT — see below |

**Every canonical code has exactly one resolver and is dispatched. No resolver is undispatched (dead).** The only "missing resolver" case is OTHER/custom codes, which intentionally use the default branch — but that branch is the source of the durability bug.

**Stale seed drift:** `scripts/seed-payroll-deduction-types.ts:18` seeds `TRAINING_FEE` (not `TRAINING_SCHOOL_FEES`) and a duplicate `CWF/EOBI/ESSI` set with no `rateSource`/`isPolicyManaged`. This pre-canonical script, if run after the migration, creates an orphan `TRAINING_FEE` type that has **no resolver** (silently 0) and duplicate-looking rows. It is a manual dev script (not in build/CI), so LEGACY-dead, not active — but it is a foot-gun.

---

## Findings by submodule

### src/app/api/payroll/other-deductions/route.ts:172-189 — [CONFLICT] 🔴
**What:** Manual "other deduction" is persisted as a `PayrollDeductionEntry` with `isOverride` left at its default (`false`).
**Evidence:** POST upserts `{ amount, notes }` only (`:179-189`); never sets `isOverride`. Recompute path: `index.ts:140` → `amount = existing.isOverride ? existing.amount : resolved.computedAmount`. For OTHER, `resolved.computedAmount = defaultAmount = 0` (default branch, `index.ts:128-136`; seeded `defaultAmount=0`). `persist.ts:167-173` then writes `amount: entry.amount` (=0) for non-override rows.
**Impact:** Any subsequent recompute of that guard/month — triggered by a retroactive rate approval (`rates.ts:407` → `recompute.ts`), an extra-hours/loan edit, a salary recalc, or the very next `other-deductions` POST for a *different* field — **silently zeroes the manually-entered Other deduction**. The amount the operator typed is lost; net pay silently increases. This is a Single-Source-of-Truth durability violation.
**Recommended fix (root cause):** Manual OTHER entries must be recorded as overrides so they survive recompute. In the POST/PATCH set `isOverride=true` + `overrideReason`/`overrideBy*`, OR make the OTHER resolver read the persisted manual entry as its `computedAmount` (treat the entry itself as the source). The override path is the cleaner of the two because it already has dedicated preservation logic in `persist.ts:133-148`. Co-change: the `[id]` route (if revived) and `PayrollOtherDeductionsManager` would inherit the fix automatically once OTHER entries are override-flagged.

### src/app/api/payroll/other-deductions/[id]/route.ts (whole file) — [DEAD + LEGACY] 🔴
**What:** PATCH/DELETE sub-route, orphaned and operating on a non-canonical code.
**Evidence:** (a) No caller — `grep -rn "other-deductions/\${" src` (outside `api/`) = empty; `PayrollOtherDeductionsManager.tsx` only calls GET (`:120`) and POST (`:165`), never PATCH/DELETE on `/[id]`. (b) Uses `MISC_CODE = "MISC"` (`:19`) and `upsert`s a `MISC` type (`:65-75`) that is not seeded by the canonical migration (only `OTHER` exists, migration `:523`).
**Impact:** Dead code today. If ever wired, it forks manual deductions into a phantom `MISC` type → divergent totals, two "Other Deductions" rows on the slip, and the same `isOverride=false` durability bug. The `OTHER` (POST route) vs `MISC` (this route) split is a latent data-integrity landmine.
**Recommended fix:** Delete this file. The POST route's upsert is already keyed on the canonical `OTHER` entry, so a single PATCH/DELETE (if needed) belongs on `OTHER`, not `MISC`. If editable history of manual deductions is wanted, route it through the canonical override endpoint instead.

### scripts/seed-payroll-deduction-types.ts:17-22 — [LEGACY/DEAD] 🟠
**What:** Pre-canonical seed script with divergent codes.
**Evidence:** Seeds `TRAINING_FEE` (resolver dispatches on `TRAINING_SCHOOL_FEES` — `index.ts:113`), plus `CWF/EOBI/ESSI` with no `rateSource`/`isPolicyManaged`. Header references "payroll_rework_phase1 migration," superseded by `20260506100000_deductions_policy`.
**Impact:** Not in CI/build, so inert. But running it after the policy migration creates an orphan `TRAINING_FEE` type that the resolver silently treats as a default-branch (0-amount) line, and duplicate-looking CWF/EOBI/ESSI metadata.
**Recommended fix:** Delete the script (the migration `:510-530` is now the canonical idempotent seed) or rewrite it to upsert the canonical 11 codes with correct `rateSource`/`isPolicyManaged`.

### src/lib/deductions/{installments.ts, resolvers.ts}, advance-salary/uniform/training issuance routes — [CONFLICT] 🔴 (lifecycle gap)
**What:** Installment / recovery / night-call rows are created and read-as-PENDING but **never transitioned out of PENDING**. There is no "consumed/paid" state.
**Evidence:** `grep` for any `.update`/`status:"PAID"`/`deleteMany` on `uniformInstallment|trainingSchoolFeeInstallment|advanceSalaryRecovery|nightCallDeduction|uniformResignationRecovery` returns ONLY `create`/`createMany`/`upsert` (issuance routes + `resignation.ts:94`). Every resolver filters `status:"PENDING"` (`resolvers.ts:272,306,322,368,423`).
**Impact:** (a) **No completion detection** — `UniformInstallment.status` etc. are dead enum states; an installment plan is never "finished," cannot be reported as paid, and a guard's outstanding balance cannot be computed from status. (b) Because resolvers also filter on **exact `payrollMonth == monthStart`**, a row is only ever pulled for its scheduled month, so this does NOT double-charge across months — *but* if a guard's payroll for the scheduled month is never run (guard skipped that month, joined/left mid-plan), that installment is **silently dropped forever** (never re-attempted, never marked missed). (c) When a payroll is finalized/paid, the rows that funded it stay PENDING, so any audit/reconciliation reading "PENDING = owed" overstates liabilities.
**Recommended fix (root cause):** Add a lifecycle transition in `persist.ts` (or a dedicated `markDeductionsConsumed` step) that, when a payroll moves to PAID/finalized, stamps the contributing installment/recovery/night-call rows to a terminal status (e.g. `PAID`) keyed by the breakdown ids already captured in `PayrollDeductionEntry.breakdown`. Pair with a carry-forward rule for missed months (re-target PENDING rows whose scheduled month has passed without a payroll). This is the single biggest structural gap in the pipeline.

### src/app/api/deductions/uniform/issuances/route.ts:71-108 — [CONFLICT] 🟠 (non-idempotent despite claim)
**What:** Header says "Idempotent on (guardId, issuedOn) within the same UniformPlan version" but there is **no uniqueness check**.
**Evidence:** Unconditional `trx.uniformIssuance.create` (`:72`) + `createMany` of installments (`:95`). No `findFirst`/`upsert` guard on `(guardId, issuedOn, uniformPlanId)`.
**Impact:** A double-submit / retried POST creates two issuances and **two parallel installment schedules** → guard double-charged the uniform cost. The same applies to `training-school-fees/issuances/route.ts:76-108` and `advance-salary/route.ts:104-124` (also create-only, also claim idempotency in their headers).
**Recommended fix:** Add a real idempotency guard: either a unique constraint on `(guardId, issuedOn, planId)` + `upsert`, or an explicit `findFirst` precheck returning the existing issuance. Same fix for training-school-fees and advance-salary. (Night-call ingest IS genuinely idempotent — it upserts on `guardId_date_type`, `:139-161`.)

### src/app/api/deductions/night-call/logs/route.ts:114-121 — [CONFLICT] 🟠
**What:** (a) Rule is resolved for `new Date()` (today), not the month of the affected logs; (b) when no active rule exists it falls back to **hardcoded constants** (`twoMissedDeduction:1`, etc.).
**Evidence:** `const ruleAtNow = await resolveNightCallRule(prisma, new Date())` (`:114`); `const rule = ruleAtNow ?? { id:null, twoMissedDeduction:1, ... }` (`:115-121`).
**Impact:** (a) Ingesting back-dated logs (a prior month) applies the *current* rule version, not the rule effective in the log's month → wrong day-counts for retroactive ingest, and a mismatch versus the resolver (`resolveNightCall` correctly uses `ctx.monthStart`, `resolvers.ts:403`). (b) The hardcoded fallback violates the repo-wide "no hardcoded data fallbacks / no silent constants" rule (CLAUDE.md) — it silently fabricates deduction policy when none is approved, exactly the failure mode every rate resolver was written to avoid (`resolveRate.ts` returns null + MISSING_RATE warning instead).
**Recommended fix:** Resolve the night-call rule per affected log-day/month (mirror `resolveNightCall`). If no active rule, **skip emission with a warning** (do not fabricate a default rule), consistent with `resolveRate.ts`.

### src/lib/deductions/recompute.ts:59-80 — [DRIFT] 🟠
**What:** Retroactive recompute scopes only `ApsaaBranchRate` (by `Deployment.branchId`) and `CwfRegionRate` (by `regionId`); all other tables fall into the "global — every payroll in month range" branch.
**Evidence:** `recompute.ts:59-80`. `UniformPlan`/`UniformResignationTier`/`NightCallRule`/`EobiRate`/`EssiRate`/`ApsaaPunjabRate` hit the `else` branch.
**Impact:** Two sub-issues. (1) **Over-scope:** an EOBI/ESSI rate change recomputes *every* payroll in the window, including guards not enrolled — wasteful but not wrong (resolver re-gates on enrollment). (2) **Under-effect for snapshot tables:** a retroactive `UniformPlan` amount change recomputes payrolls but resolvers re-read already-spawned `UniformInstallment` rows whose `amount` was snapshotted at issuance — so the new plan amount is NOT applied to in-flight installments. That may be intended (plans snapshot on issuance) but it means "retroactive UniformPlan approval" silently has no effect on existing schedules, which is surprising and undocumented.
**Recommended fix:** Document the snapshot-vs-recompute semantics explicitly per table; for installment-snapshot tables, either skip the recompute entirely (no-op anyway) or add an opt-in "re-price open installments" path. For rate-derived tables (EOBI/ESSI/NightCall/ApsaaPunjab) the global scope is acceptable.

### src/app/api/payroll/[id]/deductions/[typeId]/override/route.ts — [no defect] ✅ (note)
Both gates present and correct: `PAYROLL:DEDUCTION_OVERRIDE` (`:71,123`) + workflow `deductions.allowOverrideOnFinalized` (`:85-91,130-137`). Override survives recompute — `persist.ts:133-148` refreshes trace fields but preserves `amount` for `isOverride` rows; `index.ts:140` re-applies the override amount. DELETE correctly restores `computedAmount`. The override permission is `PAYROLL:DEDUCTION_OVERRIDE`, NOT `DEDUCTIONS:*` — intentional per CLAUDE.md, but note the asymmetry: trigger/enrollment routes gate on `DEDUCTIONS`, override gates on `PAYROLL`. Consumer `PayrollDeductionLines.tsx:254` hits the correct path and reads `data.message` (`:262`) — envelope-correct.

### Enrollment routes (eobi/essi `[guardId]`) — [no defect] ✅ (note)
Gated `DEDUCTIONS:VIEW`/`UPDATE` (`eobi/[guardId]/route.ts:30,47`), require `eobiNumber`/`essiNumber` when activating (`:67-69`), upsert via shared `enrollments.ts`. Resolver gates correctly: un-enrolled or `isActive=false` guard returns `zero(...)` (`resolvers.ts:187,228`). Gating is correct in both directions. Consumed by `StatutoryTab.tsx`. No regional-scope check on `[guardId]` (an Admin restricted to a region could read/write enrollment for any guard id) — minor, flag for the scope-hardening pass, not a deduction-amount bug.

### Envelope check — [no defect] ✅
`other-deductions` GET/POST return raw `NextResponse.json(rows)` (legacy shape, not the `ok()` envelope) — consumed correctly by the legacy manager which reads the array directly and `data?.message` on error (`PayrollOtherDeductionsManager.tsx:182`). All `deductions/*` and override routes use the `ok/badRequest/...` helpers and clients read `data.message`. No `data.error` misuse found.

### Domain-rule check (deduction must not pull from invoicing) — [no defect] ✅
`grep` for `ClientContractRate|invoice|billing|contractRate` in `src/lib/deductions/` = empty. APSAA's `rateSource:"CLIENT_BRANCH_RATE"` is a **cosmetic label**; the data comes from the dedicated `ApsaaBranchRate` table (scoped by `branchId`, its own effective-dated/approved rate flow — schema `:2394`), which is a guard-payroll deduction table, not the client-invoicing side. No deduction code pulls from invoicing. (Recommend renaming the `CLIENT_BRANCH_RATE` rateSource label to something like `BRANCH_RATE` to remove the false invoicing association — cleanup only.)

### Rate-resolution correctness (resolver consumption of rate tables) — [no defect] ✅
`resolveRate.ts:32-44` `pickActive` correctly filters `status==="ACTIVE"` + `effectiveFrom <= monthStart < effectiveTo`, picks most-recently-effective. Superseded/draft rows excluded. Branch/region scope applied in the `where` (`:56-72`). Returns `null` + caller emits `MISSING_RATE` (no silent constant). NightCallRule uses the same logic inline (`:108-134`). The resolver side consumes the Settings-cleared rate tables correctly.

### Resignation hook — [no defect] ✅
`resignation.ts` is idempotent via `upsert` on `guardId_payrollMonth` (`:94`), tiers selected by `[minMonths,maxMonths)` + effective window (`:79-85`), gated by `deductions.uniformResignationRecovery` (`:60`), wired once from `lib/guards/lifecycle.ts:202-203`. Re-trigger updates the same row (no double-charge). Correct.

---

## Top 5 highest-risk

1. 🔴 **OTHER manual-deduction wiped on recompute** (`other-deductions/route.ts:179-189` + `index.ts:140` + `persist.ts:167`). Manually-entered Other deductions silently zero out on the next recompute (rate approval, loan/extra-hours edit, etc.). Direct net-pay error, SoT durability violation. **Fix:** flag OTHER entries as overrides.
2. 🔴 **Installment/recovery rows never leave PENDING** (issuance routes + all resolvers). No completion lifecycle → missed-month installments silently dropped forever, no paid-state, audit overstates liabilities. Biggest structural gap. **Fix:** terminal-status transition on payroll finalize + carry-forward for missed months.
3. 🔴 **Dead `other-deductions/[id]` route writes phantom `MISC` type** (`other-deductions/[id]/route.ts:19,65`). Code-divergent from the seeded `OTHER`; if revived, forks manual deductions across two types. **Fix:** delete the file.
4. 🟠 **Non-idempotent issuance triggers** (`uniform/issuances:72,95`; `training-school-fees/issuances:76,99`; `advance-salary:104,116`). Retried POST double-creates schedules → guard double-charged. Headers falsely claim idempotency. **Fix:** unique constraint + upsert/precheck.
5. 🟠 **Night-call ingest uses today's rule + hardcoded fallback** (`night-call/logs:114-121`). Back-dated logs priced with the wrong rule version; fabricates default policy when none approved (violates no-silent-constant rule). **Fix:** resolve rule per log-month; skip + warn when no active rule.

## Confirmed-dead removal list (with proof)

| Path | Why dead | Proof |
|---|---|---|
| `src/app/api/payroll/other-deductions/[id]/route.ts` | No caller; operates on un-seeded `MISC` code | `grep -rn "other-deductions/\${" src` (excl. `api/`) = empty; manager calls only GET/POST; migration seeds `OTHER` not `MISC` (`migration.sql:523`) |
| `scripts/seed-payroll-deduction-types.ts` | Pre-canonical, divergent codes (`TRAINING_FEE`), superseded by migration seed | Not referenced by build/CI; codes don't match resolver dispatch (`index.ts:113`); migration `:510-530` is the canonical idempotent seed |

Both are safe to remove once the OTHER durability fix (Top-5 #1) lands. No source was modified by this audit.
