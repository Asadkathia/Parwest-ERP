# Two Contract Types (Manual & Dynamic) + Scoped Rates + Province Tier — Design Spec

**Date:** 2026-05-29 (rev 2026-05-30)
**Status:** Draft for review
**Related:** `project_rate_flows` memory, migration `20260529120000_client_contract_rate_current_unique` (in prod)

## 1. Goal (plain terms)

A client's billing can work two ways, so the contract gets a **type**:

- **Manual** — *like the system works today.* You set up a contract and type in the rates yourself (now with proper location levels). You stay in control of the numbers.
- **Dynamic** — *fully automatic.* The system pulls the client's enrolled guards, you only type each guard's rate, and the monthly invoice builds itself from how many days each guard actually worked.

Both produce **monthly** invoices. The contract carries a `billingMode = MANUAL | DYNAMIC`.

## 2. The two types

### MANUAL (like current, + location levels)
- Built on today's `ClientContract` + `ClientContractRate` (reuse, don't reinvent).
- Rates are **manually typed**; `guardType` / `exService` are **decorative labels** (never change or select a rate).
- Adds an explicit **4-tier location scope**, most-specific wins:

  | Tier | Applies to | Keyed on | Entered from |
  |---|---|---|---|
  | **Branch** | one branch | `branchId` | Branches page |
  | **Region** (=city) | all client branches in that region | `regionId` | Client page |
  | **Province** | all client branches in that province | `province` (new enum) | Client page |
  | **Global** | whole client | client only | Client page |

- Invoicing for a deployed guard resolves down the chain **Branch → Region → Province → Global** (first hit wins) and bills using that rate. This keeps the current day-based calculation (`days × rate` + overtime) but with deterministic, most-specific scope selection instead of today's recency-based pick.

### DYNAMIC (fully automatic)
- The contract has **no manual scope rows**. Instead:
  1. System **fetches the client's enrolled/deployed guards**.
  2. User enters **only each guard's rate** (per-guard).
  3. The monthly invoice **auto-generates**: for each guard, `deployment days in the month × that guard's rate` (+ overtime), summed. Everything except the rate is computed.
- This is the current day-based engine, made fully hands-off and per-guard.

## 3. Decisions locked

- **D1** — `exService` + `guardType` are **decorative labels** in MANUAL; not in the rate identity or the unique index.
- **D2** — MANUAL uses **scoped standard rates** (branch/region/province/global, one current each). Per-guard rates live in **DYNAMIC** (one rate per enrolled guard).
- **Billing period** — monthly for both. Payroll stays separate/dynamic (`project_rate_flows`).
- **D3 — RESOLVED: both types are day-based.** Bill = `deployment days in month × rate` (+ overtime) for BOTH. Rates are **daily**. The difference is *only* where the rate comes from: MANUAL = scoped standard rate (branch/region/province/global, most-specific wins); DYNAMIC = that guard's own per-guard rate. "Manual" = you set the rates/scope, not that days are ignored.

## 4. Province introduction (enum on Region)

Today: `RegionalOffice → Region(city)`, province is free-text only. Add Province as the top tier:
- `Province` enum (PUNJAB, SINDH, KPK, BALOCHISTAN, ICT, AJK, GILGIT_BALTISTAN).
- `Region.province Province?` — tag each city's province once; backfill the handful of existing regions.
- A branch's province is **derived** (`branch → region → province`). Stop using free-text `Branch.province` for billing.
- Needed only for MANUAL's Province tier; exact matching, no string drift.

## 5. Schema

```
model ClientContract {
  ...
  billingMode  BillingMode  @default(MANUAL)   // NEW: MANUAL | DYNAMIC
  // branchId? unchanged (client-level vs branch-level)
}
enum BillingMode { MANUAL DYNAMIC }

model ClientContractRate {          // MANUAL rows (scoped standard rates)
  id, contractId
  scopeLevel    RateScopeLevel      // BRANCH | REGION | PROVINCE | GLOBAL
  scopeBranchId String?
  scopeRegionId String?
  scopeProvince Province?
  rate          Float               // manual
  extraHourRate Float?
  guardType     String?             // decorative label
  exService     String?             // decorative label
  isCurrentRate Boolean
  rateStartDate / rateEndDate / timestamps
}
enum RateScopeLevel { BRANCH REGION PROVINCE GLOBAL }

model ContractGuardRate {           // DYNAMIC rows (one per enrolled guard) — NEW
  id, contractId
  guardId       String              // the enrolled guard
  rate          Float               // manual (daily)
  extraHourRate Float?
  isCurrentRate Boolean
  effective dates / timestamps
  @@unique([contractId, guardId])   // one current rate per guard per contract
}
```

- Retire old `province`/`city` string columns on `ClientContractRate` (migrate into scope columns).
- **Index swap:** drop the shipped `{contractId,province,city,guardType,exService}` partial-unique; add partial-unique on `{contractId, scopeLevel, scopeBranchId, scopeRegionId, scopeProvince}` WHERE `isCurrentRate` (COALESCE nullable cols). DYNAMIC uses the `@@unique([contractId, guardId])` above.

## 6. Resolution & invoicing

- **MANUAL:** per deployed guard, resolve most-specific scope (Branch→Region→Province→Global) for the client/branch, as of the invoice month; bill `days × rate` + overtime. Rewrite `selectContractRate` from recency-based to scope-specificity-based.
- **DYNAMIC:** per enrolled guard, use that guard's `ContractGuardRate`; bill `days × rate` + overtime.
- Both feed the existing monthly `buildInvoiceLines` / `generate-monthly` / accrual paths — only the rate-lookup differs by `billingMode`. Dedup the `auto-fill` inline copy (prior review item).

## 7. UI

- **Branches page** → branch contracts (MANUAL branch-scope rows).
- **Client page** → client contracts; choose `billingMode`:
  - MANUAL → scope picker (Region / Province / Global) + manual rate.
  - DYNAMIC → list of enrolled guards, a rate field per guard.
- Guard-type dropdown still from the system list (label only). Demote-before-create + `P2002 → 409` retained, re-keyed.

## 8. Migration plan (ordered; ~7 rate rows in prod)

1. `Province` enum + `Region.province`; backfill region→province.
2. `BillingMode` enum + `ClientContract.billingMode` (default MANUAL — existing contracts stay manual).
3. `RateScopeLevel` + scope columns on `ClientContractRate`; new `ContractGuardRate` table.
4. Migrate the 7 existing rows → MANUAL scope rows (city→REGION by Region.name; province-only→PROVINCE; both null→GLOBAL; branch-contract rows→BRANCH).
5. Make `scopeLevel` non-null + CHECK exactly-one-target; swap the index.
6. Drop legacy `province`/`city` columns.
7. App deploys (new resolver, UI, validation) **before** the index swap.

## 9. Reconciliation with shipped work

- The prod index `..._current_combo_key` (applied 2026-05-29) is **superseded** by the scope index; demote-before-create logic stays, re-keyed.
- `guardType` leaves the identity (matches the selector's existing display-only treatment).

## 10. Testing

- Unit tests: MANUAL scope resolver (each tier + fallthrough + no-match skip); DYNAMIC per-guard lookup.
- Province backfill verification (every Region has a province).
- Parity: re-bill a recent month before/after; diff totals; isolate intended changes (scope-specificity, ex-service-now-label).
- Read-only migration dry-run (`scripts/inspect-dup-current-rates.mjs` pattern).

## 11. Out of scope / risks

- Per-deployment-day rate changes within a month (keep `asOf` = month/latest).
- Cross-client global rates (global = per-client).
- Margin model; Invoice Prerequisites; portal visibility (non-goals).
- **Risk:** Region→Province backfill accuracy; index-swap ordering (deploy app first); MANUAL day-calc assumption (§3) must be confirmed.
