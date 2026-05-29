# USERS / PERMISSIONS / AUTH — Dead / Legacy / Conflicting-Logic Audit (security-critical)

Read-only forensic audit. Scope: users CRUD, roles, role/user permissions, the permission model, the two auth configs + middleware, regional scope, and the cs/ms supervisor subsystems. No source files were modified.

Method: graph (`graphify-out/`, built 2026-04-28) for orientation; every dead/conflict verdict proven by repo-wide grep of real call sites (fetch URLs, nav links, `MODULE_ROUTES`, dynamic imports). Graph importer counts ignored for API routes (string-fetched).

---

## 1. SuperAdmin-gotcha consistency table

Canonical rule (CLAUDE.md): `role === "Super User"` ⇒ always unrestricted · `role === "Admin"` AND `permissions.length === 0` ⇒ unrestricted · `role === "Admin"` WITH permissions ⇒ regional admin (case-sensitive).

The three *task-named* core files do **not all** evaluate the gotcha — `auth.config.ts` and `lib/auth.ts` only **stamp** `role` + `permissions` into the JWT/session (no gotcha branch), and `middleware.ts` **delegates** to the canonical `isSuperAdmin()`. So the canonical predicate is centralized. The real risk is the **6 other places that re-implement or diverge from it**.

| # | Location | Predicate as implemented | Verdict |
|---|---|---|---|
| canonical | `src/lib/api/permissions.ts:22-28` | `role === "Super User" → true; return role === "Admin" && perms.length === 0` | **SoT** |
| 1 | `src/middleware.ts:55` | calls canonical `isSuperAdmin({user:{role,permissions}})` | ✅ MATCH (delegates) |
| 2 | `src/auth.config.ts:38-64` | no gotcha — only copies `token.role`/`token.permissions` | ✅ N/A (stamps only) |
| 3 | `src/lib/auth.ts:156-237` | no gotcha — only copies role/permissions into token | ✅ N/A (stamps only) |
| 4 | `src/lib/access/scope.ts:39` | calls canonical `isSuperAdmin` | ✅ MATCH |
| 5 | `src/components/shadcn/permission-gate.tsx:23-27` | `role === "Super User" → true; role === "Admin" && (perms?.length ?? 0) === 0` | ✅ MATCH (client mirror) |
| 6 | `src/lib/dashboard/role.ts:25-27` | `Super User→SUPER_ADMIN; Admin&&len0→SUPER_ADMIN; Admin→ADMIN_REGIONAL` | ✅ MATCH (presentation enum) |
| 7 | `src/app/(dashboard)/clients/invoicing/manager.tsx:60` | `role === "Super User" || (role === "Admin" && perms.length === 0)` | ✅ MATCH (inlined copy #1) |
| 8 | `src/app/api/imports/jobs/route.ts:29` | `role === "Super User" || (role === "Admin" && perms.length === 0)` | ✅ MATCH (inlined copy #2) |
| **9** | **`src/lib/payroll/state-permissions.ts:15-21`** | **`if (role !== "Admin") return false; return perms.length === 0`** | **🔴 DIVERGE — drops the "Super User" branch** |

**VERDICT: DIVERGE.** A 9th implementation in `src/lib/payroll/state-permissions.ts` **omits the `"Super User"` branch**: it returns `false` for any role that is not exactly `"Admin"`. A user whose DB role is `"Super User"` is therefore **NOT** treated as SuperAdmin by the payroll state machine (global-finalize, global-unfinalize, emergency-release, lock-region — all import `isSuperAdmin` from this file). This is an access-control inconsistency: the canonical rule grants Super User unrestricted access everywhere, but payroll-state SuperAdmin-only actions silently deny them. See finding **CONFLICT-1**.

Secondary drift: the gotcha is now inlined verbatim in **5 places** (#5, #7, #8, plus the two role-string variants below) instead of importing the single helper — every copy is a future divergence point.

---

## 2. Permission-resolution map (role-perms + user-perms → effective)

There are **two contradictory resolution algorithms** for the same `(RolePermission, UserPermission)` → effective question:

| Path | File | Algorithm | Result for "role grants GUARDS:VIEW+UPDATE, user-override row = GUARDS:VIEW only" |
|---|---|---|---|
| **ENFORCED** (JWT) | `src/lib/auth.ts:47-59` `buildPermissionSet` | **REPLACE per module**: if a module has *any* user-level row, role rows for that module are **skipped**; only the user row's enabled actions are emitted | `GUARDS`, `GUARDS:VIEW` only → **UPDATE lost** |
| **DISPLAYED** (UI/API) | `src/app/api/user-permissions/route.ts:46-82` GET | **UNION**: `effective = fromRole.canX \|\| fromUser.canX` | `GUARDS:VIEW + GUARDS:UPDATE` (UI legend literally says "Effective access = Role OR Additional", `UserPermissionsManager.tsx:294`) |

This is the single most dangerous structural conflict in the module — detailed as **CONFLICT-2**.

Resolution order is otherwise: `lib/auth.ts` emits BOTH module-only keys (`"GUARDS"`) and action keys (`"GUARDS:VIEW"`). `hasModuleAccess` checks the module key; `hasAction` checks the action key with no module-only fallback (correct). SuperAdmin short-circuits both.

---

## 3. Findings by submodule

### `src/lib/payroll/state-permissions.ts:15-21` — CONFLICT 🔴 (originates outside module, auth-rule divergence)
**What:** A duplicate `isSuperAdmin()` that omits the `role === "Super User"` branch (`if (role !== "Admin") return false`).
**Evidence:** Canonical `src/lib/api/permissions.ts:26` returns `true` for `"Super User"`; this one returns `false`. Imported by `api/payroll/state/{global-finalize,global-unfinalize,emergency-release,lock-region,...}` (grep-confirmed 5+ call sites).
**Impact:** A genuine Super User is **denied** SuperAdmin-only payroll-state operations (global finalize/unfinalize, emergency release, region lock) that the canonical rule says they must have. Conversely, anyone relying on Super User for break-glass payroll actions is silently locked out. Access-control rule is not single-sourced.
**Fix (root cause):** Delete this local `isSuperAdmin` and import the canonical one from `@/lib/api/permissions`. Co-change: `getActorIdentity` can stay or move alongside. Verify the 5 payroll-state routes still type-check.

### `src/app/api/user-permissions/route.ts:46-82` (GET) vs `src/lib/auth.ts:47-59` (`buildPermissionSet`) — CONFLICT 🔴 (privilege drift, silent revocation)
**What:** The effective-permissions UI computes role∪user (UNION); the JWT enforcement computes user-replaces-role per module (OVERRIDE). They disagree whenever a user has *any* override row for a module that also has role permissions.
**Evidence:** `user-permissions` GET line 72-76 `fromRole.canX || fromUser.canX`. `buildPermissionSet` lines 51-54 `for (const row of roleRows) { if (userModules.has(row.module)) continue; ... }` — role row dropped if a user row exists. `UserPermissionsManager.tsx:347` **disables** role-granted checkboxes so the saved override row is always a strict subset of role perms → guarantees the override row lacks role-granted actions → `buildPermissionSet` then drops them.
**Impact:** Admin opens a user, sees (correctly, per UI) effective = role ∪ extras, saves a single additional permission. On the user's next login/token-refresh, `buildPermissionSet` **silently revokes every role-granted action for that module** (keeps only the override actions). Real-world: granting one extra checkbox can strip a user's existing role-based access for that module. The audit UI and the enforced reality permanently disagree.
**Fix (root cause):** Pick ONE model and single-source it. Recommended: make enforcement match the displayed/intended UNION model — change `buildPermissionSet` to merge role∪user per action (don't skip role rows), and have `user-permissions` PUT store true additive deltas. Extract the resolver into one shared function used by both `lib/auth.ts` and `api/user-permissions` GET so they can never drift again. Co-change: re-issue tokens / document that the change re-expands previously-clobbered permissions.

### `src/app/api/users/[id]/route.ts:12-69` (PATCH) + `src/app/api/users/route.ts:101-151` (POST) — CONFLICT 🔴 (privilege escalation — global-role assignment)
**What:** No server-side guard stops a non-SuperAdmin (regional Admin / any user with `USERS:CREATE`/`USERS:UPDATE`) from assigning a **GLOBAL-scoped role** (e.g. "Super User") to any user, including themselves.
**Evidence:** PATCH only validates role-scope↔region consistency (lines 55-68); POST same (lines 137-151). Neither checks `isSuperAdmin(session)` before allowing `role.scopeType === "GLOBAL"`. The restriction "Only Super Users can assign GLOBAL roles" exists **only client-side**: `users/[id]/edit/form.tsx:152` and `UserEnrollmentManager.tsx:207` (`.filter(role => isSuperAdmin || role.scopeType !== "GLOBAL")`). A direct `PATCH /api/users/{ownId} {roleId: <globalSuperUserRoleId>}` bypasses the UI filter.
**Impact:** **Privilege escalation to unrestricted SuperAdmin.** A regional admin with `USERS:UPDATE` can promote themselves (or a confederate) to the global "Super User" role and gain full cross-region, unrestricted access. The `managerScope` guards only check region membership, not target role scope, so they don't block this.
**Fix (root cause):** In both POST and PATCH, when the resolved target role's `scopeType === "GLOBAL"`, require `isSuperAdmin(session)` else `forbidden`. Additionally forbid a non-SuperAdmin from changing **their own** `roleId` (self-escalation guard). Mirror the existing client-side filter on the server.

### `src/app/api/users/[id]/route.ts` (PATCH) — CONFLICT 🟠 (no self-role / grant-what-you-have guard)
**What:** Beyond the GLOBAL case above, there is no check preventing a user from editing their own role/region, and no check that a regional admin only assigns roles/scopes they themselves possess.
**Evidence:** PATCH has self-guard only on DELETE (`id === actorId`, line 140), not on role/permission change. `managerScope` restricts region but not "can the actor grant this role at all".
**Impact:** Lateral/vertical privilege change within a region (e.g. assign self a more powerful regional role) and self-region edits go unchecked at the role layer.
**Fix:** Add a self-edit guard for `roleId`/region fields; optionally enforce "actor cannot assign a role whose effective permissions exceed the actor's own".

### `src/app/api/roles/route.ts:41-76` (POST) — CONFLICT 🔴 (missing gate)
**What:** Role creation has **no permission/role gate** — only `if (!session) unauthorized()`. Any authenticated user (incl. a Supervisor with zero USERS permission) can create new roles.
**Evidence:** `grep -c hasAction roles/route.ts` → 0. POST body is accepted from any session. Contrast: `roles/[id]` DELETE gates on `role === "Admin"`, `role-permissions` PUT gates on admin.
**Impact:** Unprivileged users can pollute the role table (and a created role becomes assignable; combined with the GLOBAL-role escalation above, an attacker could craft a role). At minimum an integrity/DoS gap; at worst a building block for escalation.
**Fix:** Gate POST with `hasAction(session, "USERS", "CREATE")` (or admin-only, to match the rest of the role subsystem). Also gate GET (currently any session reads all roles — lower risk).

### `src/app/api/roles/[id]/route.ts:16-19` vs `src/app/api/role-permissions/route.ts:43-45` — CONFLICT 🟠 (inconsistent role-string predicates)
**What:** Two different ad-hoc role checks for the same "admin" gate, neither using the canonical `isSuperAdmin`.
**Evidence:** roles DELETE: `if (userRole !== "Admin") forbidden` — **case-sensitive exact "Admin"**, so a `"Super User"` is **blocked** from deleting roles, and a *regional* Admin (Admin WITH permissions) is **allowed**. role-permissions PUT: `if (userRole.toLowerCase() !== "admin") forbidden` — **case-insensitive**, also blocks "Super User", also allows regional Admin.
**Impact:** (a) A genuine Super User cannot delete a role or edit role permissions (inconsistent with their unrestricted status). (b) A *regional* Admin (who is NOT a SuperAdmin per the gotcha) CAN edit global role permissions and delete roles — a privilege the gotcha says they shouldn't have. (c) Case sensitivity differs between the two sibling endpoints.
**Fix:** Replace both with `isSuperAdmin(session)` (and/or `hasAction(session,"USERS",...)`) so the predicate is single-sourced and the gotcha is honored. Same applies to `api/audit-logs/route.ts:145` and `api/guards/[id]/status/route.ts:46` which use the same `toLowerCase() !== "admin"` pattern (originate outside this module — noted for co-change).

### `src/app/api/role-permissions/route.ts:15-35` (GET) & `src/app/api/user-permissions/route.ts:20-89` (GET) — CONFLICT 🟠 (missing read gate)
**What:** Both GET handlers have no `hasAction`/role gate (only `if (!session)`).
**Evidence:** role-permissions GET: 0 `hasAction`. user-permissions GET (line 20-89): no gate; DELETE/PUT *are* gated (`USERS:UPDATE`, lines 99/122) but GET is not.
**Impact:** Any authenticated user can enumerate any role's permission matrix and any user's effective permissions (`?userId=` / `?roleId=`) — information disclosure useful for targeting an escalation. Inconsistent with the write paths' gates.
**Fix:** Gate both GETs with `hasAction(session, "USERS", "VIEW")`.

### `src/components/settings/UserTypesManager.tsx` (`/settings/user-types`) — LEGACY/DUPLICATE 🟠
**What:** A second, parallel user-management + role-management UI that duplicates `/users` (create user via `POST /api/users`) and `/users/roles` (create/delete role via `/api/roles`).
**Evidence:** Rendered at `src/app/(dashboard)/settings/user-types/page.tsx`. Calls `/api/users`, `/api/roles`, `/api/roles/{id}` DELETE. Gates UI on `(session.user).role === "Admin"` only (line 31) — **misses "Super User"** (a Super User sees no Add buttons) and **includes regional Admins** (Admin WITH perms see the buttons), contradicting the gotcha. Uses banned `window.confirm` (lines 143). Reads `data.error` fallback (line 112).
**Impact:** Drift surface: two creation pipelines for users/roles with different (and wrong) gating than the canonical `isSuperAdmin`/`hasAction`. A Super User cannot create users here; a regional Admin can. Confusing dual SoT for user creation.
**Fix:** Consolidate into the `/users` + `/users/roles` screens (single creation pipeline) or, if this screen must stay, replace the inline `role === "Admin"` checks with `hasAction(...)`/`isSuperAdmin`, swap `window.confirm` for shadcn `AlertDialog`, and read `data.message`.

### `src/app/(dashboard)/users/permissions/page.tsx` + `src/lib/parity/screenConfigs.ts:430-437` (`userLinks`) — DEAD 🟡
**What:** `/users/permissions` is a redirect-only stub → `/users/roles?tab=overrides`. The `userLinks` array that references it is itself dead config.
**Evidence:** `permissions/page.tsx` body is `redirect(...)`. `/users/permissions` has exactly one reference: `screenConfigs.ts:433`. `userLinks` (the only thing referencing that href) has **zero consumers** (`grep userLinks` → only its own definition). Live nav uses `src/lib/navigation/items.ts` which points to `/users/roles`, not `/users/permissions`.
**Impact:** Dead route stub + dead nav config; harmless but confusing. The redirect target is correct, so no access impact.
**Fix:** Remove `userLinks` (and the `/users/permissions` entry) from `screenConfigs.ts`; optionally delete the redirect stub `permissions/page.tsx` (or keep it as a back-compat 301 — low priority).

### `src/app/(dashboard)/users/cs-relationship/page.tsx`, `ms-relationship/page.tsx`, `search/page.tsx` — CONFLICT 🟡 (inconsistent page-level gating)
**What:** These three pages render their managers with **no `auth()` call and no page-level permission check**, unlike sibling pages `new/page.tsx`, `[id]/page.tsx`, `switch-supervisor/page.tsx`, `users/page.tsx` which all call `auth()`/`hasAction`/`isSuperAdmin`.
**Evidence:** cs/ms/search pages are 5-line render-only wrappers. They depend solely on middleware `MODULE_ROUTES` (`/users → USERS` module-level) plus the gated APIs the managers call.
**Impact:** Low — the API layer (`cs/ms-relationships`, `/api/users`) enforces `hasAction`, and middleware enforces module-level USERS. But a user with the coarse `USERS` module key but no `USERS:VIEW` action key would still see these pages render their shell (API calls then 403). Defense-in-depth inconsistency, not a confirmed bypass.
**Fix:** Add `auth()` + `hasAction(session,"USERS","VIEW")` (redirect on deny) to these three pages to match siblings.

### `src/app/api/users/switch-supervisor/route.ts:190` vs `src/app/api/guards/[id]/supervisor/route.ts:94` — CONFLICT 🟠 (status-string drift + bypassed SoT)
**What:** Three writers to `guardSupervisorAssignment` with inconsistent terminal-status strings and no shared SoT. (Contrast: ClientSupervisorAssignment has a SoT `src/lib/clients/supervisorAssignment.ts::assignSupervisor`, but `cs-relationships` POST does **not** use it either.)
**Evidence:** `switch-supervisor` sets old rows to `status: "INACTIVE"` (line 192). `guards/[id]/supervisor` PATCH sets them to `status: "ENDED"` (line 94). `guards/route.ts:341` / `guards/[id]/route.ts:232` write directly too. `cs-relationships/route.ts:148` does `clientSupervisorAssignment.create` directly, bypassing `assignSupervisor()` (which dedups prior ACTIVE + validates supervisor existence).
**Impact:** (a) Two different "no longer active" enum values for one column — any future query filtering on `"ENDED"` vs `"INACTIVE"` will miss rows; reporting/history drift. (b) `cs-relationships` POST can create duplicate ACTIVE client-supervisor assignments and skips the supervisor-existence validation the SoT enforces — two writers, two validation rules. `switch-supervisor` reconciles with neither SoT.
**Fix:** Introduce a single `assignGuardSupervisor()` SoT (mirroring the client one) used by switch-supervisor, guards create/update, and the supervisor PATCH, with one canonical terminal status. Route `cs-relationships` POST through `assignSupervisor()`.

### `src/app/api/users/cs-relationships/[id]/route.ts` & `ms-relationships/[id]/route.ts` & relationship POSTs — LEGACY 🟡 (API-envelope inconsistency)
**What:** These routes return raw `NextResponse.json({ success: true })` / raw created objects instead of the `ok()` envelope helper, while using the error helpers (`forbidden`, `unauthorized`) from `response.ts`. Same for `users` POST/PATCH/DELETE (`NextResponse.json(created)`), `roles`, `role-permissions`, `user-permissions`.
**Evidence:** cs/ms `[id]` DELETE return `{ success: true }` (not `ok(...)`). `users/[id]` DELETE returns `{ success: true }`; the "cannot delete own account" path returns a bare `{ message }` with 400 (not `badRequest()`), so its `code` field is absent.
**Impact:** Envelope drift — success responses are `{success:true}` or raw objects, not `{success:true,data}`. Clients in this module read raw JSON arrays directly (e.g. `UsersTable`, `RolePermissionsManager`), so it works, but it's inconsistent with the documented envelope and brittle for new consumers. Low risk.
**Fix:** Standardize on `ok(data)` for success and `badRequest()` for the self-delete case. Audit clients that currently expect raw arrays before flipping.

### `src/components/shadcn/permission-gate.tsx:23-54` — LEGACY/DUPLICATE 🟡 (necessary client mirror, drift risk)
**What:** Re-implements `isSuperAdmin` (lines 23-27) and `permKey` (line 29) and `hasAction` semantics (lines 42-54) for the client `useSession()` shape.
**Evidence:** Faithful mirror — case-sensitive, matches canonical. But it is a hand-maintained copy of `lib/api/permissions.ts` + `lib/constants/permissions.ts:permissionKey`.
**Impact:** No current bug; pure drift risk. If the server gotcha or key format changes, this silently diverges (client shows/hides wrong UI). Acceptable because edge/client can't import the server module, but should be flagged.
**Fix:** Extract the pure predicates (`isSuperAdminFromUser`, `permKey`) into an isomorphic module (no `next-auth/react` import) imported by both server and client, leaving only the `useSession()` adapter here.

---

## 4. Top 5 highest-risk

1. **🔴 Privilege escalation — self/any GLOBAL-role assignment** (`api/users/[id]` PATCH, `api/users` POST). GLOBAL ("Super User") role assignment is blocked **only in the UI**; a direct API call lets a regional admin with `USERS:UPDATE` promote themselves to unrestricted SuperAdmin. → CONFLICT-3.
2. **🔴 Silent permission revocation — UNION vs OVERRIDE resolver split** (`api/user-permissions` GET vs `lib/auth.ts buildPermissionSet`). Saving one user-override checkbox can strip all role-granted actions for that module on next token refresh; the audit UI and enforcement permanently disagree. → CONFLICT-2.
3. **🔴 SuperAdmin rule divergence in payroll-state** (`lib/payroll/state-permissions.ts:15-21`) — duplicate `isSuperAdmin` drops the "Super User" branch, denying genuine Super Users break-glass payroll-state actions. → CONFLICT-1.
4. **🔴 Unprivileged role creation** (`api/roles` POST has no gate) — any authenticated user can create roles, and roles GET / role-permissions GET / user-permissions GET also lack read gates (information disclosure of the whole permission matrix).
5. **🟠 Inconsistent admin predicates on role mutations** (`roles/[id]` DELETE `!== "Admin"` vs `role-permissions` PUT `.toLowerCase() !== "admin"`) — both block real Super Users yet allow *regional* Admins to mutate global role permissions / delete roles, inverting the gotcha; case sensitivity also differs.

---

## 5. Confirmed-dead removal list (with proof)

| Item | Proof | Severity |
|---|---|---|
| `userLinks` array — `src/lib/parity/screenConfigs.ts:430-437` | `grep -rn "userLinks"` → only its own definition; zero consumers. | 🟡 |
| `/users/permissions` route + `permissions/page.tsx` (redirect stub) | Only reference to the href is the dead `userLinks` (above). Live nav (`lib/navigation/items.ts:220`) points to `/users/roles`. Stub body is `redirect("/users/roles?tab=overrides")`. Optional: keep as back-compat redirect; the `userLinks` entry is the dead part. | 🟡 |

No fully-dead API routes or components found in the module — cs/ms/switch-supervisor/supervisors/search/enrollment all have proven live call sites (managers fetch them; nav links in `lib/navigation/items.ts:219-223`; `AssignmentsManager` reads cs/ms-relationships).

**SUSPECTED (not removed):** none. All other endpoints/components have confirmed callers.

---

## Appendix — files reviewed
Auth core: `src/auth.config.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/api/permissions.ts`, `src/lib/constants/permissions.ts`, `src/lib/access/scope.ts`, `src/lib/reports/access.ts`, `src/lib/cron/auth.ts`, `src/lib/api/response.ts`, `src/lib/payroll/state-permissions.ts`, `src/lib/dashboard/role.ts`, `src/lib/clients/supervisorAssignment.ts`.
API: `api/users`(+`[id]`,`supervisors`,`switch-supervisor`,`cs-relationships`(+`[id]`),`ms-relationships`(+`[id]`)), `api/roles`(+`[id]`), `api/role-permissions`, `api/user-permissions`, `api/auth/[...nextauth]`, `api/guards/[id]/supervisor`, `api/insights`(+`config`).
App: `users/` root, `[id]`(+`edit`), `new`, `roles`, `permissions`, `search`, `switch-supervisor`, `cs-relationship`, `ms-relationship`.
Components: `users/{UsersTable,RolePermissionsManager,UserPermissionsManager,UserEnrollmentManager,Cs/MsRelationshipManager,UserSearchManager,RolesManager}`, `shadcn/permission-gate.tsx`, `settings/UserTypesManager.tsx`.
