# Deep Adversarial QA — Lifecycle & Financial Engines

**Date:** 2026-06-03
**Status:** Approved (brainstorming) → executing

## Goal

Go beyond surface/required-field validation (already covered for Guards + Clients) and
find **real** bugs in the lifecycle/financial core along three angles:

1. **State machines & lifecycles** — invalid/edge transitions, stuck/inconsistent states.
2. **Business invariants & cross-module integrity** — single-source-of-truth rules.
3. **Concurrency & races** — invariant guards under simultaneous mutations.

Across four engines: **Guards lifecycle · Deployments · Payroll+Deductions · Inventory+Invoicing**.

## Method (find → verify → fix loop)

1. **Derive** invariants + transitions + concurrency points from the SoT code:
   `src/lib/guards/lifecycle.ts`, `src/lib/inventory/stock-movement.ts`,
   `src/lib/payroll/calculate.ts`, the payroll state machine + `state/mark-paid`,
   `src/lib/invoicing/rateSelection.ts`, `src/lib/inventory/demand-status-machine.ts`.
2. **Fan out** white-box analysis across **4 parallel sub-agents (one per engine)** —
   each enumerates invariants and predicts concrete bug hypotheses with repro steps.
   Agents reason over code only (no live app access).
3. **Verify live** — every hypothesis is reproduced against the running dev app via the
   authenticated browser session: real concurrency via `Promise.all` of simultaneous
   requests, plus direct DB inspection (pg script) to confirm state corruption. This
   eliminates false positives and catches integration/race bugs static analysis can't.
4. **Triage**: Critical/High → fix inline (review→commit→push). Medium/Low → triaged report.

## Attack map per engine

### Guards lifecycle
- Every transition incl. invalid (e.g. PENDING→INACTIVE returns **500 not 4xx** — already spotted).
- Invariant: active deployment blocks non-revoking transition (`ActiveDeploymentTransitionError`).
- Prereq auto-activation under **concurrent verifies** of the last VERIFICATION doc.
- Terminal-state escapes (TERMINATED → anything).
- CNIC re-enrollment after terminate; active-duplicate block.
- `Guard.status` legacy shadow vs `lifecycleStatus` consistency.

### Deployments
- `singleActivePerGuard` incl. **two simultaneous deploys racing** the guard.
- `requireGuardOfficeConsistency` (deploy a Lahore guard to a Karachi office).
- create/end/**DELETE divergence** (DELETE non-transactional, no audit history).
- Branch-deactivation cascade integrity (deployments INACTIVE + endDate/reason; inventory flagged).
- Contract/supervisor/inventory/verified-prereq gates.

### Payroll + Deductions
- State ↔ paymentStatus lockstep; `salary/[id]` PATCH must not set PAID (sole writer = mark-paid).
- **Manual OTHER deduction durability** across recompute (`isOverride=true` must survive).
- Loan create/edit/finalize → `recalcAffectedMonths`.
- **Concurrent mark-paid** + mark-paid racing a recompute.
- Installment/recovery entries stuck in PENDING (tracker-known).
- `markDeductionsConsumed` stamping on PAID.

### Inventory + Invoicing
- **Stock conservation under concurrent-assignment race** — two assignments draining one
  balance: can `available = onHand − held − issued` go negative / over-issue?
- Avg-cost quantity-weighting on receive; purchase→receive-only stock entry.
- Cross-office assignment guard (the B2 fix).
- Invoicing **one-current-rate per scope** under concurrent rate creates (partial-unique indexes).
- MANUAL/DYNAMIC dispatch; invoice-per-(client,branch,month) idempotency.

## Safety

- Probes operate on **isolated `QA-`prefixed fixtures only** — never real clients/stores/guards.
- Concurrency tests fire real parallel HTTP at the **local dev** server, targeting fixtures only.
- Cleanup is **transactional** and fixture-scoped (DELETE in FK order, BEGIN/COMMIT).
- No hand-editing of real stock balances or financial rows. Nothing touches prod.

## Output

- Inline fixes for Critical/High (standard review→commit→push, each with re-test).
- Final **triaged findings report**: per finding — severity, exact repro (the probe), root
  cause, confirmed evidence (HTTP status + DB state). Medium/Low recorded in
  `project_unresolved_issues` memory for the user's decision.

## Non-goals

- Regional scoping/auth testing (deliberately deprioritized — separate pass).
- UI/visual/a11y testing.
- Load/perf testing (concurrency here is correctness-of-invariants, not throughput).
