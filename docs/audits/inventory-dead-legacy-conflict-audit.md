# Inventory Domain — Dead / Legacy / Conflicting-Logic Audit

Read-only forensic audit of the INVENTORY domain. **No source files were modified.**
Graph (`graphify-out/`, built 2026-04-28) used as routing index; filesystem verified for
files/dirs changed since the build. Verification commands run 2026-05-26.

---

## Executive Correction to the Task Premise

The brief assumed **three live generations** of inventory code. Reality on disk:

- **Legacy API `src/app/api/inventory/*`** — **does not exist as code.** Only empty,
  untracked directory skeletons remain (`vendors/`, `assignments/`, `demands/`,
  `conditions/`, `items/`, `categories/`, each with an empty `[id]/`). **Zero `.ts`
  files; zero tracked files.** The route handlers were already deleted; `git rm` left
  the directories behind.
- **Non-v2 `store-inventory/{vendors,assignments,demands,conditions,items,categories}`**
  — same story: **empty untracked directory skeletons, zero route files.**
- **Only one live API generation exists: `store-inventory/v2/*`.**

So the "three generations" are really: **v2 (live) + two layers of leftover empty
folders + a legacy dashboard UI tree kept as redirect shims + dead Prisma models.**

---

## Layer Map

| Path | Layer | Status |
|---|---|---|
| `src/app/(dashboard)/inventory/page.tsx` | legacy UI | **LEGACY (intentional shim)** — deprecation banner + link to v2 |
| `src/app/(dashboard)/inventory/[screen]/page.tsx` | legacy UI | **LEGACY (intentional shim)** — redirects to `/store-inventory/*` |
| `src/app/(dashboard)/inventory/inventory-report/page.tsx` | legacy UI | **LEGACY (intentional shim)** — redirects to `/reports` |
| `src/app/(dashboard)/store-inventory/page.tsx` | v2 | **ACTIVE** |
| `src/app/(dashboard)/store-inventory/[screen]/page.tsx` | v2 | **ACTIVE** (string-routed screen dispatcher) |
| `src/app/(dashboard)/store-inventory/purchases/[id]/page.tsx` | v2 | **ACTIVE** |
| `src/app/api/inventory/**` | legacy API | **DEAD** — empty dir skeleton, 0 files |
| `src/app/api/store-inventory/{vendors,assignments,demands,conditions,items,categories}/**` | non-v2 API | **DEAD** — empty dir skeleton, 0 files |
| `src/app/api/store-inventory/v2/**` (22 route files) | v2 | **ACTIVE** |
| `src/app/api/guards/[id]/store-inventory/route.ts` | v2-adjacent (guard read) | **ACTIVE** |
| `src/lib/inventory/store-v2-api.ts` | v2 | **ACTIVE** (22 importers; shared auth/scope guard) |
| `src/lib/inventory/store-v2-validators.ts` | v2 | **ACTIVE** (2 importers; partially bypassed — see findings) |
| `src/lib/inventory/store-v2-masters.ts` | v2 | **ACTIVE** (2 importers; contains dead legacy fallback) |
| `src/lib/inventory/store-screen-configs.ts` | v2 | **ACTIVE** (1 importer) |
| `src/lib/inventory/demand-response-meta.ts` | v2 | **ACTIVE** (4 importers) |
| `src/lib/inventory/purchase-workflow-meta.ts` | v2 | **ACTIVE** (3 importers) — JSON-in-notes hack |
| `src/lib/inventory/v2-flags.ts` | v2 | **ACTIVE (mostly DEAD surface)** — 4/5 flags + public variant unused |
| `src/lib/inventory/demand-status.ts` | v2 (stale) | **DEAD + CONFLICTING** — 0 importers, wrong enum |
| `src/components/store-inventory-v2/*Manager.tsx` (11 managers) | v2 | **ACTIVE** (1 importer each) |
| `src/components/store-inventory-v2/PurchaseDetailsPage.tsx` | v2 | **ACTIVE** (1 importer) |
| `src/components/store-inventory-v2/RolesManager.tsx` | v2 | **DEAD** — 0 importers |
| `src/components/store-inventory-v2/UsersManager.tsx` | v2 | **DEAD** — 0 importers |
| `src/components/store-inventory-v2/api.ts` | v2 | **ACTIVE** (envelope client) |
| `src/components/store-inventory-v2/use-scope-query.ts` | v2 | **ACTIVE** (8 importers) |
| `src/components/guards/tabs/StoreInventoryTab.tsx` | v2 | **ACTIVE** (wired into `GuardProfileTabs.tsx:176`) |
| `src/components/guards/tabs/InventoryTab.tsx` | legacy | **DEAD** — 0 importers |
| Prisma models `InventoryCategory/Vendor/Item/Condition/Assignment/Demand` (schema 1316–1424) | legacy | **DEAD (orphan tables)** — no live writers; one dead read path |

**Reachability:** `middleware.ts` `MODULE_ROUTES` only maps `/store-inventory → INVENTORY`
(line 20; matcher line 81). There is **no entry for legacy `/inventory`**, and **no nav
link** (`src/lib/navigation/items.ts`) points to it. Legacy `/inventory/*` is reachable
only by typing the URL, and serves only banner/redirects.

---

## Findings by submodule

### `src/lib/inventory/demand-status.ts:1` — [DEAD + CONFLICT] 🔴
**What:** Entire file is a demand status state machine
(`PENDING/APPROVED/REJECTED/FULFILLED`, transitions, `normalizeInventoryDemandStatus`,
`canTransitionInventoryDemandStatus`, …).
**Evidence:** Repo-wide importer count = **0** (no route, component, or lib imports it).
The live demands routes define their **own** inline status logic against the real Prisma
enum `StoreInventoryDemandStatus` = `DRAFT, SENT, APPROVED, REJECTED,
PARTIALLY_FULFILLED, FULFILLED, CANCELLED` (schema lines 12–20).
The dead file's set is **incompatible**: it omits `DRAFT/SENT/PARTIALLY_FULFILLED/CANCELLED`
and invents `PENDING`, which is **not** in the demand enum — `PENDING` actually belongs to
`StoreInventoryDemandResponseStatus` (schema line 22+). The file conflates two enums into a
wrong 4-state machine.
**Impact:** A landmine. Any future code that imports this "canonical-looking" helper will
emit/validate statuses that violate the DB enum and the live transition rules. Dead today,
actively misleading.
**Fix (root-cause):** Delete `demand-status.ts`. If a shared demand state machine is wanted,
re-derive it from the Prisma enum and have `demands/route.ts` + `demands/[id]/route.ts`
import it (consolidating the three current inline normalizers — see next finding).

### `src/app/api/store-inventory/v2/demands/route.ts:59` & `demands/[id]/route.ts:39,27` — [LEGACY/DUPLICATE] 🟠
**What:** Three separate demand-status normalizers/transition tables coexist, none shared:
`normalizeDemandStatus` (list/POST, defaults to `SENT`), `normalizeStatus` ([id] PATCH,
returns null on bad), and `allowedTransitions` ([id]:27). Plus the dead 4th in
`demand-status.ts`.
**Evidence:** `grep` shows 3 inline definitions + 1 dead file, all describing the same
domain concept with subtly different defaults/return contracts.
**Impact:** Drift risk — a transition allowed in one route's table but not enforced where the
status is set on create. The POST path accepts `DRAFT/SENT/APPROVED/…` with no transition
check (it's a create), so a client can create a demand already in `APPROVED`/`FULFILLED`,
bypassing the `allowedTransitions` gate that only runs on PATCH.
**Fix:** Single shared module (status enum mirror + `normalizeDemandStatus` +
`canTransition`), imported by both routes; restrict create to initial states (`DRAFT`/`SENT`).

### `src/app/api/store-inventory/v2/inventories/route.ts:22` — [CONFLICT] 🔴
**What:** The **only** v2 store-inventory route that does **not** go through the shared
`requireInventorySession()` guard. It rolls its own `await auth()` + `forbidden()` +
`hasAction(session, "INVENTORY", "VIEW")`.
**Evidence:** `requireInventorySession` is imported by 21/22 v2 route files; `inventories`
is the lone exception (`grep` "MISSING GUARD"). Its scope handling also calls
`deriveManagerScope`/`managerScopeDenied` directly instead of `readScopedRegionParams`.
**Impact:** Divergent auth surface. Any future hardening added to `requireInventorySession`
(e.g. user-active check, rate limit, audit) silently skips this route. Also a granularity
mismatch: `requireInventorySession` checks only `hasModuleAccess("INVENTORY")`, while sibling
routes additionally layer `hasAction(...)` per verb — `inventories` checks `VIEW` directly,
which is *more* strict, but the inconsistency means the guard contract is unclear.
**Fix:** Route through `requireInventorySession()` + `readScopedRegionParams()` like its
siblings; if a `VIEW` action check is desired, add it consistently (ideally fold an optional
`action` param into the shared guard so all routes declare their required action in one place).

### `src/app/api/store-inventory/v2/demands/route.ts:33` — [LEGACY/DUPLICATE] 🟡
**What:** Local `isWeaponCategoryName` redefined **identically** to the shared
`store-v2-validators.ts:16`.
**Evidence:** Byte-identical body (`text.includes("weapon") || text.includes("ammo")`).
`purchases` and `assignments` correctly import the shared one; `demands` does not.
**Impact:** Drift risk — if the shared weapon-detection rule changes, demands silently keeps
the old rule, letting weapon/ammo products into store→warehouse demands (a restriction this
route explicitly enforces at line 153).
**Fix:** Import `isWeaponCategoryName` from `@/lib/inventory/store-v2-validators`; delete the
local copy. Same applies to `adjustments/route.ts:42 isWeaponOrAmmoCategoryName` (identical
logic, different name).

### `src/app/api/store-inventory/v2/adjustments/route.ts:36` & `inventories/route.ts:13` — [LEGACY/DUPLICATE — borderline] 🟡
**What:** Local `normalizeCategoryScope` redefinitions.
**Evidence:** These differ from the shared 2-value version: adjustments uses `WEAPON_AMMO`,
inventories uses a 3-way `WEAPON/AMMO/NON_WEAPON`. The validators file comment explicitly
sanctions keeping these local.
**Impact:** Acceptable per the documented contract, BUT the name collision with the shared
2-value `normalizeCategoryScope` is confusing and invites accidental wrong-import.
**Fix (optional):** Rename local variants to `normalizeAdjustmentScope` /
`normalizeInventoryCategoryScope`, or hoist all scope normalizers into the shared validators
module with distinct names. Cleanup-only.

### `src/lib/inventory/v2-flags.ts:25` (`getPublicInventoryV2Flags`) — [DEAD] 🟡
**What:** Public flag reader.
**Evidence:** Importer count = **0** (no `.tsx`/`.ts` outside the file references it).
**Impact:** Dead export; ships an unused public API surface and 5 unused `NEXT_PUBLIC_*` env
vars (`.env:19-23`, `.env.local:12-16`) that imply client-side gating that doesn't exist.
**Fix:** Delete `getPublicInventoryV2Flags` and the 5 `NEXT_PUBLIC_INVENTORY_V2_*` env vars.

### `src/lib/inventory/v2-flags.ts:1` (4 of 5 flag fields) — [DEAD] 🟠
**What:** `InventoryV2Flags` has `enabled, readFromV2, writeEnabled, legacyReadonly,
cutoverComplete`. Only `writeEnabled` is ever read (2 reads: `store-v2-api.ts:256`,
`imports/definitions/inventory.ts:134`).
**Evidence:** `enabled → 0 reads`, `readFromV2 → 0`, `legacyReadonly → 0`,
`cutoverComplete → 0`.
**Impact:** Implies a migration cutover machine (read-from-v2 toggle, legacy-readonly,
cutover-complete) that **does not exist** — the cutover already happened (legacy is empty
dirs). Misleads anyone tuning env. The corresponding server env vars `INVENTORY_V2_ENABLED`,
`_READ_FROM_V2`, `_LEGACY_READONLY`, `_CUTOVER_COMPLETE` (`.env:14-18`) are dead config.
**Fix:** Collapse `InventoryV2Flags` to `{ writeEnabled }` (or inline the single env read in
`requireV2WriteEnabled`); drop the 4 dead env vars. Note `requireV2WriteEnabled` gates EVERY
v2 write — confirm `INVENTORY_V2_WRITE_ENABLED=true` is set in Vercel prod (it's `true` in
`.env`/`.env.local`; if unset in prod, all inventory v2 writes return 403).

### `src/lib/inventory/store-v2-masters.ts:3,134-136` & masters route `[resource]/route.ts:110-113` — [DEAD + stale Prisma] 🟠
**What:** Legacy-table fallback. `store-v2-masters.ts` builds the `categories` delegate as
`hasStoreInventoryCategoryModel ? prismaAny.storeInventoryCategory : prismaAny.inventoryCategory`;
the masters GET wraps `findMany` in a try/catch that, on `P2021/P2022` (table/column missing),
falls back to `prisma.inventoryCategory.findMany()` — the **legacy** model.
**Evidence:** `StoreInventoryCategory` exists in schema (line 1491) so
`hasStoreInventoryCategoryModel` is always `true` ⇒ the `: prismaAny.inventoryCategory`
branch is unreachable at runtime. The catch-fallback only fires if the v2 table is
missing/broken — which would be a deploy failure that should surface, not silently serve
legacy data with a different shape.
**Impact:** Dead defensive code that, if it ever fired, would mask a real schema/migration
problem and return legacy-shaped rows (no `parent`, no `canAssignGuard/Employee`) to the v2
UI. Keeps the dead legacy `InventoryCategory` table on life support.
**Fix:** Remove the legacy ternary branch and the `inventoryCategory`/`storeInventoryStatus`
catch-fallbacks. Let v2 table errors propagate as `internalServerError`. Co-change: drop the
orphan legacy Prisma models (next finding).

### `prisma/schema.prisma:1316-1424` (Inventory*, legacy models) — [DEAD/LEGACY] 🟠
**What:** `InventoryCategory, InventoryVendor, InventoryItem, InventoryCondition,
InventoryAssignment, InventoryDemand` legacy models persist though all their routes/pages are
gone.
**Evidence:** Only references in live code are the two dead fallback paths above
(`prisma.inventoryCategory`). No writers, no live readers.
**Impact:** Orphan tables; schema bloat; the one read path is dead-and-misleading.
**Fix:** After removing the masters fallback, drop these models via a migration (verify no
prod data dependency first). This is the last thing tethering the legacy generation.

### `src/components/store-inventory-v2/RolesManager.tsx:22` — [DEAD] 🟠
**What:** A store-inventory-v2 roles manager.
**Evidence:** Importer count = **0.** The live `/users/roles` page imports a **different**
component, `@/components/users/RolesManager` (`users/roles/page.tsx:4`). The
`store-inventory/[screen]` dispatcher redirects `roles → /users/roles` (line 106), so this
v2 copy is never rendered.
**Impact:** Duplicate orphan; hits `/api/roles` from a screen no one can reach.
**Fix:** Delete `src/components/store-inventory-v2/RolesManager.tsx`.

### `src/components/store-inventory-v2/UsersManager.tsx:36` — [DEAD] 🟠
**What:** A store-inventory-v2 users manager.
**Evidence:** Importer count = **0.** `[screen]` redirects `users → /users` (line 107).
**Impact:** Duplicate orphan; calls `/api/users`, `/api/roles`, `/api/regions`,
`/api/regional-offices` from an unreachable screen.
**Fix:** Delete `src/components/store-inventory-v2/UsersManager.tsx`.

### `src/components/guards/tabs/InventoryTab.tsx:1` — [DEAD] 🟡
**What:** Legacy guard-profile inventory tab (static placeholder linking to
`/store-inventory/employee-assignments`).
**Evidence:** Importer count = **0.** The live `GuardProfileTabs.tsx:17,176` renders
`StoreInventoryTab` instead.
**Impact:** Orphaned component (also already flagged dead in the Guards audit).
**Fix:** Delete `src/components/guards/tabs/InventoryTab.tsx`.

### `src/app/api/guards/[id]/store-inventory/route.ts:51,54` — [CONFLICT] 🟠
**What:** Success path returns a **raw array** (`NextResponse.json(rows)`), not the v2
`{ success, data }` envelope; error path returns `NextResponse.json([], { status: 200 })`,
swallowing failures as an empty 200.
**Evidence:** Errors use `forbidden()`/`unauthorized()` helpers but success bypasses `ok()`.
Consumer `StoreInventoryTab.tsx:62` does `res.json()` and reads the array directly, so it's
internally consistent — but inconsistent with every other v2 endpoint (which the shared
`api.ts` client unwraps via `payload.data`).
**Impact:** (1) Envelope drift — this endpoint can't be consumed by the shared v2 `apiGet`
client. (2) Silent failure: a DB error returns `[]`/200, so the guard profile shows "no
inventory" instead of an error, masking outages.
**Fix:** Return `ok(rows)`; on error return `internalServerError(...)` and update
`StoreInventoryTab` to read `data.data` via the shared `apiGet` client. Co-change:
`StoreInventoryTab.tsx:61-68`.

### `src/app/api/store-inventory/v2/purchases/route.ts:302-340` vs `purchases/[id]/receive/route.ts:88-120` — [CONFLICT] 🔴
**What:** Two different writers add purchase stock to the same `StoreInventoryBalance` with
**divergent math**:
- **POST (create-with-`RECEIVED`)**: `quantityOnHand += line.quantity`; recomputes
  `avgUnitCost` as naive `(old + new) / 2`; **never touches** `quantityHeld`; **never records
  a receive-history event**; uses **non-atomic read-then-write** (`nextOnHand`).
- **`[id]/receive`**: `quantityOnHand += receivedNewQty + reusableQty`;
  `quantityHeld += reusableQty`; **never touches** `avgUnitCost`; tracks "already received"
  by **parsing JSON out of the `notes` text column** (`[WORKFLOW_META]`); uses **atomic
  `{ increment }`**.
**Evidence:** Both upsert `storeInventoryBalance` for the same `(storeId, productId)` key;
field coverage and concurrency model differ.
**Impact:** 🔴 (1) **Double-count risk**: a purchase created already `RECEIVED` (POST path)
records no receive-history, so calling `[id]/receive` on it later passes the
`alreadyReceivedByLine` check (history empty) and adds stock again. (2) Inconsistent
`avgUnitCost` — set on the create path, ignored on the canonical receive path, so weighted
cost drifts. (3) Naive `(old+new)/2` averaging is wrong vs quantity-weighted average cost.
(4) Mixed atomic/non-atomic writes invite lost updates under concurrency.
**Fix (root-cause):** Disallow creating a purchase directly in `RECEIVED` state — force all
stock entry through the single `[id]/receive` path. Extract one
`applyStockMovement(tx, {storeId, productId, onHandDelta, heldDelta, issuedDelta, unitCost?,
qtyForAvg?})` helper used by **all** balance writers, with quantity-weighted avg-cost and
atomic increments. Move receive-history out of the `notes` JSON hack into a real column/table.

### `src/app/api/store-inventory/v2/{purchases,receive,assignments,return,adjustments,demands/responses,demands/responses/receive}` — [CONFLICT] 🟠
**What:** **Seven** independent inline writers to `StoreInventoryBalance`, no shared
mutation helper. Field coverage varies per writer:
- purchases POST: onHand, avgUnitCost (non-atomic)
- purchase receive: onHand, held (atomic)
- assignments POST: onHand↓, issued↑ (atomic; checks `INSUFFICIENT_STOCK`)
- assignment return: onHand, held (atomic)
- adjustments: onHand=`after`, avgUnitCost (**non-atomic** absolute set)
- demand response (allocate): onHand (update)
- demand response receive: onHand↑, held↑ (atomic)
**Evidence:** `grep storeInventoryBalance.(upsert|update)` → 7 distinct routes; each computes
balance fields differently; `purchases` POST and `adjustments` use read-then-write while the
rest use atomic increments.
**Impact:** No single source of truth for stock math; every field-coverage decision is
re-litigated per route. Adjustments' absolute `quantityOnHand = after` (read-then-write) can
clobber concurrent assignment/receive deltas (lost update). The `quantityHeld` semantics
("reusable") are set by purchase-receive/return/demand-receive but never consumed by the
availability check in assignments (which only reads `quantityOnHand`) — held stock is
effectively assignable, contradicting its purpose.
**Fix:** Centralize in one `applyStockMovement` helper (see above), always atomic; define
availability as `quantityOnHand - quantityHeld - quantityIssued` (or document the real
invariant) and use it uniformly in the assignment stock check.

### `src/lib/inventory/purchase-workflow-meta.ts` + `demand-response-meta.ts` — [CONFLICT — design] 🟠
**What:** Structured workflow state (transport details, receive-line history, PO metadata,
demand allocation/receive ledger) is **serialized as JSON into free-text columns**
(`purchase.notes` with `[PO_META]`/`[WORKFLOW_META]` markers; demand-response `meta`).
**Evidence:** `parsePurchaseNotes`/`serializePurchaseNotes` (3 importers),
`parseDemandResponseMeta`/`serializeDemandResponseMeta` (4 importers).
**Impact:** The receive-double-count bug above is a direct consequence — "already received"
quantities live in parseable text, not queryable columns, so integrity checks depend on
string parsing and can't be enforced by the DB. Not dead, but the SoT for received/allocated
quantities is a string blob, which is fragile and unauditable.
**Fix:** Promote these to real columns/relations (e.g. `PurchaseReceiveEvent`,
`receivedQty` on lines; `allocatedQty`/`receivedQty` on demand-response lines). Larger change
but eliminates the parsing-based integrity surface.

---

## Top 5 highest-risk conflicts

1. 🔴 **Purchase stock double-count + divergent math** — `purchases/route.ts:302` vs
   `purchases/[id]/receive/route.ts:88`. Create-with-RECEIVED adds stock with no receive
   history, so a later receive re-adds it; avgUnitCost set one place, ignored the other;
   naive `(old+new)/2` averaging; mixed atomic/non-atomic writes.
2. 🔴 **`demand-status.ts` stale-and-wrong state machine** — 0 importers but encodes a
   `PENDING`-based 4-state enum that contradicts the real `StoreInventoryDemandStatus`
   (7 states). A live import would silently produce DB-invalid statuses.
3. 🔴 **`inventories/route.ts` bypasses `requireInventorySession()`** — the lone v2 route
   with ad-hoc auth; future guard hardening will skip it.
4. 🟠 **7 uncoordinated `StoreInventoryBalance` writers** — no shared stock helper;
   adjustments' non-atomic absolute set can clobber concurrent deltas; `quantityHeld` set but
   never honored by the assignment availability check.
5. 🟠 **Guard store-inventory endpoint envelope + silent-failure** —
   `guards/[id]/store-inventory/route.ts` returns a raw array and swallows errors as `[]`/200,
   diverging from the v2 envelope and hiding outages on the guard profile.

---

## Confirmed-dead removal list (with proof)

| Item | Proof | Safe to delete? |
|---|---|---|
| `src/components/store-inventory-v2/RolesManager.tsx` | 0 importers; `/users/roles` uses `@/components/users/RolesManager`; `[screen]` redirects `roles→/users/roles` | Yes |
| `src/components/store-inventory-v2/UsersManager.tsx` | 0 importers; `[screen]` redirects `users→/users` | Yes |
| `src/components/guards/tabs/InventoryTab.tsx` | 0 importers; `GuardProfileTabs` renders `StoreInventoryTab` | Yes |
| `src/lib/inventory/demand-status.ts` | 0 importers; conflicts with Prisma enum | Yes (also fixes a landmine) |
| `getPublicInventoryV2Flags` + 4 unused flag fields (`v2-flags.ts`) | 0 reads for public fn + `enabled/readFromV2/legacyReadonly/cutoverComplete` | Yes (collapse to `writeEnabled`) |
| `src/app/api/inventory/**` (empty dir skeleton) | 0 files, 0 tracked entries | Yes (rmdir) |
| `src/app/api/store-inventory/{vendors,assignments,demands,conditions,items,categories}/**` (empty skeletons) | 0 files, 0 tracked entries | Yes (rmdir) |
| Legacy fallback branches in `store-v2-masters.ts:134-136` and `masters/[resource]/route.ts:110-118` | unreachable (`StoreInventoryCategory` always present); fire only on schema breakage | Yes (let errors propagate) |
| Prisma legacy `Inventory*` models (schema 1316–1424) | no live writers; only dead read paths | Yes, **after** removing the masters fallback + verifying no prod data dependency (migration) |

### Is the entire legacy `inventory/` tree safe to delete?

**Dashboard tree (`src/app/(dashboard)/inventory/*`): KEEP for now.** It is not dead — it's
**intentional redirect/deprecation shims** (`[screen]/page.tsx` maps old screen names to
`/store-inventory/*`; `inventory-report` → `/reports`; root shows a banner). Deleting it
would 404 any bookmarked legacy URL. Safe to delete only after confirming no external
bookmarks/integrations hit `/inventory/*` (then they'd 404 cleanly anyway). **Low priority.**

**Legacy API tree (`src/app/api/inventory/**`) and non-v2 store-inventory API skeletons:
DELETE the empty directories** — already zero code, zero tracked files; pure leftover clutter
from a prior `git rm`.

**Legacy Prisma `Inventory*` models: DELETE** after removing the two dead fallback read paths
that still reference `prisma.inventoryCategory` (and verifying no production data depends on
those tables).
