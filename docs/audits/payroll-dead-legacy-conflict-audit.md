# Payroll — Dead / Legacy / Conflicting-Logic Audit

Read-only forensic audit of the PAYROLL domain (Next.js 14 App Router, Prisma, NextAuth).
Scope per the audit brief. **Deductions internals are OUT OF SCOPE** (owned by the parallel
Deductions agent): `src/lib/deductions/*`, `api/payroll/[id]/deductions/*`,
`api/payroll/other-deductions`, `api/payroll/deduction-types`. Where those touch payroll,
they are noted but not classified.

Method: graphify `graph.json` / `GRAPH_REPORT.md` for orientation (built 2026-04-28), then
every "dead/live" verdict proven by repo-wide grep of real call sites (fetch URLs, nav
`items.ts`, `middleware.ts` MODULE_ROUTES, dynamic imports, page render trees). Graphify
importer counts for API routes are unreliable (string-fetched), so all route verdicts rest
on grep, not the graph.

---

## 1. Salary-generation map (legacy `salary` vs `salary-v2`)

There is **one canonical compute engine** and several entry points. Net: nothing is a true
parallel "v1 vs v2 salary calculator" EXCEPT the salary-slip generator (see §1d).

| Path | Role | Verdict |
|---|---|---|
| `src/lib/payroll/calculate.ts` `calculateGuardPayroll()` | **CANONICAL compute** (pure read+compute, zero writes). Base pay from DEPLOYMENT (`dep.salary ?? dep.rate`). | LIVE / SoT |
| `src/lib/payroll/persist.ts` `persistGuardPayroll()` | **CANONICAL writer** — only writer of Payroll row + PayrollDeductionEntry. | LIVE / SoT |
| `POST /api/payroll/calculate` | Canonical calc endpoint (single/bulk). Envelope `ok()`. Writes audit log. | LIVE (canonical) |
| `POST /api/payroll/salary` | "Legacy" alias — header comment says prefer `/calculate`, but **delegates to the same calculate+persist engine** and is the endpoint the live Salary-v2 UI actually POSTs to (`PayrollSalaryV2Manager.tsx:213`). Returns raw array, not envelope. | **LEGACY but LIVE** 🟡 |
| `GET /api/payroll/salary` | Browse/list of Payroll rows. Consumed by salary-v2 manager, unpaid manager, state client. | LIVE |
| `PATCH /api/payroll/salary/[id]` | Payment-status mutation (PENDING/UNPAID/PAID). Used by Unpaid Salaries UI. **Bypasses state machine — see Finding F-2.** | LIVE but 🔴 CONFLICT |
| `GET /api/payroll/salary-v2/summary` | Branch-aggregated summary for the Salary-v2 page. Base pay from DEPLOYMENT. | LIVE (canonical UI data) |
| `GET /api/payroll/salary-v2/branch/[id]`, `/export` | Branch drill-down + CSV export. | LIVE |
| `payroll/salary-v2/page.tsx` + `PayrollSalaryV2Manager.tsx` | The **live Salary page** (nav `items.ts:96` "Salary" → `/payroll/salary-v2`). | LIVE (canonical UI) |
| `POST /api/payroll/salary-slips/generate` + `PayrollSalarySlip` table | **Parallel, independent payroll math** — does NOT use calculate.ts. CSV-driven, hardcoded deduction keys. | 🔴 CONFLICT (§1d / F-3) |

**There is NO `payroll/salary` page** (only `salary-v2`). **There is NO `payroll/payrolls` list page** —
`payroll/payrolls/` contains only `[id]/deductions/page.tsx` (deductions-owned). The root
`payroll/page.tsx` and `payroll/operations/page.tsx` both `redirect("/payroll/loans")`; the
`operations/[screen]` router maps `salary`/`salary-v1`/`salary-v2` → `/payroll/salary-v2`.

**Verdict:** Salary-v2 is canonical/live. Legacy `salary` route is **not dead** — it is a thin
alias still wired into the v2 UI for the calculate action. The only genuine parallel-truth is the
**salary-slip generator**, which computes pay outside the canonical engine.

### 1a. Pay-source domain rule — PASS
`calculate.ts` derives `basePay` exclusively from `Deployment.salary ?? Deployment.rate`
(line 158). Reserve % comes from `client.reservePct` / `regionalOffice.reservePct` (a reserve
config, not a billing rate). Repo-wide grep for `ClientContractRate` / `PricingConfig` /
`contractRate` inside `src/lib/payroll` + `src/app/api/payroll` returns **zero** hits. **No
guard gross/base pay is derived from client billing.** Domain rule satisfied.

### 1b. Legacy deduction floats — PASS
Grep of `calculate.ts` / `persist.ts` / all salary routes for `.cwf` / `.eobi` / `.essi` /
`.trainingSchoolFees` / `.otherDeductions` reads/writes on `Payroll`: **zero**. Schema confirms
those columns are dropped (only a comment remains in `model Payroll`). `cwfDeduction` /
`trainingSchoolFee*` survive only on the separate `PayrollDefault` config table (see F-6).

### 1c. Reserve weighting — OK (note)
`calculate.ts` aggregates `clientWeights` for weighted reserve %, but `branchWeights` /
`deployedInPunjab` are computed only to feed the deductions resolver context (out of scope).

### 1d. Salary-slip generator = parallel truth (see F-3)
`api/payroll/salary-slips/generate` takes user-entered earnings + a hardcoded deduction key
list (`EOBI, ESSI, CWF, APSAA, …`) and computes `grossPay − totalDeductions` with its own
arithmetic into `PayrollSalarySlip`. It never reads `Payroll`, `PayrollDeductionEntry`, or
`calculate.ts`. The Bulk-Salary-Slips page lists these rows back (`GET /api/payroll/salary-slips`),
so users see slip numbers that can disagree with the canonical payroll.

---

## 2. Payroll state machine — diagram + integrity table

States (Payroll.state): `DRAFT → CALCULATED → REGIONAL_LOCKED → GLOBAL_FINALIZED → PAID`,
plus side states `HOLD` and `EMERGENCY_RELEASED`.

```
                 calculate/persist
   (new) ─────────────────────────────►  CALCULATED ◄──────────────┐
     │  DRAFT ──(extra-hours/overtime/SD recompute)──► CALCULATED   │ unlock-region
     │                                                              │ (SuperAdmin)
     ▼                                                              │
  persist also allowed from DRAFT/CALCULATED/EMERGENCY_RELEASED     │
                                                                    │
   CALCULATED ──lock-region (scope/SuperAdmin)──► REGIONAL_LOCKED ──┘
   REGIONAL_LOCKED ──global-finalize (SuperAdmin)──► GLOBAL_FINALIZED
   GLOBAL_FINALIZED ──global-unfinalize (SuperAdmin, reason)──► REGIONAL_LOCKED
   {REGIONAL_LOCKED, GLOBAL_FINALIZED, EMERGENCY_RELEASED} ──mark-paid──► PAID
   {DRAFT,CALCULATED,REGIONAL_LOCKED,EMERGENCY_RELEASED} ──hold (reason)──► HOLD
   HOLD ──release-hold (placer or SuperAdmin)──► (REGIONAL_LOCKED if was locked else CALCULATED)
   {any except PAID, EMERGENCY_RELEASED} ──emergency-release (SuperAdmin, reason)──► EMERGENCY_RELEASED

   persist.ts LOCKED_STATES = {REGIONAL_LOCKED, GLOBAL_FINALIZED, PAID, HOLD}
       → recompute throws "Cannot recalculate payroll in state X" for these.
```

| Transition | Route | Atomic? | Blocks on finalized? | Gated correctly? |
|---|---|---|---|---|
| → CALCULATED (recompute) | persist.ts | Yes (per-guard tx) | Yes — `LOCKED_STATES` guard throws | n/a (engine) |
| lock-region | `state/lock-region` | Yes (marker-based updateMany + re-find in tx) | Only flips CALCULATED | scope OR SuperAdmin ⚠️ F-1 |
| unlock-region | `state/unlock-region` | Yes (guarded updateMany + ledger delete in tx) | Only flips REGIONAL_LOCKED | SuperAdmin ⚠️ F-1 |
| global-finalize | `state/global-finalize` | Yes (marker-based) | Only flips REGIONAL_LOCKED | SuperAdmin ⚠️ F-1 |
| global-unfinalize | `state/global-unfinalize` | Yes (guarded updateMany) | Only flips GLOBAL_FINALIZED | SuperAdmin ⚠️ F-1, reason required |
| hold | `state/hold` | Yes (conditional updateMany, notIn) | Rejects HOLD/PAID/GLOBAL_FINALIZED | PAYROLL.CREATE + scope |
| release-hold | `state/release-hold` | Yes (state=HOLD updateMany) | n/a | placer OR SuperAdmin ⚠️ F-1 |
| mark-paid | `state/mark-paid` | Yes (state-in updateMany) | Only from RL/GF/ER | PAYROLL.CREATE + scope |
| emergency-release | `state/emergency-release` | Yes (notIn PAID/ER) | Rejects PAID | SuperAdmin ⚠️ F-1, reason required |
| **paymentStatus→PAID (bypass)** | `salary/[id]` PATCH | single update, **no state read** | **NO** | PAYROLL.UPDATE — 🔴 F-2 |

**Integrity verdict:** The dedicated `state/*` machine is well-built — every transition uses a
conditional `updateMany` (or marker-based flip + re-find) so concurrent callers cannot
double-act, ledger writes are inside the same tx, and `persist.ts` blocks amount mutation on
locked rows. **Two breaches:** (F-1) every SuperAdmin gate in the state routes uses a **broken
`isSuperAdmin`** that excludes the "Super User" role; (F-2) `salary/[id]` PATCH writes
`paymentStatus=PAID` with no `state` check, fully bypassing the state machine and desyncing
`state` vs `paymentStatus`.

---

## 3. Findings by submodule

### `src/lib/payroll/state-permissions.ts:15` — CONFLICT 🔴  (F-1)
**What:** A second, divergent `isSuperAdmin` implementation. It returns `false` for any role that
is not literally `"Admin"`, dropping the `"Super User"` branch entirely:
```ts
if (role !== "Admin") return false      // ← a genuine "Super User" never passes
return perms.length === 0
```
The canonical `src/lib/api/permissions.ts:22` is `if (role === "Super User") return true; return role === "Admin" && perms.length === 0`.
**Evidence:** `"Super User"` is a real, distinct role (`mockData/prismaMock.ts:26`,
`permission-gate.tsx:25`, `region-selector.tsx:49`, `dashboard/role.ts:25`, cron
`role: { name: { in: ["Admin","Super User"] } }`). The broken function is imported by:
`state/emergency-release`, `state/global-finalize`, `state/global-unfinalize`,
`state/lock-region`, `state/unlock-region`, `state/release-hold` (escalation), plus
`api/tickets/*` (out of payroll scope but same bug).
**Impact:** A user whose role is `"Super User"` (the highest-privilege role) is **denied** the
SuperAdmin-only payroll actions: global-finalize, global-unfinalize, unlock-region,
emergency-release, and cross-scope lock-region. They get `403 "Only SuperAdmin can …"`. In
`lock-region` the bug also forces a Super User down the regional-manager scope branch
(`!superAdmin && scope`), so a Super User with an empty scope can be blocked from locking. The
month-close workflow cannot be completed by a Super User. Conversely, an `"Admin"` with empty
permissions still works, masking the bug in most setups.
**Fix (root cause):** Delete this local `isSuperAdmin` and import the canonical one from
`@/lib/api/permissions`. Keep only `getActorIdentity` in `state-permissions.ts` (or move it too).
Co-change: `api/tickets/[id]/route.ts`, `api/tickets/[id]/comments/route.ts`, `api/tickets/route.ts`
import the same broken symbol — switch them in the same patch.

### `src/app/api/payroll/salary/[id]/route.ts:67` — CONFLICT 🔴  (F-2)
**What:** PATCH sets `paymentStatus` (incl. `"PAID"`) on a Payroll row with **no read of
`state`** and **no state guard**. It updates `paymentStatus`/`paymentMethod`/`paymentRemarks`
directly and never touches `Payroll.state`.
**Evidence:** Compare `state/mark-paid/route.ts:75` which requires
`state ∈ {REGIONAL_LOCKED, GLOBAL_FINALIZED, EMERGENCY_RELEASED}` and sets BOTH `state="PAID"`
and `paymentStatus="PAID"`. The Unpaid-Salaries UI calls the bypass route
(`PayrollUnpaidSalariesManager.tsx:159` → `PATCH /api/payroll/salary/${id}`).
**Impact:** (a) A DRAFT/CALCULATED payroll can be marked `paymentStatus=PAID` before it is ever
regionally locked or globally finalized — paying outside the close workflow. (b) `state` and
`paymentStatus` diverge: a row can read `state="CALCULATED"` (still recalculable / unlocked) yet
`paymentStatus="PAID"`. Because `persist.ts` LOCKED_STATES keys on `state`, not `paymentStatus`,
such a "paid" row is still freely recomputed by any extra-hours/overtime/special-duty edit —
silently changing the net of an already-paid guard. (c) No scope-correct double-pay guard beyond
the column already being PAID.
**Fix (root cause):** Make payment a state-machine-only operation. Have the Unpaid UI call
`state/mark-paid`. Reduce `salary/[id]` PATCH to non-financial fields (remarks) or have it reject
`paymentStatus=PAID` and delegate. At minimum, gate the PATCH on `state` and set `state` in lock-step
with `paymentStatus`.

### `src/app/api/payroll/salary-slips/generate/route.ts` — CONFLICT 🟠  (F-3)
**What:** Standalone payroll math that bypasses the canonical engine. Reads user-supplied
earnings + a hardcoded deduction key list (`EOBI, ESSI, CWF, APSAA, APSAA_PUNJAB, UNIFORM,
TRAINING_SCHOOL_FEES, NIGHT_CALL, ABSENT, OTHER`), computes `grossPay − totalDeductions`, writes
`PayrollSalarySlip`. Never reads `Payroll` / `PayrollDeductionEntry` / `calculate.ts`.
**Evidence:** Lines 7-30 (hardcoded keys), 115 (`netPayable = grossPay − totalDeductions`),
118 (`payrollSalarySlip.upsert`). Listed back by `GET /api/payroll/salary-slips` →
`PayrollBulkSalarySlipsManager.tsx:133`.
**Impact:** Two divergent sources of truth for a guard's monthly pay. The slip a guard receives
can differ from the canonical Payroll/PayrollDeductionEntry numbers (different deductions,
different rounding, manual entry). The hardcoded deduction list also re-introduces the legacy
deduction taxonomy that the entry-based policy was meant to centralize (drift risk with the
deductions agent's resolvers).
**Fix (root cause):** Generate slips FROM the canonical computation — read the persisted
`Payroll` + its `PayrollDeductionEntry` rows for the month and render those, rather than
recomputing from CSV. If manual override slips are genuinely needed, they must be derived from /
reconciled against the canonical row, not a free-standing calculation.

### Loans: `loans/route.ts`, `loans/[id]/route.ts`, `loans/bulk/route.ts`, `loans/finalize/route.ts`, `loans/unfinalize/route.ts` — CONFLICT 🔴  (F-4)
**What:** `calculate.ts:239-247` sums `Loan` rows with `status="FINALIZED"` for the month into
`loanTotal`, which lowers net pay and is persisted to `Payroll.loans`/`netSalary`. **None of the
loan mutation routes trigger a payroll recompute.** Grep proof: extra-hours/overtime/special-duty
routes contain 3-7 `recalc`/`calculateGuardPayroll`/`persistGuardPayroll` references each; ALL
loan routes (create, `[id]`, `bulk`, `finalize`, `unfinalize`) contain **zero**.
**Evidence:** `loans/finalize` flips PENDING→FINALIZED + writes history, no recompute.
`loans/unfinalize` flips FINALIZED→PENDING with **no `state` guard at all** and no recompute.
`loans/[id]` PATCH edits `amount` of a finalized loan with no state guard / no recompute.
**Impact:** (a) Finalizing loans after a payroll is already CALCULATED does not update the
payroll's `loans`/`netSalary` until someone manually recalculates — net pay is stale/wrong.
(b) Unfinalizing or editing a loan amount for a month whose payroll is REGIONAL_LOCKED /
GLOBAL_FINALIZED silently changes the loan ledger while the locked payroll keeps the old loan
total — the two disagree and the locked figure is not corrected (and recompute would be blocked
anyway, so the drift is permanent until emergency-release). (c) `loans/unfinalize` has no
`state`/finalized guard, so it will revert loans for an already-finalized payroll month with no
warning.
**Fix (root cause):** After any loan create/edit/finalize/unfinalize, run
`recalcAffectedMonths(guardId, [month], actor)` (same pattern as special-duty-records). Skip-on-
locked is already handled there (surfaces a warning). For finalize/unfinalize, also add the
locked-month guard / warning so users know a locked payroll won't pick up the change.

### `src/app/api/payroll/special-duty/route.ts` + `special-duty/[id]/route.ts` — DEAD + CONFLICT 🟠  (F-5)
**What:** The `@deprecated`-marked legacy special-duty endpoints. They write
`Payroll.specialDutyAmount` DIRECTLY (POST line 116-118 / PATCH line 57-62), then call
`recalcAffectedMonths`. But the recalc re-runs `calculate.ts`, which computes `specialDutyPay`
ONLY from `PayrollSpecialDuty` rows (calculate.ts:217-236) and `persist.ts:76` overwrites
`specialDutyAmount` with that value. The legacy POST does NOT create a `PayrollSpecialDuty` row,
so the recalc computes special-duty = 0 and **clobbers the value the route just wrote** to 0.
**Evidence:** No UI calls these endpoints — the live `PayrollSpecialDutyManager` exclusively
fetches `/api/payroll/special-duty-records` (lines 158/252/288). Repo-wide grep for callers of
`api/payroll/special-duty` (excluding `-records`) returns **zero**.
**Impact:** Dead code that is also internally broken (self-clobbering to zero). If ever
re-wired, it would silently produce zero special-duty pay. Maintenance/confusion cost; two
"special duty" surfaces for one concept.
**Fix:** Delete `api/payroll/special-duty/route.ts` and `api/payroll/special-duty/[id]/route.ts`.
`special-duty-records` is canonical.

### `src/app/api/payroll/overtime/route.ts` + `overtime/[id]/route.ts` — DEAD 🟡  (F-6)
**What:** A third additive-pay system (auto-rate from `Deployment.overtime`), writes
`Payroll.overtimeAmount`, triggers canonical recompute. `calculate.ts:213` reads `overtimeAmount`
into gross.
**Evidence:** **No caller anywhere.** Grep for `api/payroll/overtime` across `src` returns only
doc-comment cross-references (the route's own header + extra-hours mention). No nav entry
(`items.ts` has no Overtime item), no page, no component fetch. The live additive surfaces are
`extra-hours` (manual rate, `PayrollExtraHoursManager`) and special-duty.
**Impact:** Dead endpoints. Not double-counting (separate column), but unreachable. Overlaps
conceptually with `extra-hours` — if overtime is intended to return, the overtime-vs-extra-hours
distinction needs a product decision.
**Fix:** Delete both `overtime` routes (and the `overtimeHours`/`overtimeAmount` write path is
preserved by extra-hours? — no; overtime column would simply never be set, computing to 0). Confirm
with product whether overtime should be a live feature before deleting; classified DEAD on
current wiring.

### `src/app/api/payroll/defaults/route.ts` + `defaults/[id]/route.ts` (+ `PayrollDefaultsTab`) — LEGACY (DEAD CONFIG) 🟡  (F-7)
**What:** CRUD for `PayrollDefault` (`cwfDeduction`, `trainingSchoolFeeTotal/Monthly`,
`spBrVerAgeLimit/Days/Amount`). Surfaced in `payroll/settings` via `PayrollDefaultsTab`.
**Evidence:** `PayrollDefault` is **write-only** — grep shows zero reads in any compute path:
not in `calculate.ts`, not in `src/lib/deductions/*` resolvers, not in special-duty. `cwf` /
`trainingSchoolFee` rates are now resolved from the effective-dated tables (`CwfRegionRate`, etc.)
per the deductions policy, and `spBrVer*` (special-branch-verification) has **zero readers**
anywhere in the repo.
**Impact:** Operators can edit these "defaults" and nothing consumes them — a silent no-op
settings surface. Risk: a user changes `cwfDeduction` here expecting it to affect CWF deductions;
it does nothing (real rate is the effective-dated table). Drift / false affordance.
**Fix:** Confirm with the deductions owner, then retire the `PayrollDefault` table + routes +
`PayrollDefaultsTab`. The `cwf`/`trainingSchoolFee` portion is a deductions-boundary concern
(coordinate); `spBrVer*` is unambiguously dead and payroll-owned.

### `src/components/payroll/PayrollLoanManager.tsx` — DEAD 🟡  (F-8)
**What:** A loan-management component.
**Evidence:** **Zero real importers** (grep `PayrollLoanManager` across `src` excluding self +
graphify cache = empty). The loans page renders `PayrollLoansClient` instead
(`payroll/loans/page.tsx:4`).
**Impact:** Dead ~UI module. (Graphify Community 51 still lists it, illustrating stale graph.)
**Fix:** Delete `src/components/payroll/PayrollLoanManager.tsx`.

### `src/components/payroll/PayrollSlipPdfDocument.tsx` — DEAD 🟡  (F-9)
**What:** A React-PDF salary-slip document component.
**Evidence:** No actual import — the only reference is a JSDoc `@link` comment inside
`InvoicePdfDocument.tsx:4` ("Sister component to …"), not an import statement. Grep for real
importers (excluding graphify-out + self) = only that comment file.
**Impact:** Dead component. The Bulk-Salary-Slips flow does not render it.
**Fix:** Delete `PayrollSlipPdfDocument.tsx` (and drop the stale `@link` in InvoicePdfDocument's
comment). Verify the bulk-slips PDF path (if any) does not lazy-import it.

### `src/app/api/payroll/unpaid/route.ts` — LEGACY 🟡  (F-10)
**What:** GET lists payrolls with `paymentStatus="UNPAID"`.
**Evidence:** Nothing in the payroll write paths ever sets `paymentStatus="UNPAID"` — the state
machine (`mark-paid`) and `persist.ts` only set `PENDING` / `PAID`. The only writer that *could*
set `UNPAID` is the `salary/[id]` PATCH (which accepts UNPAID in its enum) driven by the Unpaid
manager. So this list is effectively always empty unless an operator manually flips a row to
UNPAID via that bypass route.
**Impact:** The UnPaid-Salaries page (`payroll/unpaid-salaries`, in nav) is built around a status
that the canonical pipeline never produces. It is functional only in combination with the F-2
bypass route. Low-risk but confusing dead-ish surface; tied to the F-2 fix.
**Fix:** Decide whether UNPAID is a real lifecycle state. If not, drop it from the enum + page.
If yes, it must be produced by the state machine, not only the bypass PATCH.

### Loans: `loans/bulk/route.ts:65` — note 🟡
`notes` is stored into the `Loan.manager` column (`...(row.notes ? { manager: row.notes } : {})`).
Field misuse — bulk-imported notes land in the "manager" field. Minor data-quality bug (not
dead/conflict per se), flagged for completeness.

### Envelope inconsistency — note 🟡
27 payroll route files return raw `NextResponse.json(...)` (bare arrays/objects, no
`{success,...}` envelope); 16 use the `ok()`/error helpers. The list/GET routes return bare
arrays and their clients are written to match, so this is **not breaking** — but it is drift from
the `src/lib/api/response.ts` convention and means error bodies from these routes don't carry the
standard `{success:false,message,code}` shape. Not classified as a bug; noted for cleanup.

### Healthy (verified, no action)
- `state/*` machine transitions: atomic, concurrency-guarded, ledger-in-tx (aside from F-1).
- `reserve/ledger` + `reserve/release`: Serializable tx, overdraft guard, P2034→409. Solid.
- `extra-hours`, `special-duty-records`, `clearance`: recompute correctly; clearance writes the
  settlement as a canonical `PayrollDeductionEntry` (OTHER) inside a tx — no legacy floats.
- Manager scope (`deriveManagerScope`/`managerScopeDenied`) present on every payroll list +
  mutation reviewed (loans, salary, special-duty(-records), extra-hours, overtime, reserve,
  unpaid, clearance, salary-slips, holidays). `defaults` routes have no scope guard but
  `PayrollDefault` is global config (no region field) — acceptable.
- `calculate.ts` pay-source + no-legacy-floats: PASS (§1a/§1b).

---

## 4. Top 5 highest-risk

1. **F-1 — broken `isSuperAdmin` in `state-permissions.ts:15`** 🔴 — "Super User" role is locked
   out of global-finalize / unlock / unfinalize / emergency-release; the month-close workflow can
   be un-completable for the top-privilege role. Access break on the most sensitive money actions.
2. **F-2 — `salary/[id]` PATCH bypasses the state machine** 🔴 — marks `paymentStatus=PAID` from
   any state with no `state` guard; `state` and `paymentStatus` desync; an already-"paid" guard's
   net can still be silently recomputed. Pay-integrity break.
3. **F-4 — loan mutations never recompute payroll** 🔴 — finalize/unfinalize/edit loans without
   recalc; net pay goes stale, and locked-month payrolls permanently disagree with the loan ledger.
   `loans/unfinalize` has no finalized-state guard.
4. **F-3 — salary-slip generator is a parallel payroll computation** 🟠 — slips computed outside
   the canonical engine with a hardcoded legacy deduction list; printed slips can disagree with the
   canonical Payroll/PayrollDeductionEntry numbers.
5. **F-5 — legacy `special-duty` endpoints are dead AND self-clobbering** 🟠 — write
   `specialDutyAmount` then immediately recalc to zero; would silently zero special-duty pay if
   re-used.

## 5. Confirmed-dead removal list (with proof)

| Target | Proof of dead |
|---|---|
| `src/app/api/payroll/special-duty/route.ts` | Zero callers; live UI uses `special-duty-records` only (PayrollSpecialDutyManager.tsx:158/252/288). Also self-clobbering (F-5). |
| `src/app/api/payroll/special-duty/[id]/route.ts` | Same — no caller of legacy SD `[id]`. |
| `src/app/api/payroll/overtime/route.ts` | Zero callers across `src` (only doc-comment refs); no nav item, no page, no component fetch (F-6). |
| `src/app/api/payroll/overtime/[id]/route.ts` | Same — no caller. |
| `src/components/payroll/PayrollLoanManager.tsx` | Zero real importers (loans page uses PayrollLoansClient) (F-8). |
| `src/components/payroll/PayrollSlipPdfDocument.tsx` | No import — only a JSDoc `@link` mention in InvoicePdfDocument.tsx:4 (F-9). |
| `PayrollDefault` routes + `PayrollDefaultsTab` (`defaults/route.ts`, `defaults/[id]/route.ts`) | Write-only config; zero reads in calculate.ts / deductions resolvers / special-duty. `spBrVer*` has zero readers repo-wide (F-7). *Coordinate cwf/training portion with deductions owner.* |

> Recommended sequencing: fix F-1 (one-line import swap, highest blast radius) and F-2/F-4
> (recompute + state-gate) first — these are live money/access bugs — before deleting the dead
> code (F-5/F-6/F-8/F-9) and retiring the dead config (F-7).
