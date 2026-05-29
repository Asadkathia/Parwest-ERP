# Guards Module — Dead / Legacy / Conflicting-Logic Audit

Read-only forensic audit of the **GUARDS** module and all submodules. No source files were modified.

- Date: 2026-05-26
- Method: graphify-out/ graph (built 2026-04-28) as routing index, then targeted Read/grep verification.
- Scope: `src/app/(dashboard)/guards/**`, `src/app/api/guards/**`, `src/lib/guards/**`, `src/lib/schemas/guard-*`, `src/lib/validation/guard-dates.ts`, `src/lib/imports/definitions/guards.ts`, `src/lib/mockData/guards.ts`, `src/components/guards/**`.

Severity legend: 🔴 breaks prod logic · 🟠 drift risk · 🟡 cleanup-only.

---

## Summary counts

| Bucket | 🔴 | 🟠 | 🟡 | Total |
|---|---|---|---|---|
| DEAD | 0 | 1 | 6 | 7 |
| LEGACY / DUPLICATE | 0 | 2 | 1 | 3 |
| CONFLICTING / BREAKING | 2 | 7 | 1 | 10 |
| **Total** | **2** | **10** | **8** | **20** |

---

## Submodule: Guard create / edit / import (validation SoT)

### src/lib/schemas/guard-create.ts:161 — [DEAD] 🟠
What: The entire guard-create zod schema (`guardCreateSchema`, `personalSchema`, `serviceSchema`, `addressSchema`, `bankSchema`, `documentsSchema`, `STEP_FIELDS`, `GuardCreateForm`, `GuardCreateInput`) is unused.
Evidence: Exact-match grep for `guardCreateSchema` / `STEP_FIELDS` / `schemas/guard-create` across `src` returns ZERO importers outside the file itself. The actual create wizard `src/app/(dashboard)/guards/new/form.tsx` does NOT import it — it re-implements validation inline (`isValidGuardAge`, manual `CNIC_REGEX`/`PHONE_REGEX` tests, a local `calculateAge`). Contrast: the edit form *does* use its schema (`guardEditSchema` via `zodResolver`).
Impact: The file masquerades as the create-path validation source of truth (its own header says "Mirrors the existing validation rules… do NOT tighten or loosen"), but nothing enforces it. Any future contributor editing this schema believes they changed create validation; they did not. Real create rules live in `new/form.tsx` + `POST /api/guards`, and can silently drift from this orphan.
Recommended fix: Root-cause is that the create wizard never adopted the schema. Either (a) wire `new/form.tsx` onto `guardCreateSchema` via `zodResolver` (preferred — makes client validation declarative and converges with the edit form's pattern), or (b) delete the file outright. Do NOT leave it as a decorative "spec." If wiring it up, reconcile its rules with `POST /api/guards` first (see CONFLICT below — create currently has NO server-side phone-format or required-field checks that this schema declares).

### new/form.tsx vs guard-edit.ts vs imports/definitions/guards.ts — [CONFLICT] 🔴
What: The three guard-creation/mutation paths disagree on which field rules are enforced where.
Evidence:
- **Phone format**: Bulk import (`rowSchema`, `requiredPhoneField`) enforces `PHONE_REGEX` on `phone`, `permanentAddressContact`, `currentAddressContact`. `new/form.tsx` enforces phone format only on relative/introducer contacts (lines 446-464) and the create API `POST /api/guards` enforces **no** `PHONE_REGEX` server-side at all (it only validates CNIC + dates). `guardEditSchema` makes `phone` a free `z.string().optional()` with no format check. So a malformed primary phone is rejected by import, weakly checked on create-client, and freely accepted by both the create API and the edit path.
- **Required fields**: `new/form.tsx`/`guardCreateSchema` treat `fatherName`, `motherName`, `maritalStatus`, `bloodGroup`, `policeStation`, `nextOfKin`, addresses as required. `POST /api/guards` requires only `cnic` (+ optional date validation). `PUT /api/guards/[id]` requires none of them. So an API client (or the edit form) can blank out fields the create wizard insists on.
- **Education year > DOB**: enforced in import (`validateEducationPassingYear` in `rowSchema.superRefine`) and in `new/form.tsx` (imports `validateEducationPassingYear`). NOT enforced in `POST /api/guards` or `PUT /api/guards/[id]` server-side.
SoT it violates: There is no single server-side guard-field validator. `validateGuardDates` is correctly shared (3 paths), but everything else (phone, required fields, education-year) is enforced ad hoc per path.
Impact: Data written via the create API directly, or via the edit path, can violate invariants the create wizard and bulk import guarantee. Recent commits tightened CNIC+phone+education-year specifically to close drift — but only on the wizard and import; the two API write paths were not brought along.
Recommended fix: Extract a single `validateGuardPayload(input)` (pure, like `validateGuardDates`) covering phone format, required fields, and education-year, and call it from `POST /api/guards` AND `PUT /api/guards/[id]` AND have the zod schemas delegate to the same primitives. This is the structural guarantee the codebase already applied to dates but never finished for the rest.

### POST /api/guards vs PUT /api/guards/[id] — exServiceType derivation — [CONFLICT] 🟠
What: The two routes derive `exServiceType`/`isExService` with subtly different fallback logic when no explicit `exServiceType` is sent.
Evidence: `POST` (route.ts:265-271): `isExService = prevEmployments.length>0 ? some(isExService) : KNOWN_LIST.includes(exServiceType)`. `PUT` ([id]/route.ts:108-115): `nextExServiceType = primary?.type ?? (derivedIsExService ? null : "CIVILIAN")` — PUT can persist `exServiceType = null` whereas POST always lands on a concrete string (`"CIVILIAN"` default). Both share `validateGuardEmploymentType` only on the *explicit* branch.
Impact: A guard created vs edited with the same payload can end up with `exServiceType=null` (edit) vs `"CIVILIAN"` (create), which downstream consumers (payroll rate lookup, deployment-rate `exService` filter) read inconsistently.
Recommended fix: Move the entire ex-service derivation (both explicit and fallback branches) into `validateGuardEmploymentType` / a shared `resolveExServiceType()` helper and call it from both routes so null-vs-CIVILIAN can't diverge.

### POST /api/guards vs check-cnic re-enrollment model — [CONFLICT] 🟠
What: `PUT /api/guards/[id]` CNIC-change uniqueness check does not honor the "terminated profiles don't block" re-enrollment model that `POST` and `check-cnic` implement.
Evidence: `POST` (route.ts:193-200) and `check-cnic` (route.ts:42-44) inspect the most-recent profile and only block if it's **non-terminated**. `PUT` ([id]/route.ts:64-74) blocks if **any** other guard row has the CNIC (`findFirst({ cnic, id:{not:id} })`) regardless of lifecycle.
Impact: Changing a guard's CNIC to one that belongs to an old TERMINATED profile is wrongly rejected on edit, even though create would allow a brand-new profile for that same CNIC. Inconsistent re-enrollment semantics.
Recommended fix: Share one `cnicAvailability(cnic, { excludeGuardId })` helper used by `POST`, `PUT`, and `check-cnic` so the partial-unique / terminated-profile rule lives in one place.

---

## Submodule: Guard status / lifecycle

### src/app/api/guards/[id]/prerequisites/[prereqId]/route.ts:134 — [CONFLICT] 🟠
What: Auto-flip `ACTIVE → PENDING` (when a verification prereq is un-verified) transitions a guard who may still hold an active deployment, with no deployment guard and no workflow-rule gate.
Evidence: PATCH lines 101-145 call `transitionGuard({ to: "PENDING" / "ACTIVE", trigger: "SYSTEM" })`. `applyTransition` revokes deployments only for `INACTIVE`/`TERMINATED` (lifecycle.ts:156-157), so an `ACTIVE→PENDING` flip leaves any active `Deployment.status="ACTIVE"` intact. The manual status route (`[id]/status/route.ts:79-87`) explicitly blocks status changes while actively deployed; this SYSTEM path does not. It is also not gated by any `isWorkflowRuleEnabled(...)`.
Impact: A deployed guard can silently drop to lifecycle PENDING (still showing legacy shadow because deriveLegacyStatus only maps ACTIVE→PRESENT/DEFAULT — a PENDING guard with a live deployment is an inconsistent state). Eligibility checks then fail "Guard Status" while the guard is physically on post.
Recommended fix: Before any SYSTEM `ACTIVE→PENDING` auto-flip, check for active deployments (reuse the same guard as the manual route) and either skip the flip or revoke+log. Gate the whole auto-flip behind a `guards.autoLifecycleOnVerification` workflow rule for parity with how other validations are toggled.

### src/app/api/guards/[id]/route.ts:155 — [CONFLICT] 🟠
What: PUT lifecycle transition (`ACTIVE→PENDING`/`INACTIVE`) does not enforce the active-deployment block that the dedicated `/status` PATCH enforces.
Evidence: `[id]/status/route.ts:79-87` returns 409 if `Deployment.status="ACTIVE"` exists before any transition. `[id]/route.ts` PUT (lines 140-160, 251-260) only checks `canTransition` and relies on `applyTransition` to revoke — which does not revoke for the `PENDING` target.
Impact: The edit form can move an actively-deployed guard to PENDING, bypassing the guard the status modal enforces. Two writers to lifecycle with different preconditions.
Recommended fix: Centralize the "no transition while actively deployed (except those that revoke)" precondition inside `applyTransition` / `canTransition`'s caller contract, so every transition path inherits it rather than each route re-deciding.

### GuardStatusSupervisorEditor.tsx:123 — [CONFLICT] 🟡
What: Uses `window.confirm()` for the destructive terminate/abscond confirmation.
Evidence: Lines 123 (`window.confirm(confirmMsg)`). CLAUDE.md design-system rule: "Destructive confirms use shadcn AlertDialog… Browser confirm() is banned." `StoreInventoryTab.tsx` has the same issue.
Impact: A11y / design-system drift; not a logic bug.
Recommended fix: Replace with shadcn `AlertDialog` + destructive `Button` variant.

### lifecycle.ts:27 / status-history.ts — two status-history writers — [LEGACY/DUPLICATE] 🟡
What: Two functions write `GuardStatusHistory`: `applyTransition` (lifecycle.ts:181, atomic, in-transaction) and `recordGuardStatusChange` (status-history.ts:25, fire-and-forget, separate connection).
Evidence: `recordGuardStatusChange` is called by the enrollment paths (`POST /api/guards`, bulk import) for the *initial* PENDING row; `applyTransition` writes history for every subsequent transition. They are not duplicated for the same event, but they are two code paths writing the same table with different transactional guarantees.
Impact: Low — initial enrollment history is best-effort (can be lost silently on failure) while transition history is atomic. Inconsistent durability for the same audit table.
Recommended fix: Have enrollment seed the initial PENDING history row inside the create transaction (like `applyTransition` does) and retire the fire-and-forget path for status, keeping `recordGuardStatusChange` only if a genuinely best-effort use remains.

---

## Submodule: API routes — regional scope / permission drift

### src/app/api/guards/[id]/system-doc/[docType]/route.ts:1635 — [CONFLICT] 🔴
What: The PBA/Form-A/Form-B/Employee-Card/Character-Certificate document generators expose full guard PII with only a coarse module check and NO regional-scope check.
Evidence: GET handler (line 1635) uses `hasModuleAccess(session, "GUARDS")` (module-level, not action-level `hasAction`) and never calls `managerScopeDenied` against the guard's region/office. It then `findUnique`s the entire guard record (line 1641) and renders CNIC, addresses, relatives, family, salary into printable HTML. Sibling guard routes (`[id]/route.ts`, `[id]/prerequisites/route.ts`, `[id]/status/route.ts`) all enforce `managerScopeDenied`.
Impact: A regional admin restricted to Region A can fetch the full printable dossier (CNIC, salary, addresses, relatives) of any guard in Region B by ID. Cross-region PII leak.
Recommended fix: Add `deriveManagerScope` + `managerScopeDenied({ regionId, regionalOfficeId })` after the guard fetch, matching the other `[id]` routes; switch `hasModuleAccess` to `hasAction(session,"GUARDS","VIEW")` for consistency.

### src/app/api/guards/[id]/supervisor/route.ts:68 — [CONFLICT] 🟠
What: PATCH (assign/change supervisor) has no regional-scope check and does not validate the chosen supervisor is within the actor's scope.
Evidence: No `managerScopeDenied` on the guard, and `supervisorId` is accepted as any `prisma.user.findUnique` (lines 84-88) — no `role=Supervisor`, no `status=ACTIVE`, no region filter. Contrast: `POST /api/guards` and the bulk import both re-verify the supervisor is an ACTIVE Supervisor within scope (`scopedSupervisorWhere`, import guards.ts:860-878). The PUT route's supervisor swap also lacks the scope re-check.
Impact: A regional admin can assign a guard outside their region a supervisor outside their scope (or a non-supervisor user). Trust-boundary gap vs siblings.
Recommended fix: Add guard-scope guard + reuse a shared `assertSupervisorInScope(supervisorId, scope)` (extract from the import's `scopedSupervisorWhere`) in PUT and PATCH supervisor paths.

### src/app/api/guards/[id]/{photo,courses,insurance,pledged-docs,attendance/auto-generate}/route.ts — [CONFLICT] 🟠
What: All mutation handlers on these guard sub-resources check `hasAction` but none check `managerScopeDenied` against the guard's region.
Evidence: scope-map (verified per file): `photo` POST, `courses` POST/DELETE, `insurance` POST/PATCH/DELETE, `pledged-docs` POST/PATCH/DELETE, `attendance/auto-generate` POST — all NO-SCOPE. Sibling mutation routes `[id]/route.ts` PUT, `[id]/status` PATCH, `[id]/trainings` POST, `[id]/prerequisites` (list) all DO scope-check.
Impact: A regional admin can mutate photos, courses, insurance, pledged-docs, and auto-generate attendance for guards outside their region. Consistent regional enforcement is broken across half the sub-resources.
Recommended fix: This is exactly the case for a shared guard guard: add a `requireGuardInScope(session, guardId)` helper (fetch guard region/office + `managerScopeDenied`) and call it at the top of every guard `[id]/*` mutation handler, instead of re-deciding per file. Same pattern as the inventory module's `requireInventorySession()`.

### src/app/api/guards/[id]/prerequisites/[prereqId]/route.ts:41 — [CONFLICT] 🟠
What: PATCH/DELETE on a single prerequisite lack the regional-scope check that the prerequisites *list* route enforces.
Evidence: `[id]/prerequisites/route.ts` GET (lines 18-28) calls `managerScopeDenied`. The `[prereqId]` PATCH (line 41) and DELETE (line 159) scope only by `{ id: prereqId, guardId }` — no region check. A prereq PATCH can also trigger a lifecycle transition (line 126/135).
Impact: Out-of-scope admin can verify/reject/delete prerequisites (and thereby auto-flip lifecycle) for guards outside their region.
Recommended fix: Same shared `requireGuardInScope` guard as above.

### src/app/api/guards/[id]/current-context/route.ts:143 (lib currentContext.ts) — [LEGACY/DUPLICATE] 🟠
What: Cross-module contract — `getCurrentGuardContext` returns the **legacy `status` shadow** (`status: guard.status`) which payroll consumers read, while the rest of the app is migrating reads to `lifecycleStatus`.
Evidence: `currentContext.ts:143` returns `status: guard.status`; consumed by `PayrollLoansClient`, `PayrollExtraHoursManager`, `PayrollSpecialDutyManager`, `PayrollClearanceManager`, `GuardContextFields`, `GuardInfoCard`. No `lifecycleStatus` is exposed in the context output.
Impact: Payroll surfaces show PRESENT/DEFAULT/INACTIVE (legacy enum) and cannot distinguish a deployed-ACTIVE from a non-deployed-ACTIVE guard via the canonical field; if/when the legacy shadow is retired this breaks. Drift between Guards' canonical model and what payroll reads.
Recommended fix: Add `lifecycleStatus` (+ `isDeployed`) to the context payload and migrate payroll consumers to read those; keep `status` only as a transitional display value.

### src/app/(dashboard)/guards/prerequisites/manager.tsx:213 — [CONFLICT] 🟠
What: Client reads `data.error` from API responses, but the API error envelope is `{ success, message, code }` — there is no `error` key.
Evidence: 8 occurrences read `d.error` (lines 213, 235, 406, 430, 462, 484, 531, 559). CLAUDE.md: "clients read `data.message`, NOT `data.error`." Line 383 already does it correctly (`payload?.message || payload?.error`).
Impact: Real server error messages (validation, conflicts) never reach the user — they always see the generic `"Failed"` fallback. Degrades every error path on this settings page.
Recommended fix: Replace `d.error` with `d.message` (keep `|| "Failed"` fallback). Audit the file once for the pattern.

---

## Submodule: Components (dead UI)

### src/components/guards/tabs/InventoryTab.tsx:36 — [DEAD / LEGACY] 🟡
What: Legacy guard inventory tab, superseded by `StoreInventoryTab`.
Evidence: 0 importers (grep). `GuardProfileTabs.tsx` imports and renders only `StoreInventoryTab` (line 176). `InventoryTab` takes a static `inventory` prop (no API wiring) — it is the pre-v2 inventory UI.
Impact: None at runtime (unreachable). Dead weight + confuses "which inventory tab is real."
Recommended fix: Delete. (Aligns with the inventory v2 migration note in CLAUDE.md.)

### src/components/guards/GuardsFilterBar.tsx:30 — [DEAD] 🟡
What: Guard list filter bar component, unused.
Evidence: 0 importers. The active guards list (`GuardsListClient.tsx`) implements its own inline filter row; this older standalone bar is orphaned.
Impact: None at runtime.
Recommended fix: Delete (confirm `GuardsListClient` is the sole list UI first — it is, per `guards/page.tsx`).

### src/components/guards/AdvancedFilterPanel.tsx:11 — [DEAD] 🟡
What: Generic advanced-filter wrapper, unused.
Evidence: 0 importers.
Impact: None.
Recommended fix: Delete.

### src/components/guards/ProfileIncompleteBanner.tsx:30 — [DEAD] 🟡
What: "Profile incomplete" banner, unused.
Evidence: 0 importers. The active profile-completeness UI is `GuardProfileHealth` (rendered by `[id]/page.tsx`).
Impact: None.
Recommended fix: Delete.

### src/app/(dashboard)/guards/deployments-rate/form.tsx:12 — [CONFLICT] 🔴
What: Hardcoded `LEGACY_REGIONS` and `LEGACY_CLIENTS` fallback arrays with fake IDs are submitted to the rate API when the real API returns empty/errors.
Evidence: Lines 12-29 define fake-ID arrays (`legacy-region-punjab`, `legacy-client-nbp`, …). Lines 77/79/83/85/88-89 fall back to them on empty/failed `/api/regions` and `/api/clients`. On save (lines 175-191) the selected fake `regionId`/`clientId` is POSTed to `/api/deployment-rates`.
SoT it violates: CLAUDE.md — "No hardcoded data fallbacks in forms: if an API returns empty, show empty. Never fall back to a `LEGACY_*` constant array with fake IDs — this caused production eligibility bugs."
Impact: If the regions/clients API ever returns empty (new tenant, scoped-out admin, transient error), the form shows fake banks/regions and lets the user save a deployment rate keyed to a non-existent `legacy-*` foreign-key id — corrupt rate rows that no real client/region matches, exactly the class of bug the rule was written to prevent.
Recommended fix: Delete both arrays and all fallbacks; render empty state when the API returns nothing (match the `branches`/`recentRates` handling in the same file, which already correctly fall back to `[]`).

---

## Top 5 highest-risk conflicts

1. **🔴 system-doc PII leak** — `src/app/api/guards/[id]/system-doc/[docType]/route.ts:1635`: full printable guard dossier (CNIC, salary, addresses, relatives) has no regional-scope check while every sibling route does. Cross-region PII exposure.
2. **🔴 deployments-rate LEGACY fake-ID fallback** — `src/app/(dashboard)/guards/deployments-rate/form.tsx:12`: banned hardcoded `LEGACY_REGIONS`/`LEGACY_CLIENTS` submitted to the rate API, can write rate rows with non-existent FKs (the exact bug class CLAUDE.md forbids).
3. **🔴/🟠 create vs edit vs import validation divergence** — phone format, required fields, and education-year are enforced on the wizard + bulk import but NOT in `POST /api/guards` or `PUT /api/guards/[id]`. Direct-API / edit writes can violate guard invariants. Root cause: only `validateGuardDates` was shared; the rest was never centralized.
4. **🟠 lifecycle transition precondition split** — `[id]/route.ts` PUT and `[id]/prerequisites/[prereqId]` PATCH can move an actively-deployed guard to PENDING with no deployment guard, contradicting the `/status` PATCH which blocks it. Inconsistent lifecycle preconditions across writers.
5. **🟠 regional-scope drift across guard sub-resources** — `supervisor` (PATCH/PUT), `photo`, `courses`, `insurance`, `pledged-docs`, `attendance/auto-generate`, `prerequisites/[prereqId]` (PATCH/DELETE) all skip `managerScopeDenied` that their siblings enforce. Out-of-region mutation. Needs a shared `requireGuardInScope` guard.

---

## Confirmed-dead removal list (safe to delete, with proof)

| File / symbol | Proof of zero use |
|---|---|
| `src/components/guards/tabs/InventoryTab.tsx` | 0 importers; `GuardProfileTabs` renders only `StoreInventoryTab` (line 176). Legacy pre-v2 inventory UI. |
| `src/components/guards/GuardsFilterBar.tsx` | 0 importers; active list is `GuardsListClient` with inline filters. |
| `src/components/guards/AdvancedFilterPanel.tsx` | 0 importers. |
| `src/components/guards/ProfileIncompleteBanner.tsx` | 0 importers; superseded by `GuardProfileHealth`. |
| `src/lib/schemas/guard-create.ts` (whole file) | `guardCreateSchema`/`STEP_FIELDS`/`GuardCreateForm`/`GuardCreateInput` have 0 importers; create wizard validates inline. **Delete only if you do not adopt option (a) of the DEAD finding above (wire the wizard onto it).** Recommended: adopt it instead of deleting, then converge server rules. |

Note: confirmed against dynamic-import / string-reference / barrel-export checks (no `dynamic(import(...))`, no string route refs, no barrel re-exports of these symbols).

---

## Items checked and found CLEAN (no finding) — for reviewer confidence

- **Parwest ID generation**: `src/lib/guards/parwest-id.ts` uses a single ordered `$queryRaw … ORDER BY DESC LIMIT 1` (no `findMany` scan). Both `POST /api/guards` and bulk import call it. ✅
- **Guard list select excludes `photoUrl`**: `GET /api/guards` select (route.ts:80-95) does not include `photoUrl`. ✅ (Note: `search` and `search`-style routes do select `photoUrl`, but those are the detail/search endpoints, not the main list — acceptable.)
- **CNIC lookups use `findFirst`**: all guard-by-CNIC lookups (`POST`, `check-cnic`, blacklist snapshots, import duplicate check) use `findFirst`. The `blacklistedCnic.findUnique({ where: { cnic } })` calls are valid because `BlacklistedCnic.cnic` is `@unique` (schema.prisma:443). ✅
- **`validateGuardDates` / `validateEducationPassingYear`** are genuinely shared across `POST /api/guards`, bulk import, and `new/form.tsx`. ✅
- **`build-payload.ts`** is the single shared create-payload builder used by both single-create and bulk import. ✅
- **`applyTransition`** is the canonical lifecycle writer; PUT never writes `Guard.status` directly. ✅
- **Mock data** (`mockData/guards.ts`) carries both `status` + `lifecycleStatus` + `terminationReason`, consistent with schema shape. ✅
