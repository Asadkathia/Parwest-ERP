# Clients Domain — Dead / Legacy / Conflicting-Logic Audit

Read-only forensic audit. Scope: clients, branches, pricing, invoicing, contracts, advance-payments, blacklist, types-locations, insurance settings, status, imports.
Graph (`graphify-out/`, built 2026-04-28) was used for routing, but its importer counts are unreliable for this domain: API routes are reached via string-literal `fetch()` (not ES imports), and the AST graph collapses all route handlers into god-nodes `GET()/POST()/PATCH()/DELETE()` with INFERRED cross-edges (e.g. it reported `schemas/branch` and `schemas/client` as 0-importer, which grep disproves). All "dead" / "wired" verdicts below are therefore proven by repo-wide `grep` of actual call sites, not by the graph.

Date: 2026-05-26. Severity key: 🔴 breaks prod logic · 🟠 drift risk · 🟡 cleanup-only.

---

## Branch-routing map (every read/write path)

There are three route *shapes* but they are NOT three interchangeable implementations — two writers genuinely conflict, one read path is canonical, one write path is dead.

| Route | Method | Purpose | Caller(s) | Verdict |
|---|---|---|---|---|
| `POST /api/branches` (`src/app/api/branches/route.ts`) | POST | **Canonical branch create.** Writes ~50 columns (capacity, GPS, managers, contract attachments, locker, enrollment, extended contact) + supervisor assignment. Derives `city` from region. Scope-checks via `managerScopeDenied`. | `clients/[id]/branches/new/form.tsx:285` | **CANONICAL** |
| `GET /api/branches` (`route.ts`) | GET | List branches w/ client join, search, region/scope filter. | `payroll/loans`, `payroll/PayrollExtraHoursManager`, `InvoicePrerequisitesManager`, `users/CsRelationshipManager` | CANONICAL (cross-module list) |
| `PATCH /api/branches/[id]` (`src/app/api/branches/[id]/route.ts`) | PATCH | **Canonical branch update.** Zod-validated, capacity-decrease guard, deactivation guard, atomic supervisor delta (validates user, dedups ACTIVE). | `clients/branches/[id]/edit/form.tsx:259` | **CANONICAL** |
| `DELETE /api/branches/[id]` (`route.ts`) | DELETE | Branch delete (blocks if active deployments). | `components/clients/BranchDeleteButton.tsx:50` | CANONICAL |
| `GET /api/clients/[id]/branches` (`src/app/api/clients/[id]/branches/route.ts`) | GET | **Canonical per-client branch read.** Returns active supervisor + active-deployment count. | invoicing/manager, guards/deploy, guards/trainings, client-attendance, deployments-rate, store-inventory AssignmentsManager, PayrollSpecialDutyManager, OnJobTrainingsTab | **CANONICAL** (per-client reads) |
| `POST /api/clients/[id]/branches` (`route.ts`) | POST | Nested branch create. **Validates only `name`; persists ~10 columns**, drops everything the canonical create writes. Inline supervisor create swallows errors, no user validation, no prior-ACTIVE dedup. | **NONE** (no `fetch`/`apiPost` call site in repo) | **DEAD + latent CONFLICT** |
| `GET /api/branches/[id]/capacity` (`[id]/capacity/route.ts`) | GET | Capacity-vs-usage read for deploy form. | `guards/deploy/form.tsx` | CANONICAL |

**Dashboard pages are complementary, not duplicate:** `clients/[id]/branches/new/` = create form; `clients/branches/[id]/` = detail; `clients/branches/[id]/edit/` = edit; `clients/branches/` = list (server component reads `prisma.branch.findMany` directly). No page-level duplication.

**Branch-routing verdict:** `POST /api/clients/[id]/branches` is the one true problem — dead today, and a data-loss landmine if ever called (it silently drops capacity/managers/GPS/attachments and writes supervisors unsafely). The GET on the same path is canonical and must be kept. Top-level `/api/branches[/...]` is canonical for create/update/delete.

---

## Findings by submodule

### src/app/api/clients/[id]/branches/route.ts:69 — [DEAD] 🟠 (latent 🔴 if revived)
**What:** `POST` nested branch-create handler with zero call sites.
**Evidence:** Repo-wide grep for any `fetch`/`apiPost`/`apiSend` to `/api/clients/${...}/branches` with a POST body returns nothing; the only branch-create form posts to `/api/branches` (`clients/[id]/branches/new/form.tsx:285`). The nested GET *is* used everywhere; only the POST is orphaned.
**Impact:** Dead code today. If a future caller targets it (natural assumption given the RESTful nesting), branches silently lose ~40 columns the canonical `POST /api/branches` writes (all capacity buckets, GPS, branchManager*, operationsManager*, supervisorContact, contactPersonCnic/Phone, contractAttachments, enrollmentDate, isLockerBranch). Its supervisor write (`clientSupervisorAssignment.create(...).catch(() => {})`) skips user validation and prior-ACTIVE dedup — diverging from the canonical `assignSupervisor()` SoT.
**Recommended fix (root-cause):** Delete the `POST` export; keep `GET`. If RESTful nesting is desired long-term, instead make the nested POST delegate to the same handler/body shape as `/api/branches` and route the form through it — but do not maintain two divergent writers. Co-change: none (no callers).

### src/app/api/branches/route.ts (POST) vs src/app/api/clients/route.ts (nested branch create) — [LEGACY/DUPLICATE] 🟠
**What:** Branch fields are created in **three** places with hand-rolled, drifting coercion: (a) `POST /api/branches` (full), (b) the auto-created default/first branch inside `POST /api/clients` (`route.ts:216-262`), (c) the dead nested POST. (a) and (b) re-implement `toInt`/`parseFloat`/date coercion and the column list independently.
**Evidence:** `api/clients/route.ts` writes `branchDayGuardCapacity → dayGuardCapacity` etc. via 20+ `body.branchX ? parseInt(...) : null` lines; `api/branches/route.ts` writes the same columns via its own `toInt`/`toFloat`. The two lists are not identical (e.g. clients-route default branch omits `supervisorContact` mapping symmetry; branches-route handles `latitudeManual` fallback, clients-route uses `branchLatitude`).
**Impact:** Adding/renaming a Branch column requires editing 2–3 hand-mapped writers; they will drift. Supervisor assignment is done correctly via `assignSupervisor()` in clients-route but via raw `clientSupervisorAssignment.create` in branches-route (no dedup) — inconsistent SoT usage for the SAME join model.
**Recommended fix:** Extract a single `createBranch(tx, input)` helper (in `src/lib/branches/`) that owns column mapping + `assignSupervisor()` and is called by both `POST /api/branches` and the client-create transaction. Co-change: update `schemas/branch.ts` to be the input contract for that helper.

### src/app/api/branches/route.ts:182 & src/app/api/clients/[id]/branches/route.ts:182 — [CONFLICT] 🟠
**What:** Branch-level supervisor assignment bypasses the `assignSupervisor()` single-source-of-truth helper that `src/lib/clients/supervisorAssignment.ts` exists to enforce.
**Evidence:** `supervisorAssignment.ts` validates the user, deactivates prior ACTIVE rows, then creates — and is used by `api/clients/route.ts` and `api/clients/[id]/route.ts`. But `api/branches/route.ts:182` does `tx.clientSupervisorAssignment.create({...}).catch(() => {})` directly, and `api/clients/[id]/branches/route.ts:182` does the same. The `PATCH /api/branches/[id]` path does it correctly inline (validate + dedup).
**Impact:** A branch created via `POST /api/branches` with an `assignedSupervisorId` (1) silently no-ops on an invalid user id (swallowed catch) and (2) can leave two ACTIVE assignments if one already existed — violating the "at most one ACTIVE per branch" invariant the helper guarantees and the PATCH path relies on.
**Recommended fix:** Replace both raw `clientSupervisorAssignment.create` calls with `assignSupervisor(tx, { clientId, branchId, supervisorId })`. Co-change: remove the swallowing `.catch(() => {})` so bad supervisor ids surface as 400 like the client path.

### src/lib/imports/definitions/clients.ts:78 — [CONFLICT] 🔴
**What:** The clients CSV-import writer sets `Client.city` directly from the uploaded `city` column, contradicting the system-wide "city is always DERIVED from region, never client-supplied" drift guard enforced by every interactive create/edit path.
**Evidence:** Import: `city: r.city ?? null` (line 78). Interactive paths derive: `POST /api/clients` `city = await cityForRegionId(...)` (`route.ts:135`), `PUT /api/clients/[id]` re-derives on regionId change (`[id]/route.ts:110-114`), both branch writers call `cityForBranch(...)` and explicitly comment "never trust a client-sent city, to avoid region/city drift."
**Impact:** Imported clients carry a free-text city with NO `regionId`/`regionalOfficeId` (the import schema has no region columns at all), so they are invisible to every region-scoped list/filter (`buildManagerScopeWhere` filters on `regionId`) and their city can't match the region-name convention used elsewhere. This is exactly the class of region/city divergence the rest of the module was hardened against.
**Recommended fix:** Add a required `region` FK column to the import definition, resolve it like `type`, derive `city` via `cityForRegionId` in `persist()`, and drop the raw `city` column. Co-change: update `requiredHeaders`/sampleRows; document that imported clients are branchless+region-scoped.

### src/lib/imports/definitions/clients.ts:8-14 — [CONFLICT] 🟠
**What:** Import validation diverges from create/edit schemas: requires only `name`+`type`; no `email`, `contactPerson`, `enrollmentDate`, `headOfficeAddress`, no phone/CNIC format checks.
**Evidence:** `rowSchema` = name, type, optional city/email/phone (no format regex). `clientCreateSchema` (`schemas/client.ts:28`) requires email (valid), contactPerson, contactNumber (PHONE_REGEX `+92-XXX-XXXXXXX`), headOfficeAddress, enrollmentDate. The recent commits `f42b352` / `955773e` tightened CNIC/phone formats on guard imports but the clients import was not aligned.
**Impact:** Bulk-imported clients can violate every required-field/format rule enforced in the UI, producing records the edit form will then reject or that fail downstream phone/email assumptions. Three sources of truth (create form, edit form, import) for "what is a valid client."
**Recommended fix:** Make the import rowSchema reuse the shared format validators (`CNIC_REGEX`, `PHONE_REGEX` from `src/lib/validation/formats`) and the same required set as `clientCreateSchema` (or an explicit, documented "import-minimal" subset signed off by product). Don't silently accept laxer data.

### src/app/api/clients/[id]/pricing-configs/route.ts + prisma `PricingConfig` model — [DEAD WRITER → live read] 🔴
**What:** `PricingConfig` is a write-dead Prisma model: nothing in the repo writes it, but `GET /api/clients/[id]/pricing-configs` reads it and the deploy form depends on that read.
**Evidence:** `grep "pricingConfig"` → exactly one hit: the `findMany` read in this route. Zero `pricingConfig.create/update/upsert` anywhere. The canonical pricing SoT is `ClientContract` + `ClientContractRate` (written by `PricingManager.tsx` via `/api/clients/[id]/contracts*`, read by `pricing-summary`, invoicing, and `deployments/[id]`). The branch route even comments "Branch pricing is canonical via ClientContract."
**Impact (prod):** `guards/deploy/form.tsx:397` calls `pricing-configs` to populate the guard-type dropdown for a deployment (`loadClientGuardTypes`). Because the table is never written, this returns `[]` for every client → the deploy form's guard-type selector is permanently empty / defaults to "", regardless of contracts the client actually has. Guard types are not sourced from the canonical `ClientContractRate.guardType`.
**Recommended fix (root-cause):** Repoint `loadClientGuardTypes` at the canonical source — derive distinct `guardType` from the client's active `ClientContractRate` rows (e.g. via the existing contracts endpoint or a small `/api/clients/[id]/guard-types` reading ClientContractRate). Then delete the `pricing-configs` route and drop the `PricingConfig` model in a migration. This mirrors the CLAUDE.md "no hardcoded/empty-source fallbacks fed to forms" rule that previously caused a prod eligibility bug.

### src/app/api/clients/[id]/contracts/[contractId]/route.ts:37 — [CONFLICT] 🔴
**What:** Contract PATCH does not verify the contract belongs to the `clientId` in the path — it loads by `contractId` alone after scope-checking only the path client.
**Evidence:** `checkClientScope(clientId, session)` validates that *clientId* is in the admin's region, then `prisma.clientContract.findUnique({ where: { id: contractId } })` with no `clientId` constraint and no `contract.clientId === clientId` assertion.
**Impact:** A regional admin scoped to in-region client A can update an out-of-region client B's contract by calling `PATCH /api/clients/{A}/contracts/{B's-contractId}` — the scope gate passes on A, the contract resolves to B's. Cross-tenant write / scope bypass (IDOR).
**Recommended fix:** Constrain the lookup: `findFirst({ where: { id: contractId, clientId } })` and 404 on mismatch (or assert `contract.clientId === clientId` → 404). Apply the identical fix to the rates route below.

### src/app/api/clients/[id]/contracts/[contractId]/rates/route.ts:50,152 — [CONFLICT] 🔴
**What:** Same ownership gap as the contract route. The contract is loaded by `contractId` only; rate PATCH scopes the rate to `contractId` (good) but never ties `contract.clientId` to the path `clientId`.
**Evidence:** `checkClientScope(clientId,...)` then `clientContract.findUnique({ where: { id: contractId } })`; rate looked up `where: { id: rateId, contractId }`.
**Impact:** Same cross-tenant write vector — add/mark-current a rate on another client's contract via an in-scope client id in the URL.
**Recommended fix:** Resolve the contract with `where: { id: contractId, clientId }` (404 on miss) before touching rates.

### src/app/api/clients/[id]/contracts/route.ts:76 (POST) — [CONFLICT] 🟠
**What:** Contract POST accepts a `branchId` without verifying the branch belongs to the client — unlike the advance-payments sibling, which does verify.
**Evidence:** Contracts POST: `branchId: body?.branchId ? String(body.branchId) : null` with no `branch.clientId === clientId` check. Advance-payments POST (`advance-payments/route.ts:78-86`) explicitly loads the branch and 400s if `branch.clientId !== clientId`.
**Impact:** A client-level contract can be attached to a branch owned by a different client, corrupting branch-scoped pricing resolution and the branch/client contract counts in `pricing-summary`.
**Recommended fix:** Add the same branch-ownership guard the advance-payments route uses, before `clientContract.create`.

### src/app/api/clients/[id]/advance-payments/route.ts:20,60 — [CONFLICT] 🟡
**What:** Routes nested under `/api/clients/[id]/*` gate on the `PAYROLL` module/permission, whereas every sibling under that prefix (branches, contracts, pricing-configs) gates on `CLIENTS`.
**Evidence:** GET `hasAction(session, "PAYROLL", "VIEW")`, POST `hasAction(session, "PAYROLL", "CREATE")`; audit `module: "PAYROLL"`. Siblings use `CLIENTS`.
**Impact:** A user with full CLIENTS access but no PAYROLL access can open a client but gets 403 on the advances panel (and vice-versa). May be intentional (advances are a finance concern) but it is an undocumented permission split inside one URL namespace — confirm intent.
**Recommended fix:** If intentional, document it (and ensure the UI panel is permission-gated to PAYROLL so it doesn't 403 silently). If not, align to `CLIENTS`.

### Client status — multiple writers (CONFLICT) 🟠
**What:** `Client.status` is mutated by four paths with different allowed values and different preconditions — the Guards lifecycle-split anti-pattern.
**Evidence / matrix:**
| Writer | Allowed values | Branch-active guard (Ticket 33) |
|---|---|---|
| `PUT /api/clients/[id]` (edit form) `[id]/route.ts:116` | any string passed (`body.status \|\| "ACTIVE"`); edit schema enum allows `ACTIVE/INACTIVE/BLACKLISTED` | yes (only when →INACTIVE) |
| `PATCH /api/clients/[id]` (`ClientStatusToggle`) `[id]/route.ts:204` | ACTIVE/INACTIVE only (rejects others) | yes |
| `POST /api/clients/blacklist` `blacklist/route.ts:82` | sets BLACKLISTED | **no** |
| `DELETE /api/clients/blacklist` (un-blacklist) `blacklist/route.ts:124` | sets **ACTIVE** unconditionally | **no** |
**Impact:** (1) Un-blacklisting always forces `ACTIVE`, even for a client that was INACTIVE before blacklisting — it cannot restore the prior state and bypasses the branch-active guard, so a client with active branches can be flipped ACTIVE→ via blacklist round-trip. (2) PUT accepts BLACKLISTED through the edit form while PATCH forbids it — divergent state machine. (3) Four writers means no single place enforces legal transitions.
**Recommended fix:** Introduce one `setClientStatus(tx, clientId, nextStatus, { actor })` transition function (mirror `transitionGuard`) that owns the allowed-transition table + Ticket-33 guard, and route PUT/PATCH/blacklist through it. Make un-blacklist transition to a sensible prior/derived state rather than hard ACTIVE.

### src/components/clients/ClientSearchManager.tsx ("search-v2") — [no v1 found] ✅ not a finding
**What:** Audit flagged "search-v2 implies a v1." There is no surviving search-v1.
**Evidence:** Only `clients/search-v2/page.tsx` exists; nav (`lib/navigation/items.ts:112`) links only `search-v2`; no other `clients/search*` route, component, or API. `ClientSearchManager` is imported solely by the search-v2 page. The "-v2" suffix is vestigial naming; nothing legacy remains.
**Note:** Not dead, not duplicate — single reachable search. (Cleanup-only 🟡: the `-v2` suffix could be dropped for clarity, but no logic risk.)

### src/lib/imports/client/useDraft.ts — ✅ not a clients-domain finding
**What:** Despite the `imports/client/` path it is the generic import **draft-editor** hook (client-SIDE), not a clients-module file. Properly wired (5 importers under `components/imports/draft-editor/*`) and reads `data.message` correctly. No duplicate `useDraft` exists. Out of scope as a "clients" concern; no issue.

### Spot-checks that PASSED (no findings)
- **Blacklist lookup** (`api/clients/blacklist/route.ts`): uses `findUnique` by id and `findFirst` by email correctly; no fake-id fallback. ✅
- **BranchDeleteButton** (`components/clients/BranchDeleteButton.tsx`): shadcn `AlertDialog`, no `confirm()`, reads `data.message`, `PermissionGate module=CLIENTS action=DELETE`. ✅
- **ClientStatusToggle**: PATCH, reads `data.message`, AlertDialog. ✅ (the multi-writer issue above is on the API side, not this component.)
- **No `LEGACY_*`/fake-id fallback arrays** anywhere in `components/clients` or `clients/` pages. ✅
- **No `data.error` envelope misreads** in clients UI (only a comment referencing the gotcha). ✅
- **mockData/clients.ts** shape (`city/status/regionId/...`) matches the list `select` in `api/clients` GET; no schema drift observed for the fields the mock branch exercises. ✅
- **supervisorAssignment.ts**: clean SoT helper, correctly used by client create/update; the problem is the branch writers NOT using it (see CONFLICT above), not this file.
- **export-branches / invoice-prerequisites / capacity**: read-only or write to non-clients endpoints (`/api/deployment-rates`); no rogue branch/client writers.

---

## Top 5 highest-risk conflicts

1. **🔴 `PricingConfig` is write-dead but the deploy form reads it for guard types** (`pricing-configs/route.ts` + `guards/deploy/form.tsx:397`). The deployment guard-type dropdown is sourced from a table nothing writes → effectively always empty; canonical guard types live in `ClientContractRate`. Repoint to ClientContractRate, then drop the route + model.
2. **🔴 Contract & contract-rate routes don't bind contract→client** (`contracts/[contractId]/route.ts:37`, `contracts/[contractId]/rates/route.ts:50,152`). Scope check validates the path client, but the contract is fetched by id alone → cross-region admins can edit other clients' contracts/rates (IDOR). Constrain lookups by `{ id, clientId }`.
3. **🔴 Client import writes free-text `city` and no region** (`imports/definitions/clients.ts:78`). Violates the system-wide region→city derivation guard; imported clients are region-less and invisible to scoped lists. Add region FK + derive city.
4. **🟠 Four divergent `Client.status` writers** (PUT vs PATCH vs blacklist POST/DELETE) with different allowed values and an un-blacklist that hard-forces ACTIVE while bypassing the Ticket-33 branch-active guard. Consolidate into one `setClientStatus` transition.
5. **🟠 Branch supervisor assignment bypasses the `assignSupervisor` SoT** in both branch POST writers (`api/branches/route.ts:182`, dead nested `api/clients/[id]/branches/route.ts:182`) — no user validation, no prior-ACTIVE dedup, swallowed errors → can create duplicate ACTIVE assignments the PATCH path assumes can't exist.

---

## Confirmed-dead removal list (with proof)

| Item | Proof of zero use | Safe to remove |
|---|---|---|
| `POST` handler in `src/app/api/clients/[id]/branches/route.ts:69` | No `fetch`/`apiPost`/`apiSend` to `/api/clients/${id}/branches` with POST in repo; sole branch-create form posts to `/api/branches`. (Keep the file's `GET` — heavily used.) | Yes — remove `POST` export only |
| `PricingConfig` Prisma model (`schema.prisma:1059`) + `GET /api/clients/[id]/pricing-configs` route | `grep "pricingConfig"` → 1 hit (the read). Zero writers anywhere. Only consumer is `deploy/form.tsx`, which should read `ClientContractRate` instead. | Yes — **after** repointing `loadClientGuardTypes` to ClientContractRate (finding #1); requires a Prisma migration |

(Both removals require co-changes noted in their findings; nothing else in the Clients domain is fully dead — `ClientSearchManager`/search-v2, `useDraft`, `supervisorAssignment`, mockData and all components are wired and reachable.)
