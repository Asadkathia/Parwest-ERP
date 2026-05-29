# SETTINGS domain — Dead / Legacy / Conflicting-logic audit

Read-only forensic audit of the Parwest ERP **SETTINGS** domain: the `/settings/*` dashboard
pages and the scattered config APIs they drive (there is no `api/settings` tree).
Method: graphify orientation (`graphify-out/`, built 2026-04-28) + repo-wide grep proof of every
call site (fetch URLs, nav links, `isWorkflowRuleEnabled` keys). Graph importer counts for API
routes are unreliable (string-fetched), so every "dead" verdict below is grep-proven.

**Verdicts at a glance**

- Workflow-rules registry integrity: **mostly sound** — zero checked-but-undefined keys (no silent
  always-off bugs). BUT 5 defined keys are **dead toggles** (never read), 6 keys are **missing from
  the manager UI's description/label maps**, and the workflow-rules API has **no permission gate**
  and is **persisted to a non-durable flat file**.
- Rate-table consistency: **excellent** — all 8 deduction rate tables share one
  `routeFactory` + `rates.ts` helper with consistent propose/approve/supersede, separation-of-duties,
  approval-doc, retroactive-lock, single-active supersede and audit. No legacy `Payroll.*` float
  reads remain.
- Rate-flow separation: **VIOLATED** — `InvoicePrerequisitesManager` (billing/invoicing UI) reads
  AND writes the guard-payroll `DeploymentRate` table as the "invoice default rate." 🔴

---

## A. Workflow-rules key audit table

Source of keys: `src/lib/workflows/policy.ts` (`BASE_WORKFLOW_RULES`, 36 keys).
"Checked" = appears in an `isWorkflowRuleEnabled("…")` call somewhere in the repo.
"In UI" = has a humanized entry in `WorkflowRulesManager.tsx` `RULE_DESCRIPTIONS` and a
`MODULE_LABELS` tab label (all keys render, but un-mapped ones show generic text / raw module name).

| Key | Defined | Checked (where) | In UI desc | UI tab label | Verdict |
|---|---|---|---|---|---|
| deployments.singleActivePerGuard | ✅ | ✅ deployments/route.ts | ✅ | Deployments | OK |
| deployments.blockInactiveUpdate | ✅ | ✅ deployments/[id]/route.ts | ✅ | Deployments | OK |
| **deployments.lockAfterEnd** | ✅ | ❌ **never** | ✅ | Deployments | 🟠 **DEAD TOGGLE** |
| deployments.requireActiveGuardStatus | ✅ | ✅ deployments/route.ts | ✅ | Deployments | OK |
| deployments.requireGuardOfficeConsistency | ✅ | ✅ deployments/route.ts | ✅ | Deployments | OK |
| deployments.requireEndDate | ✅ | ✅ deployments/[id]/end/route.ts | ✅ | Deployments | OK |
| deployments.disallowEndDateBeforeDeploymentDate | ✅ | ✅ end/route.ts | ✅ | Deployments | OK |
| deployments.disallowFutureEndDate | ✅ | ✅ end/route.ts | ✅ | Deployments | OK |
| deployments.requireBranchContract | ✅ | ✅ deployments/route.ts | ✅ | Deployments | OK |
| deployments.requireClientHasBranches | ✅ | ✅ deployments/route.ts | ✅ | Deployments | OK |
| deployments.requireVerifiedPrerequisites | ✅ | ✅ deployments/route.ts | ✅ | Deployments | OK |
| **deployments.allowExtraType** | ✅ | ✅ deploy/page.tsx, deployments/route.ts | ❌ **missing** | Deployments | 🟡 desc missing → "Workflow validation rule." |
| **branches.requireInactiveBranchesBeforeClientInactive** | ✅ | ✅ clients/[id]/route.ts | ❌ **missing** | **"branches"** (raw) | 🟡 desc + label missing |
| **branches.blockInactiveWithActiveDeployment** | ✅ | ✅ branches/[id]/route.ts | ❌ **missing** | **"branches"** (raw) | 🟡 desc + label missing |
| **inventoryDemand.requirePendingInitialStatus** | ✅ | ❌ **never** (doc-comment only) | ✅ | Inventory Demand | 🔴 **DEAD TOGGLE** (claimed enforced) |
| **inventoryDemand.enforceTransitionMap** | ✅ | ❌ **never** (hardcoded map instead) | ✅ | Inventory Demand | 🔴 **DEAD TOGGLE** (claimed enforced) |
| **inventoryDemand.blockCoreEditsAfterTerminal** | ✅ | ❌ **never** (doc-comment only) | ✅ | Inventory Demand | 🔴 **DEAD TOGGLE** (claimed enforced) |
| **inventoryDemand.requireSufficientStockForFulfillment** | ✅ | ❌ **never** (doc-comment only) | ✅ | Inventory Demand | 🔴 **DEAD TOGGLE** (claimed enforced) |
| invoicing.autoAccrualEnabled | ✅ | ✅ cron/invoices/accrue-daily | ❌ **missing** | **"invoicing"** (raw) | 🟡 desc + label missing |
| invoicing.draftReminderEnabled | ✅ | ✅ cron/invoices/remind-pending | ❌ **missing** | **"invoicing"** (raw) | 🟡 desc + label missing |
| deductions.applyApsaaBranchRate | ✅ | ✅ resolvers.ts | ✅ | Deductions Policy | OK |
| deductions.applyCwfRegionRate | ✅ | ✅ resolvers.ts | ✅ | Deductions Policy | OK |
| deductions.applyApsaaPunjabOnEnrollment | ✅ | ✅ resolvers.ts | ✅ | Deductions Policy | OK |
| deductions.uniformAutoInstallments | ✅ | ✅ uniform/issuances, resolvers | ✅ | Deductions Policy | OK |
| deductions.uniformResignationRecovery | ✅ | ✅ resignation.ts, resolvers | ✅ | Deductions Policy | OK |
| deductions.nightCallAutoDeduct | ✅ | ✅ night-call/logs, resolvers | ✅ | Deductions Policy | OK |
| deductions.eobiAutoDeduct | ✅ | ✅ resolvers.ts | ✅ | Deductions Policy | OK |
| deductions.essiAutoDeduct | ✅ | ✅ resolvers.ts | ✅ | Deductions Policy | OK |
| deductions.trainingSchoolFeesAutoInstallments | ✅ | ✅ training-school-fees, resolvers | ✅ | Deductions Policy | OK |
| deductions.absentAutoDeduct | ✅ | ✅ resolvers.ts | ✅ | Deductions Policy | OK |
| deductions.advanceSalaryAutoRecover | ✅ | ✅ advance-salary, resolvers | ✅ | Deductions Policy | OK |
| deductions.requireRateApprovalSeparation | ✅ | ✅ rates.ts | ✅ | Deductions Policy | OK |
| deductions.requireApprovalDocument | ✅ | ✅ rates.ts | ✅ | Deductions Policy | OK |
| deductions.lockRetroactiveChanges | ✅ | ✅ rates.ts | ✅ | Deductions Policy | OK |
| deductions.allowOverrideOnFinalized | ✅ | ✅ override/route.ts | ✅ | Deductions Policy | OK |
| **imports.draftEditor** | ✅ | ✅ imports/page.tsx, [screen]/page.tsx | ❌ **missing** | **"imports"** (raw) | 🟡 desc + label missing |

**Checked-but-undefined keys: NONE** (no silent always-off bugs — good).
**Defined-but-unchecked (dead) keys: 5** — `deployments.lockAfterEnd` + the four `inventoryDemand.*`.

---

## B. Rate-table consistency table

All 8 tables route through `src/lib/deductions/routeFactory.ts` → `src/lib/deductions/rates.ts`
(`buildListAndCreateHandlers` / `buildApproveHandler` / `buildSupersedeHandler`).

| Rate table | Has DRAFT→approve gate? | Separation-of-duties? | Approval-doc gate? | Retroactive lock? | Supersede honored? | Permission gate? | Verdict |
|---|---|---|---|---|---|---|---|
| ApsaaBranchRate (branchId scope) | ✅ | ✅ | ✅ | ✅ | ✅ single-active supersede | ✅ DEDUCTIONS:RATE_* | OK |
| CwfRegionRate (regionId scope) | ✅ | ✅ | ✅ | ✅ | ✅ single-active supersede | ✅ | OK |
| EobiRate (global) | ✅ | ✅ | ✅ | ✅ | ✅ single-active supersede | ✅ | OK |
| EssiRate (global) | ✅ | ✅ | ✅ | ✅ | ✅ single-active supersede | ✅ | OK |
| ApsaaPunjabRate (global) | ✅ | ✅ | ✅ | ✅ | ✅ single-active supersede | ✅ | OK |
| UniformPlan (global) | ✅ | ✅ | ✅ | ✅ | ✅ single-active supersede | ✅ | OK |
| UniformResignationTier (multi-row) | ✅ | ✅ | ✅ | ✅ | n/a (multi-row by design) | ✅ | OK — see note |
| NightCallRule (global) | ✅ | ✅ | ✅ | ✅ | ✅ single-active supersede | ✅ | OK |

Note (UniformResignationTier): `enforceSingleActivePerScope: false` is intentional (tenure tiers
coexist). The factory therefore does **not** check for overlapping `minMonths/maxMonths` ranges
*across* active rows, nor overlapping effective-date windows for the same tier band. `proposeRate`
only validates `maxMonths > minMonths` within a single row. This is a latent 🟡 (two active tiers
with overlapping month bands could both match a guard; first-found wins). Low risk today, flagged
for completeness — not a break.

`payroll/deduction-types` and `payroll/other-deductions` are **type/entry** config (not effective-dated
rate tables) and correctly use `PayrollDeductionEntry` as SoT; no legacy float reads. See findings.

---

## C. Findings by submodule

### src/app/api/store-inventory/v2/demands/[id]/route.ts:27 — CONFLICT 🔴
**What** The four `inventoryDemand.*` workflow rules are advertised as enforced but are not.
`src/lib/schemas/inventory-demand.ts:11-14` doc-comment states "Server-side workflow rules
(`inventoryDemand.requirePendingInitialStatus`, `inventoryDemand.enforceTransitionMap`,
`inventoryDemand.blockCoreEditsAfterTerminal`, `inventoryDemand.requireSufficientStockForFulfillment`)
are enforced in the API." Grep proves NONE of these keys is ever passed to `isWorkflowRuleEnabled`.
The transition map is instead a **hardcoded** `allowedTransitions` constant (line 27) that is always on.
**Evidence** `grep -rn 'isWorkflowRuleEnabled' src/app/api/store-inventory/v2/demands/` → empty.
The 4 keys appear only in policy.ts and the doc comment. `WorkflowRulesManager` renders all four as
editable switches under the "Inventory Demand" tab.
**Impact** An admin who toggles any of these OFF in `/settings/workflow-rules` sees **no behavioral
change** — the demand transition map, pending-initial, terminal-edit-block, and stock checks stay
active (or stay whatever they were hardcoded to). The settings UI lies about its control surface.
This is a silent governance gap: admins believe they relaxed a constraint that is still enforced.
**Recommended fix (root cause)** Wire the demand routes through `isWorkflowRuleEnabled(...)` for each
of the four keys (mirror the deployments pattern), OR delete the four keys from `policy.ts`,
`ENV_OVERRIDE_KEYS`, `WORKFLOW_PRESETS`, the manager's `RULE_DESCRIPTIONS`/`DESTRUCTIVE_RULES`, and the
inventory-demand schema comment. Wiring is the correct option since the keys ship as user-facing
toggles with destructive-confirm metadata. Co-change: update the inventory-demand schema doc comment.

### src/lib/workflows/policy.ts:8 (deployments.lockAfterEnd) — DEAD 🟠
**What** `deployments.lockAfterEnd` is defined, defaulted `true`, has an ENV override key, is rendered
in the manager as a DANGER-ZONE toggle with a destructive-confirm consequence — but is **never read**.
**Evidence** `grep -rn 'deployments.lockAfterEnd' src` returns only policy.ts and WorkflowRulesManager.tsx
(definition + UI), zero `isWorkflowRuleEnabled` call. Deployment edit-locking is enforced by
`deployments.blockInactiveUpdate` instead.
**Impact** Admins are presented a scary "Lock deployment records once end date passed" danger-zone
switch (and a confirm dialog warning of audit-trail breakage) that does nothing. Misleads operators.
**Recommended fix** Either implement the gate in `api/deployments/[id]/route.ts` (distinct from
blockInactiveUpdate, keyed on end-date in the past), or remove the key everywhere (policy.ts type +
BASE map + presets + ENV_OVERRIDE_KEYS + manager RULE_DESCRIPTIONS/DESTRUCTIVE_RULES/CONSEQUENCES).

### src/components/settings/WorkflowRulesManager.tsx:53,145 — LEGACY/DRIFT 🟡
**What** Six live, enforced keys are missing from the UI metadata maps:
`deployments.allowExtraType`, `branches.requireInactiveBranchesBeforeClientInactive`,
`branches.blockInactiveWithActiveDeployment`, `invoicing.autoAccrualEnabled`,
`invoicing.draftReminderEnabled`, `imports.draftEditor`. They render with the generic fallback
"Workflow validation rule." Additionally `MODULE_LABELS` (line 145) lacks `branches`, `invoicing`,
`imports`, so those three tabs show the **raw module slug** as the tab name.
**Evidence** `RULE_DESCRIPTIONS` (lines 53-115) and `MODULE_LABELS` (145-149) checked key-by-key.
**Impact** Admins toggling real, enforced constraints (branch cascade, invoice auto-accrual, import
draft editor) get no description of what they do — high chance of mis-configuration on rules that
actually change billing/import behavior.
**Recommended fix** Add the 6 descriptions to `RULE_DESCRIPTIONS` and the 3 module labels to
`MODULE_LABELS`. Root-cause: the description map should be derived from / asserted exhaustive against
`WorkflowRuleKey` (e.g. `Record<WorkflowRuleKey, string>`) so a new key fails compilation until
documented, instead of silently falling back.

### src/app/api/workflow-rules/route.ts:34-113 — CONFLICT 🔴 (missing gate) + 🟡 (envelope + persistence)
**What** (1) GET and PATCH only check `if (!session)` — **no permission gate**. Any authenticated user
(including a region-restricted Admin or a low-privilege Supervisor) can read and **rewrite global
workflow rules** (deployment validation, deduction automations, dual-control separation-of-duties).
The manager UI gates the controls with `<PermissionGate module="SETTINGS" action="UPDATE">`, but the
server does not enforce it — the gate is cosmetic and bypassable by direct API call.
(2) Returns raw `NextResponse.json({ rules, overrides, presets, activePresetId })` — does not use the
`ok()` envelope from `src/lib/api/response.ts`.
(3) Persistence: writes go to `data/workflow-rules.json` via `process.cwd()/data` (`store.ts:8-9`).
**Evidence** route.ts lines 36-37 / 59-60 (no `hasAction`); store.ts `DATA_DIR = path.join(process.cwd(), "data")`.
`data/workflow-rules.json` is a committed flat file.
**Impact** (1) is the highest risk: a regional Admin or any logged-in user can flip
`deductions.requireRateApprovalSeparation`, `deductions.lockRetroactiveChanges`, or any deployment
guard off — a real financial-controls and access-control breach. (3) On Vercel serverless the runtime
filesystem is ephemeral/read-only outside `/tmp`; flat-file writes do not durably persist across
deploys or cold starts, so saved workflow config can silently revert to defaults in production.
**Recommended fix** (1) Add `if (!hasAction(session, "SETTINGS", "VIEW")) return forbidden()` on GET and
`SETTINGS:UPDATE` on PATCH (matching the regions/offices/training-categories pattern and the UI gate).
(2) Return `ok(...)`. (3) Move workflow-rule + fingerprint persistence off the flat file onto a DB table
(single durable SoT) — the deduction rate-table architecture is the template to follow.

### src/components/settings/UserTypesManager.tsx — LEGACY/DUPLICATE 🟠 + CONFLICT 🔴 (gate)
**What** `/settings/user-types` is **not** a "user types" config — it is a full **user-creation +
role CRUD** UI. It POSTs `/api/users` to create accounts, POST/DELETE `/api/roles` to manage roles,
and lists `/api/users`. This duplicates the Users module: `/users/new` (create), `/users/roles`
(`RolesManager.tsx`), `/users/permissions` (`UserPermissionsManager.tsx`).
Access control is `isAdmin = session.user.role === "Admin"` (line 31) — it does NOT use `PermissionGate`
or `hasAction`, and it treats **any** Admin as fully privileged. Per the documented SuperAdmin gotcha,
an Admin *with* a non-empty permissions array is a **region-restricted** admin who should not have
global user/role management — this UI bypasses that. It also uses banned `window.confirm()` (line 143)
for role deletion, reads `data.error` fallback (line 112), and renders a permanently-blank
"Created: —" role column (line 368).
**Evidence** fetch URLs `/api/roles`, `/api/roles/${id}`, `/api/users`; raw role check line 31;
`window.confirm` line 143.
**Impact** Two parallel user/role editors drift (the settings one has no permission/region scoping and
weaker UX). The `role === "Admin"` shortcut grants restricted regional admins full user-create and
**role-delete** power they shouldn't have. Deleting a role here can orphan users' role references.
**Recommended fix** Decommission `UserTypesManager` and redirect `/settings/user-types` to the canonical
Users module (`/users` + `/users/roles`), OR, if a settings entry point is desired, make it a thin link
card — do not maintain a second user/role pipeline. If kept short-term, immediately replace the
`role === "Admin"` check with `hasAction(session, "USERS", ...)` + `PermissionGate`, swap `window.confirm`
for `AlertDialog`, and drop the dead Created column.

### src/app/api/roles/route.ts:18-60 — CONFLICT 🔴 (missing gate) — originates via UserTypesManager
**What** `GET /api/roles` and `POST /api/roles` only check `if (!session)` — no `hasAction`. Both the
settings `UserTypesManager` and the canonical Users `RolesManager` hit this ungated endpoint; any
authenticated user can create roles. Returns raw `NextResponse.json(roles)` (no `ok()` envelope).
**Evidence** route.ts lines 20-23, 43-46 — no permission check before create.
**Impact** Role taxonomy (which drives the whole permission model) is writable by any logged-in user.
**Recommended fix** Gate with `hasAction(session, "USERS", "CREATE")` (and "VIEW" on GET if listing is
sensitive); adopt the `ok()` envelope. (Surfaced here because the SETTINGS user-types page is a primary
consumer; the route lives in the Users domain.)

### src/app/api/guard-pledgeable-documents/route.ts:40 + [id]/route.ts:8,45 — CONFLICT 🔴 (missing gate)
**What** POST (create), PATCH (update), DELETE for pledgeable document **types** only check
`if (!session)` — no `hasAction`. Sibling settings config routes (regions, offices, training-categories)
gate with `SETTINGS:CREATE/UPDATE`.
**Evidence** route.ts POST line 40-47 (no hasAction); `[id]/route.ts` PATCH line 8-14, DELETE line 45-51.
**Impact** Any authenticated user can add/rename/delete onboarding document types — a global config that
changes what every guard onboarding form requires. Inconsistent with the rest of settings.
**Recommended fix** Add `hasAction(session, "SETTINGS", "CREATE"|"UPDATE"|"DELETE")` to all three handlers.
Also adopt `ok()` envelope (currently raw `NextResponse.json`).

### src/app/api/deployment-rates/route.ts + [id]/route.ts — CONFLICT 🔴 (missing gate) + cross-flow
**What** GET/POST/PATCH/DELETE on the guard-payroll `DeploymentRate` table (fields `salary, overtime,
extraHours, postAllowance`) only check `if (!session)` — no permission gate at all. This is
money-affecting payroll config.
**Evidence** route.ts lines 8-11, 49-52; `[id]/route.ts` lines 12, 52 — no `hasAction`.
**Impact** Any authenticated user can read/create/edit/delete the rate rows that drive guard pay
(salary/overtime/post-allowance). Combined with the cross-flow finding below, the same ungated table is
also reachable from the invoicing UI.
**Recommended fix** Gate with the appropriate payroll/deployment module action
(`hasAction(session, "PAYROLL"|"DEPLOYMENTS", ...)`); adopt `ok()` envelope.

### src/components/clients/InvoicePrerequisitesManager.tsx:71-192 — CONFLICT 🔴 (RATE-FLOW SEPARATION VIOLATION)
**What** This **invoicing/billing** UI (page `/clients/invoice-prerequisites`; tabs "Default Rates",
"Invoice Header", "Guard Types") reads (`GET /api/deployment-rates`) and writes
(`POST /api/deployment-rates`, `PATCH /api/deployment-rates/:id`) the **guard-payroll** `DeploymentRate`
table. It maps `row.salary` → `effectiveRate` (line 94) and presents the guard-salary row as the
client's invoice "Default Rate." So configuring an *invoice* default rate actually creates/edits a
*guard-payroll* rate row.
**Evidence** lines 71-72 (fetch deployment-rates), 88-94 (`salary → effectiveRate`), 134/138 (POST salary),
178 (PATCH). The genuine billing SoT is `ClientContractRate` (`src/lib/invoicing/rates.ts`,
`api/clients/[id]/contracts/[contractId]/rates`) compared against `Deployment.rate` — see
`src/lib/insights/items/revenue/a1-below-contract-rate.ts:39,84` which reads `ClientContractRate.rate`
and `Deployment.rate`, NOT `DeploymentRate`.
**Impact** Direct violation of the two-flow rule: the billing/contract surface is writing into the
payroll-side rate table. Invoice "default rates" entered here never reach the invoicing engine (which
uses `ClientContractRate`/`Deployment.rate`), and they silently pollute the guard-payroll rate store.
Operators believe they are setting client billing rates; they are mutating guard-pay config. Potential
for wrong guard pay AND wrong/absent invoice rates.
**Recommended fix (root cause)** Repoint `InvoicePrerequisitesManager` to the billing SoT
(`ClientContractRate` via the contract-rates API / `src/lib/invoicing/rates.ts`). The `DeploymentRate`
table and its API must be used **only** by the guard-payroll path (`guards/deployments-rate/form.tsx`).
Add a permission gate to `deployment-rates` (above) so the billing UI cannot write payroll rates even by
accident.

### src/lib/fingerprint/store.ts:19-52 + api/fingerprint-devices — CONFLICT 🟠 (non-durable persistence)
**What** Fingerprint device config is persisted to `data/fingerprint-devices.json` via
`process.cwd()/data` (same flat-file pattern as workflow-rules). API permission uses the `GUARDS` module
(not `SETTINGS`), with inline `Response.json({ success:false, ... })` for forbidden instead of the
`forbidden()` helper.
**Evidence** store.ts `DATA_DIR = path.join(process.cwd(), "data")`, `writeFile` lines 38/52;
`api/fingerprint-devices/route.ts` lines 34/48 inline forbidden envelopes.
**Impact** On Vercel serverless the data dir is ephemeral — device edits made via `/settings/fingerprint-device`
do not durably persist across deploys/cold starts (silent config loss in prod). Module-permission drift
(GUARDS vs SETTINGS) is minor.
**Recommended fix** Move fingerprint-device persistence to a Prisma table (durable SoT). Use the
`forbidden()` helper for envelope consistency.

### src/app/(dashboard)/settings/system/page.tsx — DEAD/PLACEHOLDER 🟠
**What** `/settings/system` renders `ConfiguredInteractiveScreen` with
`moduleHubScreens.systemSettings`, which `src/lib/parity/screenConfigs.ts:600-618` labels
**"Frontend placeholder for global system settings."** It shows non-functional fields (Application Name,
Timezone, Default Currency, ...) and buttons (Submit / Save Settings / Export In Excel File) with **no
backing API** — nothing reads or writes anything.
**Evidence** screenConfigs.ts line 602 description literal; no `/api/system*` route exists; page has no
client logic beyond the static parity renderer.
**Impact** The settings overview card advertises "Application-wide preferences and runtime flags," but the
page is a static mockup. Admins may believe system settings exist/persist when they don't.
**Recommended fix** Either build a real system-settings store + API (DB-backed) or remove the card from the
settings overview (`page.tsx` line 73-78) and the route until implemented. Do not ship a placeholder that
looks live.

### src/app/api/payroll/other-deductions/route.ts:100,225 — DRIFT 🟡 (envelope)
**What** GET returns raw `NextResponse.json(rows)` and POST `NextResponse.json(saved)` — bypasses the
`ok()` envelope. (Logic is correct: it uses `PayrollDeductionEntry` as SoT, no legacy float writes,
applies `managerScopeDenied`, recomputes payroll.)
**Impact** Envelope inconsistency only; callers read the raw array. Low risk.
**Recommended fix** Wrap in `ok(...)` for contract consistency.

### NON-FINDINGS (verified clean)
- `api/insights/config` — properly gated (`SUPER_ADMIN` via `resolveDashboardRole`/`canManage`), uses
  `ok()`, validates keys against `listInsights()`. No dead config keys (config is keyed off the live
  insight registry). Graph's `upsertInsightConfig`←deployments edge is a string-fetch artifact, not real.
- Deduction rate tables + `routeFactory`/`rates.ts` — gold-standard SoT (see table B).
- No code reads dropped `Payroll.cwf/eobi/essi/trainingSchoolFees/otherDeductions` floats; columns are
  gone from schema. `other-deductions` route maps the synthetic `otherDeductions` field FROM the OTHER
  entry — consistent.
- `api/regions`, `api/regional-offices`, `api/training-categories`, `api/guard-bank-names` — gated and
  apply `deriveManagerScope`/`managerScopeDenied` where region-bound. (bank-names uses GUARDS module —
  defensible since it feeds guard forms; minor labeling drift only.)
- `guard-age-config` — gated (ADMIN_APPROVALS); configured from `/payroll/settings`, not `/settings/*`.
- `imports/workflow.ts` — an imports engine shim, not settings config; out of scope, no findings.

---

## D. Top 5 highest-risk

1. **🔴 `InvoicePrerequisitesManager` writes guard-payroll `DeploymentRate` as invoice "default rate"**
   (`src/components/clients/InvoicePrerequisitesManager.tsx:71-192`). Cross-flow violation: billing UI
   mutating payroll rate table; invoice rates entered here never reach the `ClientContractRate` engine.
2. **🔴 `api/workflow-rules` has no permission gate** (`route.ts:34-113`). Any authenticated user can
   rewrite global deployment/deduction/dual-control rules; the UI PermissionGate is cosmetic/bypassable.
3. **🔴 Four `inventoryDemand.*` toggles are dead but advertised as enforced**
   (`store-inventory/v2/demands/[id]/route.ts:27` + schema doc-comment). Admins relax constraints that
   stay hardcoded-on — silent governance gap.
4. **🔴 `api/deployment-rates` (GET/POST/PATCH/DELETE) ungated** + **`api/roles` and
   `api/guard-pledgeable-documents` mutations ungated**. Money-affecting and access-model config writable
   by any logged-in user.
5. **🔴/🟠 `UserTypesManager` is a duplicate user/role editor with a `role === "Admin"` bypass**
   (`UserTypesManager.tsx:31,143`). Region-restricted admins get full user-create + role-delete; parallel
   to the canonical Users module; uses banned `window.confirm`.

(Honorable mention 🟠: flat-file persistence of workflow-rules + fingerprint config is non-durable on
Vercel; `/settings/system` is a live-looking placeholder.)

---

## E. Confirmed-dead removal list (grep-proven)

| Item | File:line | Proof | Action |
|---|---|---|---|
| `deployments.lockAfterEnd` workflow key | policy.ts:8, BASE map :59, ENV :170, presets :127, manager desc/destructive | `grep -rn 'deployments.lockAfterEnd' src` → only definition + UI; zero `isWorkflowRuleEnabled` | Implement the gate OR remove key from policy.ts (type+BASE+presets+ENV) and WorkflowRulesManager (RULE_DESCRIPTIONS, DESTRUCTIVE_RULES, DESTRUCTIVE_CONSEQUENCES) |
| `inventoryDemand.requirePendingInitialStatus` | policy.ts:18 (+ENV/presets) | `grep` → policy.ts + doc comment only; never `isWorkflowRuleEnabled` | Wire into `demands` POST OR remove (and fix inventory-demand.ts:11 comment) |
| `inventoryDemand.enforceTransitionMap` | policy.ts:16 | transition map hardcoded at `demands/[id]/route.ts:27`; key never read | Wire to gate the hardcoded map OR remove (fix comment :12) |
| `inventoryDemand.blockCoreEditsAfterTerminal` | policy.ts:17 | `grep` → policy.ts + doc comment only | Wire OR remove (fix comment :13) |
| `inventoryDemand.requireSufficientStockForFulfillment` | policy.ts:21 | `grep` → policy.ts + doc comment only | Wire OR remove (fix comment :14) |
| Role table "Created" column (always "—") | UserTypesManager.tsx:368 | static literal; no createdAt fetched/rendered | Remove column or populate from `/api/roles` createdAt (drop with the whole duplicate manager) |
| `/settings/system` placeholder page | settings/system/page.tsx + screenConfigs.ts:600 | parity config self-labeled "Frontend placeholder"; no `/api/system*` route exists | Remove route+card until a real system-settings store exists |

Note: the 5 workflow keys are "remove only if you do not intend to implement them." Because they ship as
user-facing toggles (with descriptions and danger-zone confirms), the **recommended** path is to WIRE
them, not delete them — deletion is the fallback if the constraints are deemed unwanted.
