# Parwest ERP — Remediation Checklist

Generated 2026-05-26 from `docs/audits/*-audit.md`. Tackle **Phase 0 first**, then module by module.

**Working rules (do not skip):**
- No `git commit`/`push` without explicit user permission. Run `/code-review` before any push to `origin/main`.
- Run `npx prisma generate` before trusting `npx tsc --noEmit` whenever schema changes.
- Read `project_workflow_rules.md` (memory) before editing validation/permission/scope code.
- Root-cause fixes only — no symptom patches. One canonical writer per concern.
- After each item: `npx tsc --noEmit` + `npm run lint:guard` green; note verification in the PR/commit when the user approves.

Severity: 🔴 breaks prod/security · 🟠 drift · 🟡 cleanup. Bucket: C=conflict, D=dead, L=legacy.

---

## Phase 0 — Shared foundations (build once, every module reuses)

- [ ] **F0.1 — Central server authz guard.** Add `requireModule(session, MODULE, action)` (returns `forbidden()` on miss) + `requireScope(...)` helpers in `src/lib/api/`. These wrap `hasAction` + `managerScopeDenied`. Goal: every mutation route calls one guard; omission fails closed. *(kills ungated-route findings across Guards/Clients/Users/Settings/Deployments)*
- [x] **F0.2 — Single `isSuperAdmin`.** DONE: `state-permissions.ts` now re-exports canonical → tickets + payroll-state inherit the fix. Remaining inlined copies (invoicing manager, imports/jobs, permission-gate, roles/[id], role-permissions) are correct MATCH mirrors per the Users audit — lower-priority dedup, address in Users module.
- [~] **F0.3 — `requireGuardInScope` + `requireClientInScope`.** `requireGuardInScope` DONE (`src/lib/guards/access.ts`, used across Guards sub-resources). `requireClientInScope` still TODO for Clients module.
- [ ] **F0.4 — Unify permission resolution.** One shared resolver for (RolePermission ∪/replace UserPermission) used by BOTH `lib/auth.ts buildPermissionSet` AND `api/user-permissions` GET. Decide the model (recommended: UNION = what the UI shows); make PUT store additive deltas. *(Users silent-revocation)*
- [ ] **F0.5 — Rate-flow table split.** Stop invoicing from writing `DeploymentRate`. Repoint `InvoicePrerequisitesManager` to `ClientContractRate` (or a new `InvoiceDefaultRate` table). `DeploymentRate` becomes payroll-only. *(Deployments #1/#2 + Settings #1 + Clients #1)*
- [ ] **F0.6 — Canonical single-writer helpers.** `setClientStatus(tx, ...)` (mirror `transitionGuard`), `assignGuardSupervisor(tx, ...)` (mirror client `assignSupervisor`), `applyStockMovement(tx, ...)` for inventory balance. Route all writers through them; ensure deployment status writes go through `applyTransition`.

---

## Module 1 — USERS / AUTH  ✅ DONE (1 isomorphic extraction deferred) — 2026-05-26, uncommitted — security-critical

- [x] 🔴 C — `users/[id]` PATCH + `users` POST: GLOBAL-role assignment requires `isSuperAdmin(session)` server-side; self-`roleId` change blocked for non-SuperAdmin. **Live escalation closed.** *(U1)*
- [x] 🔴 C — `api/roles` POST gated `USERS:CREATE`; GET gated `USERS:VIEW`. *(U1)*
- [x] 🔴 C — `role-permissions` GET + `user-permissions` GET gated `USERS:VIEW` (permission-matrix disclosure closed). *(U1 + U2)*
- [x] 🔴 C — Perm resolver **unified** (NEW `src/lib/permissions/resolve.ts`): UNION per action; same SoT used by `lib/auth.ts buildPermissionSet` (JWT) AND `api/user-permissions` GET (UI). Silent revocation killed. **⚠️ Behavioral expansion** — users with saved overrides regain previously-silently-stripped role permissions on next token refresh (matches the UI's "Role OR Additional" promise). *(U2)*
- [x] 🟠 C — `roles/[id]` DELETE + `role-permissions` PUT: ad-hoc `"Admin"`/`"admin"` checks replaced with canonical `isSuperAdmin`. *(U1)*
- [x] 🟠 C — NEW `src/lib/guards/supervisorAssignment.ts` (`assignGuardSupervisor`); single terminal status `"ENDED"` across `switch-supervisor` + `guards/[id]/supervisor` PATCH; `cs-relationships` POST routes through `assignSupervisor` SoT. *(U3)*
- [x] 🟠 C — `users/[id]` PATCH self-roleId guard (above). *(U1)*
- [x] 🟠 L — `UserTypesManager` decommissioned: component deleted, `/settings/user-types` → `redirect("/users")`. *(U4)*
- [x] 🟡 C — cs/ms/search pages now gate with `auth()` + `hasAction("USERS","VIEW")`. *(U4)*
- [x] 🟡 L — `ok()`/`badRequest()` envelope on cs/ms/role-permissions/users/roles routes (with 5 consumer-unwrap patches: CsRel/MsRel/switch-supervisor managers, GuardStatusSupervisorEditor, deploy/form). *(U1+U3+integration)*
- [ ] 🟡 L — `permission-gate.tsx`: extract isomorphic `isSuperAdmin`/`permKey`. **DEFERRED** (touches client/server module boundary + edge-runtime constraints).
- [x] 🟡 D — `userLinks` (`screenConfigs.ts`) + `/users/permissions` stub deleted (0 importers). *(U4)*

**Out-of-lane TODOs flagged (low-pri):**
- `guards/route.ts:355` + `guards/[id]/route.ts:241-254` still write supervisor terminal status inline (matches canonical `"ENDED"` but bypasses `assignGuardSupervisor` SoT).
- `TODO(consumer-unwrap)` markers on `/api/users` + `/api/roles` + `/api/role-permissions` GETs — kept raw to avoid breaking ~10 list consumers; sweep when comfortable.
- `UserPermissionsManager.tsx` consumer still expects raw shape on `/api/user-permissions` GET/PUT/DELETE (U2 kept raw to avoid breakage).
- Settings landing card still links `/settings/user-types` (now 308-redirects to `/users` — functional).
- Stale envelope `code: "ROLE_IN_USE"` discriminator lost on roles/[id] DELETE 409 (now standard `"CONFLICT"`; no consumer reads the old code).

**Verify:** `tsc` fully clean (src). `lint:guard` 0 net-new (same 4 pre-existing). **Not committed.**

## Module 2 — GUARDS  ✅ DONE (1 item deferred) — 2026-05-26, uncommitted

- [x] 🔴 C — `system-doc` GET: `requireGuardInScope` + `hasAction(GUARDS,VIEW)`. *(G2)*
- [x] 🔴 C — `guards/deployments-rate/form.tsx`: deleted `LEGACY_REGIONS`/`LEGACY_CLIENTS`; empty-on-empty. *(G4)*
- [x] 🔴 C — `validateGuardPayload()` (new `src/lib/guards/validate-payload.ts`) called from POST + PUT; schema/wizard/import converged on shared primitives. *(G1)*
- [x] 🟠 C — Centralized deployed-guard transition precondition in `lifecycle.ts` (`ActiveDeploymentTransitionError`); PUT inherits it + 409 translation added; `status` route deduplicated. *(G3 + integration)*
- [x] 🟠 C — `requireGuardInScope` on `photo`/`courses`/`insurance`/`pledged-docs`/`attendance/auto-generate`/`supervisor`/`prerequisites/[prereqId]`. *(G2,G3)*
- [x] 🟠 C — `supervisor` PATCH: validate ACTIVE Supervisor-role user in scope. *(G2)*
- [x] 🟠 C — `resolveExServiceType()` shared by POST/PUT (no null-vs-CIVILIAN drift). *(G1)*
- [x] 🟠 C — `cnicAvailability()` (new `src/lib/guards/cnic.ts`) shared by POST/PUT/check-cnic. *(G1)*
- [ ] 🟠 L — `currentContext.ts`: expose `lifecycleStatus`/`isDeployed`; migrate payroll consumers. **DEFERRED to Payroll module (touches payroll components).**
- [x] 🟠 C — `prerequisites/manager.tsx`: `data.error`→`data.message` (8×). *(G4)*
- [x] 🟡 C — `GuardStatusSupervisorEditor`: `window.confirm`→AlertDialog. *(G4)*
- [x] 🟡 L — initial PENDING status history seeded inside create tx (POST + import). *(G1)*
- [x] 🟡 D — `guard-create.ts`: converged onto shared primitives (zodResolver swap deemed high-risk; documented). *(G1)*
- [x] 🟡 D — deleted `InventoryTab`, `GuardsFilterBar`, `AdvancedFilterPanel`, `ProfileIncompleteBanner` (0 importers re-verified). *(G4)*

**Verify:** `tsc` clean for Guards (2 errors are stale `.next/` artifacts from the uncommitted Clients page deletion). `lint:guard` — 0 net-new from Guards; the 4 flagged are pre-existing-on-main (verify-guards-import, deploy/form, new/form Math.random, DraftGrid) surfaced by newer React Compiler rules vs a stale baseline. **Not committed.**

## Module 3 — CLIENTS  ✅ Clean-file items DONE (3 items remain in your in-flight refactor) — 2026-05-26, uncommitted

- [x] 🔴 C — contract PATCH + rate POST/PATCH bind lookup to `{id, clientId}` (IDOR closed); contract POST verifies `branchId` ownership. *(C1)*
- [x] 🔴 C — CSV import: required `region` FK column; `city` derived via `cityForRegionId`; phone/email/CNIC use shared format validators; required-set deviations from `clientCreateSchema` documented in file header. *(C2)*
- [x] 🔴 D — `PricingConfig` route DELETED; deploy form's guardType dropdown now sources from **canonical `src/lib/constants/guardTypes.ts`** (contract-independent, per workflow rule "deployment first, contract later"); InvoicePrereq screen + page + nav entry DELETED (broken-by-design — writes never reached the invoicing engine). Prisma `PricingConfig` model drop deferred with TODO. *(C3 — answers product Q1+Q2)*
- [ ] 🟠 C — `Client.status` 4 writers → `setClientStatus`. **OWNED BY YOUR IN-FLIGHT REFACTOR** (`clients/[id]/route.ts` modified by you) — reconcile after commit.
- [ ] 🟠 C — branch supervisor via `assignSupervisor`. **OWNED BY YOUR IN-FLIGHT REFACTOR** (you added `src/lib/clients/supervisorAssignment.ts` — likely already addresses).
- [x] 🟠 C — contract POST `branchId` ownership verified (done above in C1).
- [x] 🟠 C — imports validation aligned with current `clientCreateSchema` (done in C2, with documented deviations).
- [ ] 🟠 L — `createBranch(tx, input)` shared helper. **OWNED BY YOUR IN-FLIGHT REFACTOR** (branch consolidation).
- [ ] 🟡 C — `advance-payments` PAYROLL-vs-CLIENTS gate intent (low-pri; needs your decision).
- [ ] 🟠 D — dead nested `POST /api/clients/[id]/branches`. **MAY BE OWNED BY YOUR REFACTOR** (file is in your modified set).

**Verify:** `tsc` fully clean (src). `lint:guard` 0 net-new. **Not committed.** Remaining 4 items reconcile against your in-flight Clients refactor once you commit/stash it.

## Module 4 — INVENTORY  ✅ DONE (2 schema items + ops deferred) — 2026-05-26, uncommitted

- [x] 🔴 C — purchase double-count killed: create-as-RECEIVED rejected; `[id]/receive` is the sole stock-entry path; NEW `src/lib/inventory/stock-movement.ts` `applyStockMovement` (atomic increments + quantity-weighted avg cost). *(I1)*
- [x] 🔴 C+D — deleted `lib/inventory/demand-status.ts`; NEW `demand-status-machine.ts` mirrors the real 7-state Prisma enum. *(I3)*
- [x] 🔴 C — `v2/inventories`: now uses shared `requireInventorySession()` (consistent w/ 21 siblings; gate is module-level like them). *(I2)*
- [x] 🟠 C — all 7 `StoreInventoryBalance` writers migrated to `applyStockMovement`; availability = onHand−held−issued enforced in assignment + demand-allocate sufficiency. *(I1)*
- [ ] 🟠 C — promote `[WORKFLOW_META]`/`[PO_META]` JSON-in-notes → real columns/tables. **DEFERRED (schema migration + prod-data).** Receive-history kept in notes for now (double-count already fixed via the create-RECEIVED guard).
- [x] 🟠 C — `guards/[id]/store-inventory`: `ok(rows)` + `internalServerError`; `StoreInventoryTab` consumes via shared `apiGet`. *(I2)*
- [x] 🟠 L — `v2/demands` consolidated onto shared status machine; create restricted to `DRAFT`/`SENT`. *(I3)*
- [x] 🟡 L — shared `isWeaponCategoryName` adopted in demands. *(I3)* (local `normalizeCategoryScope` rename left — borderline 🟡, sanctioned by validators comment.)
- [x] 🟠 D — `v2-flags.ts` collapsed to `{ writeEnabled }`; `getPublicInventoryV2Flags` + 4 dead fields removed. *(I4)*
- [x] 🟠 D — legacy `inventoryCategory` masters fallback removed. **Prisma `Inventory*` model DROP DEFERRED (migration + prod-data check).** *(I4)*
- [x] 🟠 D — deleted `store-inventory-v2/RolesManager.tsx`, `UsersManager.tsx` (0 importers). *(I4)*
- [x] 🟡 D — removed empty `api/inventory/*` + non-v2 `store-inventory/{vendors,...}` skeleton dirs. *(I4)*
- [ ] ⚠️ OPS — verify `INVENTORY_V2_WRITE_ENABLED` set in Vercel prod (else all v2 writes 403). **USER ACTION.**
- [ ] 🟡 DEFER — remove 9 now-dead env vars (`INVENTORY_V2_ENABLED`, `_READ_FROM_V2`, `_LEGACY_READONLY`, `_CUTOVER_COMPLETE` + 5 `NEXT_PUBLIC_*`) from `.env`/Vercel. **USER ACTION (.env).**

**Verify:** `tsc` clean (src). `lint:guard` — 0 net-new (same 4 pre-existing as Guards run). **Not committed.**

## Module 5 — SETTINGS  ✅ DONE (3 cross-module/schema items deferred) — 2026-05-26, uncommitted

- [x] 🔴 C — `api/workflow-rules` gated (`SETTINGS:VIEW/UPDATE`) + `ok()` envelope. **DB persistence DEFERRED** (schema migration; TODO left in route). *(S1)*
- [x] 🔴 C — 4 `inventoryDemand.*` keys WIRED into demand routes (create initial-state, transition map, terminal-edit block, fulfillment stock check). Defaults unchanged. *(S3)*
- [x] 🔴 C — `guard-pledgeable-documents` POST/PATCH/DELETE gated `SETTINGS:*` + `ok()`. *(S1)*
- [x] 🔴 C — `api/deployment-rates` gate — done in D1 (Deployments).
- [ ] 🔴 C — `InvoicePrerequisitesManager` repoint off `DeploymentRate`. **DEFERRED → Clients** (its writes already 403 by D1's gate).
- [ ] 🟠 C — fingerprint config Prisma persistence. **DEFERRED** (schema migration).
- [x] 🟠 D — `/settings/system` placeholder removed + 4 broken referrers fixed (`user/updateLogos` redirect → `/settings`, command-palette ×2 → `/settings`, sidebar nav line removed, stale end-form comment removed). *(S2 + integration)*
- [x] 🟠 D — `deployments.lockAfterEnd` key removed everywhere (policy.ts + UI metadata). *(S2; D3 had already removed the misleading UI copy)*
- [x] 🟡 L — `WorkflowRulesManager`: 6 descriptions + 3 module labels added; `RULE_DESCRIPTIONS` hardened to exhaustive `Record<WorkflowRuleKey, string>`. *(S2 + 1 lookup-widen fix at line 170)*
- [ ] 🟡 — `payroll/other-deductions`: wrap in `ok()`. **DEFERRED → Deductions module.**

**Integration patches:** wire-format seam from `ok()` adoption (4 consumers updated to unwrap `payload.data`: `WorkflowRulesManager`, `GuardPledgeableDocumentsManager`, `PledgedDocumentsTab`, `guards/prerequisites/manager`) + 4 broken `/settings/system` refs + stale `lockAfterEnd` comment + the WorkflowRulesManager `humanizeDescription` lookup widening.

**Verify:** `tsc` fully clean (src). `lint:guard` 0 net-new. **Not committed.**

## Module 6 — PAYROLL  ✅ DONE (1 redesign + 1 cross-module deferred) — 2026-05-26, uncommitted

- [x] 🔴 C (F-1) — `state-permissions.ts` `isSuperAdmin` now re-exports canonical (`@/lib/api/permissions`) → fixes 7 payroll-state + 3 tickets routes; Super User no longer locked out. *(P1, = F0.2)*
- [x] 🔴 C (F-2) — `salary/[id]` PATCH no longer writes `paymentStatus`; `state/mark-paid` is the sole PAID writer (state↔paymentStatus locked); Unpaid UI routed through it. *(P1)*
- [x] 🔴 C (F-4) — all 5 loan paths (create/edit/bulk/finalize/unfinalize) call `recalcAffectedMonths`; `unfinalize` got the missing locked-month guard. *(P2)*
- [ ] 🟠 C (F-3) — `salary-slips/generate` derive from canonical. **DEFERRED** — redesign (affects the physical payslip; must handle months with no canonical Payroll row).
- [x] 🟠 D+C (F-5) — legacy `special-duty` + `[id]` routes deleted (0 callers; live UI uses `special-duty-records`). *(P3)*
- [x] 🟡 D (F-6) — `overtime` + `[id]` deleted (0 callers). **Product: confirm overtime isn't a planned feature.** *(P3)*
- [x] 🟡 L (F-7) — `PayrollDefault` CRUD routes + `PayrollDefaultsTab` removed; settings default tab → `deductions`. **Prisma model drop deferred** (`spBrVer*` dead; cwf/training need deductions coordination). *(P3)*
- [x] 🟡 D (F-8/F-9) — `PayrollLoanManager.tsx`, `PayrollSlipPdfDocument.tsx` deleted (0 importers). *(P3)*
- [x] 🟡 L (F-10) — `UNPAID` unreachable after F-2; Unpaid page now lists payable-not-yet-paid rows. **Schema cleanup: drop `UNPAID` from `PAYROLL_UNPAID_SALARY_STATUSES` (out-of-lane, flagged).** *(P1)*
- [x] 🟡 — `loans/bulk` notes→`manager` field misuse fixed (notes dropped; no notes column). *(P2)*
- [x] 🟠 L — `currentContext` exposes canonical `lifecycleStatus`+`isDeployed` (additive); 5 payroll consumers migrated. *(P4 — the Guards-deferred item)*
- [ ] 🔴 C — payrolled-without-deployment write-time guard (deferred from Deployments). **DEFERRED — needs block-vs-warn decision + workflow toggle** (pay can legitimately come from special-duty/allowances with no deployment).

**Verify:** `tsc` clean (src; 12 errors are stale `.next` artifacts from deleted routes, clear on rebuild). `lint:guard` 0 net-new. **Not committed.**

## Module 7 — DEPLOYMENTS  ✅ DONE (3 cross-module items deferred) — 2026-05-26, uncommitted

- [x] 🔴 C — `api/deployment-rates` (all verbs) gated `hasAction(GUARDS,*)` + region-scoped; envelope on POST/PATCH. *(D1)*
- [ ] 🔴 C — `InvoicePrerequisitesManager` off `DeploymentRate`. **DEFERRED → Clients module** (its useless+harmful writes now 403 by the gate above, so no live regression).
- [ ] 🔴 C — payrolled-without-deployment write-time guard. **DEFERRED → Payroll module** (touches `calculate`/`persist`; needs a toggle + careful handling of legit no-deployment pay).
- [x] 🟠 C — DELETE + POST `/end` unified: both transactional, both write `GuardStatusHistory`, one "already ended" rule; `syncLegacyStatus` documented as the projection (NOT routed through `applyTransition`). *(D2)*
- [x] 🟠 C — B5 insight flags only true conflicts (>2 active, BOTH+another, or repeated shift); DAY+NIGHT double-duty no longer false-positives. *(D3)*
- [~] 🟠 D — `deployments.lockAfterEnd`: misleading end-form copy removed *(D3)*; **KEY removal in `policy.ts` deferred → Settings module.**
- [x] 🟡 C — `guard-deployment-inventory-rule` GET made read-only (`findUnique`; PUT seeds). *(D3)*
- [x] 🟡 D — `exService` control removed from rate form; `PAUSED`/`ENDED` filters removed + `PENDING` added (form + GET allow-list). *(D1,D2)*
- [x] 🟡 D — dead `DELETE /api/deployment-rates/[id]` removed. *(D1)*
- [x] 🟡 L — deployment-specific status badge (a11y label); `mockData/deployments.ts` parity. *(D2)*
- [ ] 🟡 C — `a1-below-contract-rate` "billed" source. **DEFERRED (low-pri; needs invoicing-side join).**

**Verify:** `tsc` clean (src). Rate-form POST seam checked (form only reads `response.ok`, not the body → `ok()` envelope safe). `lint:guard` 0 net-new (same 4 pre-existing). **Not committed.**

## Module 8 — DEDUCTIONS  ✅ DONE (carry-forward deferred) — 2026-05-26, uncommitted

- [x] 🔴 C — `other-deductions` POST: OTHER entries now `isOverride=true` + override metadata → survives recompute. *(Dx1)*
- [~] 🔴 C — installments/recoveries/night-call: terminal-status stamping on payroll PAID (new `src/lib/deductions/mark-consumed.ts` hooked atomically in `state/mark-paid` tx; uses real enum `DEDUCTED`, not `PAID`; idempotent). **Carry-forward for missed months DEFERRED** (TODO in file) — needs product call on auto-carry vs notification vs reschedule. *(Dx1)*
- [x] 🔴 D — `other-deductions/[id]` deleted (0 callers; phantom `MISC` gone). *(Dx1)*
- [x] 🟠 C — idempotency prechecks on all 3 issuance routes (natural keys: uniform=planId, training=courseName, advance-salary=principal). `// TODO(hardening)` references the eventual `@@unique` constraint. *(Dx2)*
- [x] 🟠 C — `night-call/logs` resolves rule per-payroll-month with `MISSING_RATE` warning when no active rule; hardcoded fallback killed. *(Dx2)*
- [x] 🟠 — `recompute.ts` documented + short-circuits for `UniformPlan`/`UniformResignationTier` snapshot tables. *(Dx3)*
- [x] 🟠 L — `scripts/seed-payroll-deduction-types.ts` deleted (0 prod callers). *(Dx3)*
- [x] 🟡 — `CLIENT_BRANCH_RATE`→`BRANCH_RATE` rename (8 sites in resolvers); 3 out-of-lane consumers (types.ts, schema doc, migration seed) flagged with TODO. EOBI/ESSI enrollment `[guardId]` routes now use `requireGuardInScope`. *(Dx3)*
- [x] 🟡 — `payroll/other-deductions` `ok()` envelope adopted (the Settings-deferred item) + `PayrollOtherDeductionsManager` consumer updated. *(Dx1)*

**Verify:** `tsc` fully clean (src). `lint:guard` 0 net-new. **Not committed.**

**Behavioral note:** the OTHER-as-override fix means a manual Other deduction now persists across every recompute (rate approval, extra-hours/loan edit, etc.). Previously these silently zeroed — admins who had been "manually setting OTHER each month after recompute wiped it" will find their next manual entry sticks.

---

## Progress log
_(update as we go)_
- 2026-05-26 — checklist created from 8 audit reports.
- 2026-05-26 — **Module 2 (Guards) implemented** via 4 parallel Opus agents (file-partitioned) + integration. New files: `src/lib/guards/access.ts` (requireGuardInScope), `validate-payload.ts`, `cnic.ts`. 13/14 items done; `currentContext` lifecycleStatus deferred to Payroll. tsc clean (src), 0 net-new lint. **Uncommitted — awaiting user review.**
- ⚠️ Working tree also carries an UNRELATED in-flight Clients refactor (21 files + new `src/lib/clients/`) made outside this session — commit/stash before Module 3 (Clients).
- 2026-05-26 — **Module 4 (Inventory) implemented** via 4 parallel Opus agents. New files: `src/lib/inventory/stock-movement.ts`, `demand-status-machine.ts`. Deleted: `demand-status.ts`, 2 dead managers, empty skeleton dirs. 12/14 done; deferred: notes→columns promotion + Prisma `Inventory*` drop (both need migration/prod-data), env-var cleanup + Vercel flag check (user). tsc clean, 0 net-new lint. **Uncommitted.**
- 2026-05-26 — **Module 3 (Clients) SKIPPED** per user — collides with the in-flight Clients refactor (commit/stash + re-audit later). Clean-file 🔴s still pending: contract/rate IDOR, CSV-import region/city, PricingConfig deploy-dropdown, InvoicePrereq rate-flow repoint.
- 2026-05-26 — **Module 7 (Deployments) implemented** via 3 parallel Opus agents. Gated `deployment-rates`, unified end paths, fixed B5/inventory-rule-GET/dead-filters/badge/mock. Deferred: InvoicePrereq repoint (Clients), payrolled-without-deployment guard (Payroll), lockAfterEnd key (Settings), a1 (low-pri). tsc clean, 0 net-new lint. **Uncommitted.**
- 2026-05-26 — **Module 6 (Payroll) implemented** via 4 parallel Opus agents. F-1 isSuperAdmin (= F0.2, fixes tickets too), F-2 payment-bypass closed, F-4 loan recompute, F-5/6/7/8/9 dead code removed, F-10 UNPAID, P4 currentContext lifecycleStatus (Guards-deferred). Deferred: F-3 salary-slips redesign, payrolled-without-deployment guard (needs block-vs-warn decision), Prisma `PayrollDefault` drop, `UNPAID` enum cleanup. tsc clean (src), 0 net-new lint. **Uncommitted.**
- 2026-05-26 — **Module 5 (Settings) implemented** via 3 parallel Opus agents + integration. Gated `workflow-rules` + `guard-pledgeable-documents` with `ok()` envelope (consumers updated to unwrap); wired all 4 `inventoryDemand.*` toggles; removed `lockAfterEnd` key; removed `/settings/system` placeholder + 4 broken refs; added 6 missing descriptions + 3 labels; hardened `RULE_DESCRIPTIONS`. Deferred: workflow-rules + fingerprint DB persistence (migration), `InvoicePrereq` repoint (Clients), `payroll/other-deductions` envelope (Deductions). tsc clean (src), 0 net-new lint. **Uncommitted.**
- 2026-05-26 — **Module 8 (Deductions) implemented** via 3 parallel Opus agents. OTHER durability (isOverride=true); dead `[id]` MISC route deleted; terminal-status stamping (`mark-consumed.ts` → DEDUCTED in mark-paid tx); idempotency prechecks on 3 issuance routes; night-call per-month rule + warning; recompute documented + snapshot-table short-circuit; stale seed deleted; `CLIENT_BRANCH_RATE`→`BRANCH_RATE`; EOBI/ESSI enrollment scope. Deferred: carry-forward for missed installments (product decision). tsc clean (src), 0 net-new lint. **Uncommitted.**
- 2026-05-26 — **Module 1 (Users/Auth) implemented** via 4 parallel Opus agents + 5 consumer-envelope patches. Live escalations CLOSED (GLOBAL-role server gate, self-roleId block, role/perm-matrix gates, canonical isSuperAdmin everywhere). Permission resolver unified via NEW `src/lib/permissions/resolve.ts` (UNION → kills silent revocation; ⚠️ users with overrides regain previously-stripped role perms on next token refresh). Supervisor SoT (`assignGuardSupervisor`) + canonical `"ENDED"`; UserTypesManager decommissioned; cs/ms/search page-gated; dead userLinks + `/users/permissions` stub deleted. Deferred: isomorphic permission-gate extraction. tsc clean (src), 0 net-new lint. **Uncommitted.**
- 2026-05-26 — **🏁 ALL 7 ASSIGNED MODULES COMPLETE.** Pipeline: Guards · Inventory · Deployments · Payroll · Settings · Deductions · Users. Clients SKIPPED (collides with the user's in-flight refactor; clean-file 🔴s still pending). Working tree carries ~7 modules of stacked uncommitted changes + the user's separate Clients refactor — no checkpoint commits made (per user direction). Full session summary in the post-session report.
- 2026-05-26 — **Clients clean-file items DONE** via 3 parallel Opus agents. C1 closed contract/rate IDOR + contract-POST branch ownership. C2 rewrote CSV import (region required, city derived). C3 deleted PricingConfig pipeline + InvoicePrereq screen per product clarification ("deployment first, contract later" → dropdown sourced from new canonical `src/lib/constants/guardTypes.ts`; InvoicePrereq removed entirely — broken-by-design). Prisma `PricingConfig` model drop deferred with TODO. Remaining 4 Clients items overlap with the user's in-flight refactor (status writers, branch supervisor SoT, createBranch extract, dead nested POST) — reconcile after commit. tsc clean (src), 0 net-new lint.
