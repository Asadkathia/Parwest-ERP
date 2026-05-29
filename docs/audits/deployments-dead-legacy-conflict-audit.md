# Deployments — Dead / Legacy / Conflicting-Logic Audit

Read-only forensic audit of the DEPLOYMENTS domain (create/list/detail/end, deployment rates,
guard-deployment-inventory rule, and the deployment→guard-status and deployment→payroll integrity
edges). Graph index (`graphify-out/`, built 2026-04-28) used for routing; every "dead"/"conflict"
claim verified with repo-wide grep of real call sites. No source files modified.

Domain rule applied (product owner, this session): two money flows must never be conflated —
(1) **client contract → invoicing** (`ClientContractRate`) is what the client is billed;
(2) **deployment → guard payroll** (`Deployment.salary`/`Deployment.rate`, prefilled from
`DeploymentRate`) is what the guard is PAID. `DeploymentRate` / `api/deployment-rates` is the
GUARD-PAYROLL side.

---

## 1. `DeploymentRate` reader/writer map

`DeploymentRate` (model: `prisma/schema.prisma:496`) is a flat, **non-effective-dated** catalog
(`salary/overtime/extraHours/postAllowance` + `regionId/clientId/branchId/deployAs/guardType/shiftType`,
no `effectiveFrom`/`isActive`/version — "latest" = `createdAt desc, take 1`). It is **NOT read by
payroll `calculate.ts`** — that file sources base pay from the `Deployment` *row* (`Deployment.salary
?? Deployment.rate`, `calculate.ts:158`). `DeploymentRate` is therefore a **rate-suggestion prefill
catalog only** for the deploy form.

| Path | Operation | Side | Verdict |
|---|---|---|---|
| `src/app/api/deployment-rates/route.ts:22` (GET findMany) | READ | both (ambiguous) | shared endpoint |
| `src/app/api/deployment-rates/route.ts:56` (POST create) | WRITE | both | shared endpoint, no gate |
| `src/app/api/deployment-rates/[id]/route.ts:17` (PATCH update) | WRITE | invoicing only | no gate |
| `src/app/api/deployment-rates/[id]/route.ts:55` (DELETE) | WRITE | (none use it) | no gate, no UI caller |
| `src/app/(dashboard)/guards/deployments-rate/form.tsx:112,147,175` | READ + WRITE | **payroll-side** (correct) | "Deployments Rate Updation" — salary/overtime/extra/postAllowance for guards; `getPreviousRates` prefills deploy values |
| `src/components/clients/InvoicePrerequisitesManager.tsx:72,138,178` | READ + WRITE | **invoicing-side (WRONG)** | "Contract Default Rates / Client Invoice Pre-requisites" — writes the SAME table, reinterpreting columns |
| `src/lib/insights/items/revenue/a1-below-contract-rate.ts:95,132` | READ `Deployment.rate` (NOT the table) | invoicing-comparison on payroll column | reads the deployment row's `.rate` and labels it "Billed" vs contract |
| `src/lib/mockData/prismaMock.ts:314` | mock store `deploymentRate: []` | — | mock-only |

**Verdict (DeploymentRate flow): 🔴 CONFIRMED CORRUPTION.** Two different domains write the same
table through the same ungated endpoint with **incompatible column semantics**:

- Payroll form (`DeploymentRatesForm`) writes `salary` = guard's monthly salary, `overtime`,
  `extraHours`, `postAllowance`; `deployAs` = designation (e.g. "Guard", "cpo"); also POSTs an
  `exService` field that the API and schema do not have (silently dropped — dead field).
- Invoice manager (`InvoicePrerequisitesManager`) writes `salary` = the client "Effective Rate"
  (a billing number), `deployAs` = a **city / branch name**, and overloads `shiftType="BOTH"` to
  encode an "Enqueue=Yes" UI flag.

Both rows land in the same `DeploymentRate.findMany` that `DeploymentRatesForm`'s "Get Previous
Rates" reads to **prefill the deploy form (payroll side)**. An invoice-side row therefore poisons
the payroll prefill catalog: a row whose `salary` is a *client billing rate* and whose `deployAs`
is a *city* can be surfaced as a guard's previous salary/overtime when an operator clicks "Get
Previous Rates" with matching region/guardType filters. The mitigation is weak (different filter
columns reduce but do not prevent overlap, e.g. region+guardType+shiftType=BOTH matches both
writers). This is exactly the Settings-audit finding confirmed from the deployments side: the
invoicing UI is writing into the guard-payroll rate source.

---

## 2. Deployment lifecycle + integrity table

| Integrity question | Enforced at write time? | Where | Verdict |
|---|---|---|---|
| **Concurrent deployment blocked?** | Partially — up to **2** active allowed (1 DAY + 1 NIGHT double-duty); same-shift / BOTH blocked | `api/deployments/route.ts:402-451` | Insight B5 claims >1 is "impossible" → **conflict with the rule** |
| **Payrolled-without-deployment blocked?** | **NO** — explicit `guardId`/`guardIds` payroll runs never check for a deployment; `calculate.ts` yields `basePay=0, deploymentDays=0` rows | `api/payroll/calculate/route.ts:69-100`, `calculate.ts:116-158` | 🔴 only detective (insight B3) |
| **Guard status reconciled via canonical lifecycle?** | NO — create/end/DELETE write only the legacy `Guard.status` shadow via `syncLegacyStatus`, bypassing `applyTransition` | `api/deployments/route.ts:552`, `[id]/end/route.ts:94`, `[id]/route.ts:52` | drift vs `lifecycle.ts` contract |
| **Deploy requires ACTIVE guard?** | Yes, gated | `api/deployments/route.ts:201` (`deployments.requireActiveGuardStatus`) | OK |
| **Ended deployment locked from edit?** | No edit path exists (PATCH removed). `lockAfterEnd` toggle never read; re-end blocked by `blockInactiveUpdate` (DELETE) / hardcoded (end POST) | see §3 lockAfterEnd | 🟠 dead toggle, misleading UI copy |

---

## 3. Findings by submodule

### `src/app/api/deployment-rates/route.ts:47` and `src/app/api/deployment-rates/[id]/route.ts:6,46` — CONFLICT 🔴
**What:** GET/POST/PATCH/DELETE on the guard-payroll rate table gate on `auth()` only — **no
`hasAction(...)` permission check**, unlike every other money-bearing route in the app.
**Evidence:** No `hasAction`/`managerScopeDenied` import in either file. `middleware.ts` matcher
(`middleware.ts:75-91`) does NOT cover `/api/*`, so the API is reachable by any authenticated user
regardless of module permissions. (The *pages* `/guards/deployments-rate` and
`/clients/invoice-prerequisites` are module-gated by middleware under `/guards` and `/clients`, but
the API — the actual mutation surface — is not.)
**Impact:** Any logged-in user (e.g. a TICKETING-only regional user) can create, edit, or delete
guard-payroll rate records via direct API calls, with no regional scoping. Combined with §1 this is
a write path into the payroll prefill source with zero authorization.
**Fix (root-cause):** Add `hasAction(session, "PAYROLL"/"GUARDS", "UPDATE")` + `deriveManagerScope` +
`managerScopeDenied` to all four handlers; convert envelopes to `src/lib/api/response.ts` helpers.
Co-change with the §1 split (see below) so invoicing no longer touches this endpoint at all.

### `src/components/clients/InvoicePrerequisitesManager.tsx:72,138,178` — CONFLICT 🔴
**What:** The invoicing prerequisites screen reads and writes `DeploymentRate` (the guard-payroll
table) as "Contract Default Rates," reinterpreting `salary`→billing rate, `deployAs`→city,
`shiftType=BOTH`→"Enqueue=Yes".
**Evidence:** `onSave` POSTs `{regionId, deployAs: city, guardType, salary: effectiveRate, shiftType}`
to `/api/deployment-rates` (line 138); `onApplyEditRate` PATCHes `/api/deployment-rates/${id}` (line 178);
load reads `/api/deployment-rates` (line 72). Column overloading at lines 91-96, 130-136.
**Impact:** Invoicing writes corrupt the payroll-rate prefill catalog (see §1 verdict). Money-flow
conflation that the product owner explicitly forbade.
**Fix (root-cause):** Invoicing default rates belong on the **client-contract** side. Either point
this manager at `ClientContractRate` (or a new dedicated `InvoiceDefaultRate` table) and stop using
`DeploymentRate` entirely. The minimal patch (give it its own endpoint/table) is correct here; do
not "filter around" the overlap — the two concerns must own separate tables.

### `src/app/api/deployments/route.ts:402-451` vs `src/lib/insights/items/ghost/b5-concurrent-deployment.ts:7` — CONFLICT 🟠
**What:** The create route deliberately permits **2** concurrent ACTIVE deployments (one DAY + one
NIGHT, "double duty"; cap enforced at line 444). Insight B5's description states multiple active
deployments "should be impossible per business rules" and flags any guard with `_count > 1`.
**Evidence:** create logic lines 402-446; B5 `groupBy ... having _count > 1` (b5 lines 16-22).
**Impact:** B5 raises HIGH-severity false positives for every legitimately double-deployed guard,
eroding trust in the anomaly dashboard.
**Fix:** Align B5 with the real invariant — flag only (a) `_count > 2`, or (b) two ACTIVE rows with
overlapping shift (same shiftType, or any row with `shiftType=BOTH` plus another active row). Encode
the same shift-conflict predicate the create route uses so detection matches enforcement.

### `src/lib/insights/items/ghost/b3-payrolled-without-deployment.ts` + `src/app/api/payroll/calculate/route.ts:69-100` — CONFLICT 🔴
**What:** There is **no write-time guard** preventing payroll for an undeployed guard. B3 only
*detects* it after the fact.
**Evidence:** `calculate/route.ts` resolves target guards from explicit `guardId`/`guardIds`
(lines 69-72) with no deployment existence check; `calculate.ts` computes `basePay` purely from
`Deployment` rows (lines 116-159) and emits `deploymentRowCount`/`deploymentDays=0` without throwing
(no guard at `persist.ts`; its only throw is the locked-state guard at line 50). Only the *bulk-by-
deployment* derivation path (lines 74-100) implicitly requires a deployment; the single/explicit
paths bypass it.
**Impact:** A guard with zero deployments that month can be paid (netSalary from special-duty / extra-
hours / allowances) — the ghost-payee pattern, caught only by a dashboard insight.
**Fix (root-cause):** Add an enforced precondition in the payroll pipeline (e.g. a
`payroll.requireDeploymentForPay` workflow rule checked in `calculate/route.ts` or `persist.ts`) that
refuses to persist a payroll row when `deploymentRowCount === 0` unless an explicit override is set.
Keep B3 as the detective backstop.

### `src/lib/workflows/policy.ts:6,59` (`deployments.lockAfterEnd`) — DEAD 🟠
**What:** The `deployments.lockAfterEnd` workflow toggle is rendered and described in settings but
**never read by any deployment code path**.
**Evidence:** grep for `lockAfterEnd` shows hits only in `policy.ts` (declaration/default/env-map) and
`WorkflowRulesManager.tsx` (settings UI label + warning copy). No `isWorkflowRuleEnabled("deployments.
lockAfterEnd")` call exists anywhere. The end-form dialog copy even tells admins the action "cannot be
reverted while the lock-after-end rule is on" (`[id]/end/form.tsx:483-485`), implying enforcement that
does not exist.
**Impact:** Admins believe toggling `lockAfterEnd` changes edit-locking of ended deployments; it does
nothing. (In practice deployments have no edit/PATCH path at all — `[id]/route.ts:10-11` notes PATCH
and `/change` were removed — so the *intent* of the toggle is already moot, but the misleading UI copy
and dead toggle remain.)
**Fix:** Remove the toggle (and the settings warning copy + the misleading sentence in
`end/form.tsx`), OR wire it to actually block re-revoke/edit. Since there's no edit path, removal is
the honest option; if a future edit path is added, gate it on this key.

### `src/app/api/deployments/[id]/route.ts:52` vs `src/app/api/deployments/[id]/end/route.ts:75-103` — CONFLICT 🟠
**What:** Two code paths "end" a deployment with **divergent transactionality and preconditions**.
- DELETE (`[id]/route.ts`): sets `status:"INACTIVE", endDate:now`, then calls `syncLegacyStatus`
  **outside** any transaction (line 52); gated by `blockInactiveUpdate`; no status-history record.
- POST `/end` (`[id]/end/route.ts`): wraps update + `syncLegacyStatus` + re-read in a
  `$transaction` (lines 75-103); records `GuardStatusHistory` when status changes; hardcodes the
  "already ended" check (line 43-45) instead of `blockInactiveUpdate`.
**Evidence:** as cited. Both write the legacy `Guard.status` shadow; neither calls the canonical
`applyTransition`.
**Impact:** Non-atomic DELETE path can leave `Deployment.status=INACTIVE` while `Guard.status` stays
stale if `syncLegacyStatus` fails after the update. DELETE produces no audit history. Two writers,
different preconditions — the same split the GUARDS audit flagged for guard status.
**Fix (root-cause):** Collapse to a single end pathway. Route DELETE through the same transactional
helper as POST `/end` (or have DELETE delegate to it), and reconcile guard status through the canonical
`applyTransition`/lifecycle helper so `GuardStatusHistory` and the legacy shadow are always written
atomically. Standardize the "already ended" guard on one rule.

### `src/lib/guards/lifecycle.ts:18` (contract) vs deployment write paths — CONFLICT 🟠
**What:** `lifecycle.ts` docstring asserts "All writes to status/lifecycleStatus MUST go through
`applyTransition`." Deployment create (`route.ts:552`), end (`end/route.ts:94`), and DELETE
(`[id]/route.ts:52`) write `Guard.status` directly via `syncLegacyStatus`, never touching
`lifecycleStatus`.
**Evidence:** as cited; `applyTransition` is imported nowhere under the deployment routes.
**Impact:** The legacy shadow can drift from `lifecycleStatus` (e.g. deploying a guard whose
`lifecycleStatus` is somehow not ACTIVE flips the shadow to PRESENT without a transition record on the
lifecycle dimension). Status SoT is split between two mechanisms.
**Fix:** Treat `syncLegacyStatus` as a derived projection only; ensure deployment changes that should
affect lifecycle go through `applyTransition`, and that `syncLegacyStatus` is acknowledged in the
lifecycle contract as the deployment-shadow recompute (or folded into the helper).

### `src/app/api/guard-deployment-inventory-rule/route.ts:46` — CONFLICT 🟡
**What:** The `GET` handler performs an `upsert` (a **write**) — it creates the default rule row on
read.
**Evidence:** `GET` calls `ruleDelegate.upsert(...)` (lines 46-54).
**Impact:** A read endpoint mutates state; any user with `INVENTORY:VIEW` triggers a row creation.
Minor, but a GET should be side-effect-free (caching/replay hazards).
**Fix:** Make GET read-only (`findUnique` → return defaults if null); move the seed to the PUT handler
or a migration.

### `src/app/api/guard-deployment-inventory-rule/route.ts` (wiring) — OK (wired, not dead)
The rule **is** enforced: `api/deployments/route.ts:344-400` reads
`guardDeploymentInventoryRule.findUnique({ruleKey:"default"})` and, when `isActive`, blocks
deployment unless the guard has ≥ `minimumAssignedItems` ASSIGNED store-inventory items (region- and
category-scoped). Not dead. Note both reader and writer access the delegate via an `as unknown` cast
(`route.ts:344`, rule-route `:21,97`) because the generated client may lag the schema — a stale-client
fragility, but functional.

### `src/app/api/deployment-rates/route.ts:18` & `deployments-rate/form.tsx:143,184` (`exService`) — DEAD 🟡
**What:** The deploy-rates form sends `exService` both as a save field (form line 184) and as a "Get
Previous Rates" filter (form line 143), but `DeploymentRate` has no `exService` column and the API
neither reads nor writes it.
**Evidence:** schema model (no `exService` field); POST body omits it (`route.ts:56-68`); GET filter
list omits it (`route.ts:13-20`).
**Impact:** The Ex-Service dropdown on the rate form is a no-op — selecting it changes nothing on save
or on prefill lookup. Silent data loss / dead UI control.
**Fix:** Either add `exService` to the model + API filter, or remove the control from the form. Given
the table is slated for the §1 split, remove it.

### `src/components/deployments/DeploymentsListClient.tsx:81-86` (status filter options) — DEAD 🟡
**What:** Status filter offers `ACTIVE | INACTIVE | PAUSED | ENDED`, but deployment rows are only ever
written `ACTIVE` (create), `PENDING` (create, if requested), or `INACTIVE` (end/DELETE). `PAUSED` and
`ENDED` are never produced by any code path; `PENDING` is never offered as a filter.
**Evidence:** writes at `api/deployments/route.ts:493-495` (`ACTIVE|PENDING|INACTIVE`), end/DELETE →
`INACTIVE`. GET allow-list `{ACTIVE, INACTIVE, PAUSED, ENDED}` (`route.ts:45`) mirrors the same dead
values.
**Impact:** Selecting "Paused"/"Ended" always returns zero rows; "Pending" deployments are unfilterable.
**Fix:** Align the filter options + GET allow-list to the actual status vocabulary
(`ACTIVE|PENDING|INACTIVE`).

### `src/components/deployments/DeploymentsListClient.tsx:339` & `[id]/page.tsx:67,86` (status badge) — LEGACY 🟡
**What:** Deployment status is rendered with `GuardStatusBadge` (which maps **guard** statuses like
PRESENT/DEFAULT), not a deployment-status badge. The detail page renders deployment status and guard
status with the same generic secondary `Badge`.
**Impact:** Type/semantics mismatch; a deployment `INACTIVE`/`PENDING` is colored by a guard-status
map. Cosmetic + a11y risk (label may not match the deployment vocabulary).
**Fix:** Use a deployment-specific status badge with the real vocabulary; out of strict
dead/legacy/conflict scope but flagged as drift.

### `src/lib/mockData/deployments.ts:1-39` — LEGACY 🟡 (mock-only)
**What:** `MockDeployment` shape has bare string `guardId`/`clientId`/`branchId` (with human names as
values) and lacks `regionalOfficeId`, `shiftType`, `deploymentType`, and the nested
`guard`/`client`/`branch`/`regionalOffice` objects the real GET returns and `DeploymentsListClient`
consumes.
**Evidence:** GET mock branch references `row.regionalOfficeId` and `row.status` (`route.ts:60-69`) but
mock rows have no `regionalOfficeId`; the list client reads `r.guard.name`, `r.client.name`,
`r.branch.city` which mock rows don't provide.
**Impact:** Deployments list is broken/empty under `NEXT_PUBLIC_USE_MOCKS=true`. Mock-only, no prod
impact.
**Fix:** Bring the mock shape to parity with the real GET projection if mock mode is meant to support
the deployments list.

### `src/lib/insights/items/revenue/a1-below-contract-rate.ts:132,145` — CONFLICT 🟡 (cross-domain framing)
**What:** Reads `Deployment.rate` (a guard-payroll column per the domain rule) and labels it
"Billed ₨X vs contract" — framing a payroll-side number as the billed/invoiced amount.
**Impact:** Mild money-flow conflation in reporting; conclusions ("monthly loss") are computed off the
payroll rate rather than an invoicing rate. Not a write corruption, but a semantic mismatch with the
two-flow rule.
**Fix:** Source the "billed" figure from the invoicing side (`ClientContractRate`/invoice line items),
not `Deployment.rate`. Lower priority than §1.

### `src/app/api/deployment-rates/[id]/route.ts:46` (DELETE) — DEAD 🟡 (suspected)
**What:** `DELETE /api/deployment-rates/[id]` has **no UI caller**.
**Evidence:** grep of `deployment-rates/` call sites shows only GET/POST (both forms) and PATCH
(invoice manager edit). No client issues a DELETE.
**Impact:** Reachable ungated mutation with no UI surface. Low risk but dead.
**Fix:** Remove, or gate behind permissions when the §1 split happens.

---

## 4. Top 5 highest-risk

1. **🔴 `DeploymentRate` is written by BOTH invoicing and payroll UIs through one ungated endpoint
   with incompatible column semantics** (§1; `InvoicePrerequisitesManager.tsx:138/178` +
   `deployment-rates/route.ts:47`). Invoice rows poison the payroll "Get Previous Rates" prefill.
   Fix = split the tables/endpoints so invoicing never touches `DeploymentRate`.
2. **🔴 `/api/deployment-rates` (all verbs) has no permission gate and no regional scope**
   (`route.ts:47`, `[id]/route.ts:6,46`). Any authenticated user can mutate guard-payroll rate
   records via direct API. The pages are module-gated; the API is not.
3. **🔴 Payrolled-without-deployment is not prevented at write time** — explicit/bulk-by-id payroll
   runs skip the deployment check; `calculate.ts` emits zero-deployment rows; B3 is only detective
   (`payroll/calculate/route.ts:69-100`, `calculate.ts:116-159`).
4. **🟠 Two divergent deployment-end paths (DELETE non-transactional + no history; POST /end
   transactional + history) and neither uses the canonical `applyTransition`**
   (`[id]/route.ts:52`, `[id]/end/route.ts:75-103`, `lifecycle.ts:18`). Status-drift + audit gap.
5. **🟠 B5 concurrent-deployment insight contradicts the enforced rule** (2 active allowed for
   day+night double-duty) → HIGH-severity false positives (`b5:7,16` vs `route.ts:402-451`).
   Honorable mentions: dead `lockAfterEnd` toggle with misleading end-form copy (§3); GET-with-upsert
   on the inventory rule (§3).

---

## 5. Confirmed-dead removal list (with proof)

| Item | Proof | Action |
|---|---|---|
| `deployments.lockAfterEnd` workflow toggle | No `isWorkflowRuleEnabled("deployments.lockAfterEnd")` call exists; hits only in `policy.ts` + `WorkflowRulesManager.tsx`. No deployment edit path exists (PATCH removed, `[id]/route.ts:10-11`). | Remove toggle + settings warning copy + the misleading "lock-after-end" sentence in `end/form.tsx:483-485`. |
| `exService` on deploy-rates form (save field + filter) | `DeploymentRate` model has no `exService`; API ignores it (`deployment-rates/route.ts:13-20,56-68`). | Remove the Ex-Service control + filter from `deployments-rate/form.tsx` (or add column — but table is slated for split). |
| `PAUSED` / `ENDED` deployment status filter options (+ GET allow-list entries) | No write path produces these values (`route.ts:493-495`, end/DELETE → `INACTIVE`). | Remove from `DeploymentsListClient.tsx:81-86` and the GET allow-list `route.ts:45`; add `PENDING`. |
| `DELETE /api/deployment-rates/[id]` | No client call site (grep of `deployment-rates/`). | Remove (or gate) — suspected dead. |
| `mockData/deployments.ts` shape | Shape-drifted from real GET; list client cannot render it. | Mock-only; update to parity or drop if mock mode unsupported for deployments. |

---

### Methodology notes
- Graphify importer counts are unreliable for API routes (string-fetched); all "dead" calls verified
  by repo-wide grep of real fetch/import sites.
- The GRAPH_REPORT "surprising connection" `PATCH() in deployments/[id]/route.ts --calls-->
  upsertInsightConfig()` is a **stale graph artifact** — `[id]/route.ts` currently has only `DELETE`
  (PATCH was removed per the file's own header comment). Disregarded.
- Severity calibrated to the integrity theme: money/payroll-corruption and missing write-time
  integrity = 🔴; drift between enforcement and detection/contract = 🟠; dead UI/fields = 🟡.
