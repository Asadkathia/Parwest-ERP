# Scoped Contract Rates + Province Tier — Design Spec

**Date:** 2026-05-29
**Status:** Draft for review
**Author:** Asad + Claude
**Related:** `project_rate_flows` memory, `docs/audits/*`, migration `20260529120000_client_contract_rate_current_unique` (already in prod)

## 1. Goal

Replace the current implicit (null-pattern) contract-rate scoping with an **explicit 4-tier scope hierarchy** and introduce a real **Province** dimension, so client billing rates are resolved by *most-specific scope* deterministically.

The four scopes, most-specific wins:

| Scope | Applies to | Keyed on | Created from |
|---|---|---|---|
| **Branch** | one specific branch | `branchId` | Branches page (branch contract) |
| **Region** (= city) | all client branches in that region | `regionId` (Region entity) | Client page (client contract) |
| **Province** | all client branches in that province | `province` (new enum) | Client page |
| **Global** | all client branches, system-wide | client only (no target) | Client page |

## 2. Decisions locked during brainstorming

1. **Rate amount is manual** — typed per row, never computed/derived. (Client billing is static; guard *payroll* stays dynamic from deployments — the two flows never mix. See `project_rate_flows`.)
2. **Billing is deployment-driven** — each actually-deployed guard is billed `days/coverage × resolved scoped rate` (+ overtime via `extraHourRate`). The scoped rate supplies the *value*; the *count* comes from real deployments.
3. **Most-specific scope wins** — Branch → Region → Province → Global fallback.
4. **Rates stay under `ClientContract`** — client-level contracts (created from the client page) carry Region/Province/Global rates; branch-specific contracts (`ClientContract.branchId` set, created from the branches page) carry Branch rates.
5. **`guardType` is a decorative label** — already display-only in `selectContractRate`; this work aligns the DB index to match (drops `guardType` from the rate identity).

### Decisions

- **D1 — RESOLVED: ex-service is decorative.** Rate identity = **scope only**. `exService` (and `guardType`) are optional display labels, never selection keys, never in the unique index. The ex-service premium is intentionally gone from billing.
- **D2 — RESOLVED: branch rates are per-guard; higher scopes are singular.** A branch can hold **multiple branch-level rows — one per guard** (each guard its own manually-entered rate). Region / Province / Global each hold a **single** standard rate, used as fallback for guards without their own branch row. This removes the ambiguity: a deployed guard maps to *their own* branch row, else falls back up the scope chain.

### Resolution tiers (most-specific first)

1. **Branch + this guard** — the guard's own per-guard branch rate (`scopeLevel=BRANCH`, `scopeBranchId` + `scopeGuardId` set).
2. **Region** — `scopeRegionId` (singular per client).
3. **Province** — `scopeProvince` (singular per client).
4. **Global** — client only (singular per client).

(If a generic branch-wide rate with no `scopeGuardId` is ever needed, it sits between tiers 1 and 2; not required by the current model.)

## 3. Province introduction (Approach A — enum on Region)

Today the geo hierarchy is `RegionalOffice → Region(city)`; province exists only as free-text (`Branch.province`, `Client.operationalProvinces`). Introduce Province as the **top tier**, tagged once per Region, with branch/client province **derived**.

- Add a `Province` enum (Pakistan): `PUNJAB`, `SINDH`, `KPK`, `BALOCHISTAN`, `ICT`, `AJK`, `GILGIT_BALTISTAN`.
- Add `Region.province Province?` (each city belongs to one province).
- A deployment's province = its branch's region's province (`branch → region → province`). Region of a branch is derived via the existing `cityForBranch`/region path (`regionalOffice → region`, fallback `client.region`); we add the province lookup on top of that resolved Region.
- **Backfill:** map each existing `Region` row → its province (a short one-time lookup; there are only a handful of cities). Stop relying on free-text `Branch.province` / `Client.operationalProvinces` for billing; keep them only as a display cache (or drop later).

Rationale: provinces are a fixed national set → an enum prevents typos/duplicates with no CRUD, and the Region→Province link becomes the single source of truth, making province-scope matching exact.

## 4. Scoped rate model (Approach 1 — evolve `ClientContractRate`)

Add explicit scope columns; demote labels; replace the index.

```
model ClientContractRate {
  id            String
  contractId    String          // unchanged — rates hang off ClientContract
  contract      ClientContract  @relation(...)

  // NEW — explicit scope (discriminated):
  scopeLevel    RateScopeLevel              // BRANCH | REGION | PROVINCE | GLOBAL
  scopeBranchId String?                     // set iff BRANCH
  scopeGuardId  String?                     // set iff BRANCH and per-guard (the common case)
  scopeRegionId String?                     // set iff REGION
  scopeProvince Province?                   // set iff PROVINCE
  // GLOBAL → all scope targets null

  rate          Float                       // manual
  extraHourRate Float?                      // manual overtime

  // DEMOTED to optional descriptive labels (NOT identity, NOT selection keys):
  guardType     String?
  exService     String?                     // pending D1

  isCurrentRate Boolean @default(false)
  rateStartDate DateTime?
  rateEndDate   DateTime?
  createdAt / updatedAt
}

enum RateScopeLevel { BRANCH REGION PROVINCE GLOBAL }
```

- **Retire** the old `province` / `city` string columns (migrated into `scopeProvince` / `scopeRegionId`).
- **Validation:** exactly one of the scope targets is set per `scopeLevel` (CHECK or app-level); `BRANCH`/`REGION` rates must belong to a contract whose client owns that branch/region.

### Index change (replaces the already-shipped one)

The prod index `ClientContractRate_current_combo_key` keys on `{contractId, province, city, guardType, exService}`. Replace with a partial unique index on the explicit scope identity:

```sql
DROP INDEX "ClientContractRate_current_combo_key";
CREATE UNIQUE INDEX "ClientContractRate_current_scope_key"
  ON "ClientContractRate" (
    "contractId", "scopeLevel",
    COALESCE("scopeBranchId",''), COALESCE("scopeGuardId",''),
    COALESCE("scopeRegionId",''), COALESCE("scopeProvince"::text,'')
  )
  WHERE "isCurrentRate" = true;
```

## 5. Rate resolution (rewrite `selectContractRate`)

Replace latest-date selection with **most-specific scope** resolution. For a deployment, resolve the branch's `{branchId, regionId, province}`, then:

```
for tier in [ BRANCH+guard(branchId,guardId), REGION(regionId),
              PROVINCE(province), GLOBAL ]:
    candidates = currentRates(client) where scope matches tier
                 AND effective window covers the invoice month
    if candidates: return the one (one-current invariant guarantees ≤1)
return null  // no rate → skip guard with warning (unchanged behaviour)
```

- Resolution is **client-wide** across the client's contracts (branch contract + client contract), picking the most specific scope, not the latest date.
- `asOf` per-deployment-day resolution is a follow-up (current code uses the latest deployment date; out of scope here, noted as a known limitation).

## 6. Invoicing integration

**Invoices are monthly** (period = one calendar month), generated/accrued monthly — *not* per-day like payroll. The **contract's scoped rates calculate the invoice**: for each guard deployed in the month, the resolver (§5) picks that guard's rate, and the line = `monthly quantity × rate` (+ overtime). `buildInvoiceLines` / `resolveContractRateContext` keep their structure; only the **rate-selection call** swaps to the new per-guard scope resolver, and resolution runs **per deployed guard** (because branch rates are per-guard). No change to advance/tax/finalize logic. Dedup the `auto-fill` route's inline copy to use the shared builder (carried from the prior review's open item).

**ASSUMPTION (confirm in review):** the manual rate is applied against the guard's **monthly quantity** — i.e. days deployed in the month × a daily rate (current behaviour). If instead the manual rate is a **flat monthly charge per guard** (regardless of exact days), the line becomes `1 × rate` prorated by deployment days. Defaulting to days × rate to match today; flag if it should be flat-monthly.

## 7. UI / creation flows

- **Branches page** → "Add/Edit branch contract": scope fixed to `BRANCH` for that branch; enter rate + extraHourRate (+ optional labels).
- **Client page** → "Add/Edit client contract": scope picker `REGION | PROVINCE | GLOBAL`; Region picker (client's regions), Province picker (enum), or Global; enter rate.
- Both reuse the hardened rate-entry route with the new scope payload; demote-before-create + `P2002 → 409` logic retained, re-keyed to scope.
- Guard-type dropdown still fetched from the system guard-type list (label only).

## 8. Migration plan (ordered)

All against prod Neon (tiny data: 7 rate rows). Each step its own migration where DB-affecting.

1. **Province enum + `Region.province`** column; backfill region→province map.
2. **`RateScopeLevel` enum + scope columns** on `ClientContractRate` (nullable initially).
3. **Data migration** of the 7 existing rows: map `(province,city)` → `scopeLevel`+target (city set → REGION by matching Region.name; province-only → PROVINCE; both null → GLOBAL; rates on a branch-scoped contract → BRANCH via `contract.branchId`).
4. **Make `scopeLevel` non-null**, add CHECK that exactly one target matches the level.
5. **Swap the index** (drop `_current_combo_key`, create `_current_scope_key`).
6. **Drop** legacy `province`/`city` columns (after code no longer reads them).
7. App deploy: new selector + UI + validation must ship **before/with** the index swap so behaviour matches the constraint.

## 9. Reconciliation with already-shipped work

- The prod index `ClientContractRate_current_combo_key` (applied 2026-05-29) is **superseded** by step 5; the demote-before-create logic stays, re-keyed to scope.
- `guardType` drops from identity (matches the selector's existing display-only treatment) — resolves the review's "index vs selector disagree" finding in the *opposite* direction we first guessed.

## 10. Testing & parity

- Unit tests for the scope resolver: each tier hit + fallthrough + no-match (skip).
- Province backfill verification (every Region has a province).
- **Parity check:** re-bill a recent month before/after and diff totals (no silent change beyond the intended ex-service/most-specific behaviour shifts).
- Migration dry-run via the read-only inspector pattern (`scripts/inspect-dup-current-rates.mjs`).

## 11. Out of scope

- Per-deployment-day rate resolution (keep current `asOf` = latest deployment date).
- Cross-client / company-wide global rates (global = per-client only).
- First-class bill-vs-pay margin model (separate effort).
- Invoice Prerequisites / client-portal visibility (already-declared non-goals).

## 12. Risks

- **D1 (ex-service) behaviour change** — if confirmed, billing amounts shift for ex-service guards; parity check must distinguish intended vs accidental change.
- **Region→Province backfill accuracy** — a mis-mapped city sends every province-scope lookup wrong; verify the full map.
- **Ordering** — index swap before app deploy would reject valid writes; deploy app first.
