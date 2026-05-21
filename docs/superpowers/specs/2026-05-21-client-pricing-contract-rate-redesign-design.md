# Client Pricing — Contract Rate Entry & Billing Selection Redesign

- **Date:** 2026-05-21
- **Status:** Approved (design) — pending spec review
- **Author:** brainstormed with user
- **Scope:** Full fix — both rate **entry** (PricingManager) and rate **selection** at billing time (`fromContract`/`buildLines`/`auto-fill`).

---

## 1. Problem

Client invoicing bills `(deployment days × contract rate) + (OT hours × contract OT rate) + special-duty + manual lines`. The contract rate is resolved by `fromContract` in `src/lib/invoicing/rates.ts`. That resolver is wrong on four counts, and the rate-entry UI captures the wrong/insufficient data to make a correct resolver possible.

### Billing-selection bugs (`fromContract`)
1. **Branch override is dead code.** It sorts contracts into `candidateIds` (branch-match first) but then queries `clientContractRate.findFirst({ where: { contractId: { in: candidateIds }, ... }, orderBy: [{ isCurrentRate: "desc" }, { rateStartDate: "desc" }] })`. Prisma `in` does not preserve array order, and `orderBy` only ranks by `isCurrentRate`/`rateStartDate`. So the branch-vs-client ranking is discarded — a client-level rate can win over a branch-specific one.
2. **`isCurrentRate` overrides effective dating.** `OR: [{ isCurrentRate: true }, { rateStartDate: { lte: asOf } }]` + `orderBy isCurrentRate desc` means any rate flagged current always wins regardless of `asOf`. Back-dated re-billing picks today's rate; `rateEndDate` is never checked (expired-but-flagged rate still applies); a future-dated current rate would apply to past months.
3. **Region/province ignored.** `fromContract` never filters on `province`/`city`, so it can pick the wrong region's rate.
4. **Wrong selector — keys on `guardType`, ignores `exService`.** It filters `ClientContractRate.guardType === args.guardType` and never filters `exService`. Per business rules `guardType` is display-only; `exService` is a determinant. So it filters on a non-determining field and skips a determining one. Compounding: the deployment aggregation in `buildLines.ts`/`auto-fill` selects `guardType` only — it never pulls `guard.exServiceType`, `guard.isExService`, branch province/city, or client territory/region, so the real inputs are not even captured upstream.

### Entry-UI gaps (`PricingManager.tsx` `AddRateModal`)
- `exService` is a single dropdown with no civilian option; civilian guards cannot be priced.
- `province`/`city` are hand-picked from hardcoded lists, so rate rows are mistagged and drift from the actual branch/region.

---

## 2. Confirmed business rules

1. **`guardType` is display-only** — the guard's designation (GUARD/SUPERVISOR/CPO). It does **not** determine the client rate. Stays on the rate row as a label; never a selection key.
2. **Client pricing is independent of payroll.** What the client is billed (`ClientContractRate`) has no relationship to what the guard is paid. Do not derive billing from pay structure.
3. **exService is the rate determinant** — a yes/no axis (did the guard previously serve?) plus a type when yes.
   - Types are DB-driven via `GuardExServiceType` (`/api/guard-ex-service-types`): ARMY / POLICE / RANGERS / MUJAHID / OTHER.
   - Civilian (no prior service) is stored as the literal `"CIVILIAN"` — a reserved value, never in the type list.
4. **Geography model (corrected):** `Province (operational territory) → Region (city) → RegionalOffice → Branch`.
   - **Province** = operational territory (`Client.operationalProvinces`, a single value: Punjab/Sindh/KPK/…).
   - **Region** = operating **city** (`Region.name`: Lahore/Karachi/…). *(The "Punjab"/"Sindh" values in `api/regions/route.ts` `MOCK_REGIONS` are inaccurate mock placeholders.)*
   - **Branch** carries its own free-text `province` + `city`.
5. **Contract hierarchy:** every client has a **client-level** contract (default, scoped to its region/city) as the always-present fallback. **Branch-level** contracts are an explicit opt-in override for specific branches. Default is behavioral (form defaults to client-level with geo pre-filled) — no auto-provisioning of contracts.

### Geo derivation table

| Contract scope | `province` | `city` |
|---|---|---|
| Branch-specific | `Branch.province` | `Branch.city` |
| Client-level | `Client.operationalProvinces` | `Region.name` (client's operating city) |

---

## 3. Goals / Non-goals

**Goals**
- Rate entry captures exService correctly (yes/no + type, civilian = `"CIVILIAN"`).
- province/city are derived (not hand-picked) and authoritative.
- Billing selects the correct rate by: contract scope (branch overrides client) → exService → province/city → effective date.

**Non-goals**
- No Prisma schema migration — reuse existing `ClientContractRate` columns (`province`, `city`, `guardType`, `exService`, `rate`, `extraHourRate`, `isCurrentRate`, `rateStartDate`, `rateEndDate`).
- No auto-provisioning/backfill of client-level contracts.
- No change to special-duty or manual line handling.
- No change to payroll.

---

## 4. Design

### A. Ex-service entry (`PricingManager.tsx` `AddRateModal`)
Replace the single exService dropdown with:
- An **"Ex-service?" Yes/No** toggle.
- **Yes** → reveal the type dropdown (DB-driven from `/api/guard-ex-service-types`). Stored `exService` = chosen type.
- **No** → hide the type dropdown; stored `exService = "CIVILIAN"`.
- **Editing:** `exService === "CIVILIAN"` → toggle off; any other value → toggle on with type preselected.

The `guardType` dropdown stays (informational label on the rate row).

### B. Auto-derived province/city — server is source of truth
- The modal shows province/city as **read-only derived display** (cosmetic).
- The **rates API derives and stores** province/city itself, ignoring any client-sent values, using the geo derivation table above.
- Requires the rates route to load `contract.branch { province, city }` and `client { operationalProvinces, region { name } }`.
- Contract/rate form defaults to **client-level** (no branch); branch-level is an explicit choice.

### C. Billing selection rewrite
Touches `src/lib/invoicing/rates.ts` (`fromContract`), `src/lib/invoicing/buildLines.ts`, and `src/app/api/invoices/auto-fill/route.ts` (which duplicates the aggregation).

**Inputs to capture upstream** (add to the deployment aggregation `select` and pass through):
- `guard.isExService`, `guard.exServiceType`
- `branch { province, city }` (when `branchId` present)
- `client { operationalProvinces, region { name } }`

**`fromContract` new algorithm**, given `(clientId, branchId, guardId-derived exService inputs, date)`:
1. **exService** = `(guard.isExService && guard.exServiceType && guard.exServiceType !== null) ? guard.exServiceType : "CIVILIAN"`. Also treat `guard.exServiceType === "CIVILIAN"` as civilian. If `isExService === true` but `exServiceType` is missing → return NONE + warning (data gap), do not silently treat as civilian.
2. **Resolve one contract FIRST (step 3), then derive geo from the resolved contract's scope** — not the deployment's branch. If the resolved contract is branch-level → `{ province: branch.province, city: branch.city }`; if client-level → `{ province: client.operationalProvinces, city: client.region.name }`. (Keying geo off the deployment branch is a bug: a branch with no contract falls back to the client-level contract, whose rates carry client geo — so geo must follow the contract that actually won. `resolveContractRateContext` returns the resolved contract's `branchId` to drive this.)
3. **Resolve one contract:** active branch contract where `branchId === deployment.branchId` if it exists; else the active client-level contract (`branchId null`). Query only that contract's rates (eliminates the `in`-pooling).
4. **Select the rate** within that contract where:
   - `exService === resolvedExService`, **and**
   - `province === resolvedProvince`, **and**
   - `rate.city == null || rate.city === resolvedCity`, **and**
   - effective window: `rateStartDate <= date && (rateEndDate == null || rateEndDate >= date)`
   - ordered `rateStartDate desc`; take first.
   - **Fallback:** if no row matches the effective window, fall back to the `isCurrentRate === true` row (matching exService + geo). This makes `isCurrentRate` a last resort, not an override.
5. No match → return `NONE` + warning (existing behavior; surfaces the data gap instead of mis-billing).
6. `guardType` is **not** used in selection.

Return shape (`RateLookup`) unchanged: `{ dailyRate, overtimeHourly, source, note }`.

### D. `isCurrentRate` rescope
In `POST`/`PATCH /api/clients/[id]/contracts/[contractId]/rates`, the "unset other current rates" logic is currently scoped to `(contractId, guardType, exService)`. Rescope to **`(contractId, exService, province, city)`** so "current" means current for that exService + geo, consistent with the new selection key.

### E. Testing
Unit tests for `fromContract`:
- branch contract overrides client-level for the same client
- civilian mapping (`isExService=false` → `"CIVILIAN"`; `exServiceType="CIVILIAN"` → civilian)
- `isExService=true` + null type → NONE + warning
- exService match selects the right row
- effective-date window picks the period-correct rate (incl. back-dated billing)
- `rateEndDate` expiry excludes an expired row
- `isCurrentRate` used only as fallback when no dated row matches
- province/city mismatch → NONE + warning

Plus a `buildLines` test confirming exService + geo inputs flow end-to-end into the selected rate.

---

## 5. Files touched
- `src/components/clients/PricingManager.tsx` — exService toggle, read-only derived province/city, client-level default.
- `src/app/api/clients/[id]/contracts/[contractId]/rates/route.ts` — server-side geo derivation; load contract.branch + client.region/operationalProvinces; rescope isCurrentRate unset.
- `src/lib/invoicing/rates.ts` — `fromContract` rewrite.
- `src/lib/invoicing/buildLines.ts` — capture isExService/exServiceType + branch geo + client geo; pass to `fromContract`.
- `src/app/api/invoices/auto-fill/route.ts` — mirror the buildLines aggregation/selection changes.
- Tests (new) for `fromContract` and `buildLines`.

---

## 6. Edge cases & risks
- **Branch with empty `province`/`city`** (free-text fields): derivation yields null geo → rate may not match → NONE + warning. Acceptable (surfaces a data gap); flag in warnings.
- **Client missing `operationalProvinces` or `region`:** same — NONE + warning rather than silent mis-bill.
- **Branch with no branch-contract (client-level fallback):** geo follows the resolved contract — billing uses the client's `operationalProvinces`/`region.name` (matching how the client-level rate was stored), so the client-level rate matches correctly. (Earlier draft keyed geo off `branch.province`, which broke this common fallback case; fixed to key off the resolved contract scope.)
- **Existing rate rows** authored under the old hand-picked province/city or `guardType`-based scheme may not match the new selection. Out of scope to migrate, but billing will warn rather than mis-bill; re-authoring affected rates is an operational follow-up.
- **`auto-fill` and `buildLines` duplicate logic** — keep them in sync; consider (non-goal here) extracting the shared aggregation later.

---

## 7. Out of scope (tracked separately)
- Auto-provisioning/backfill of default client-level contracts.
- De-duplicating `buildLines` vs `auto-fill` aggregation into one shared function.
- Removing `guardType` from the `ClientContractRate` schema.
