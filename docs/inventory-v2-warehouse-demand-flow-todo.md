# Inventory V2 Warehouse + Demand Flow TODO

Last Updated: 2026-03-26
Status Legend: `todo` | `in_progress` | `blocked` | `done`

## Scope
Implement staging-aligned flow in V2:
- Store/Warehouse separation
- Demand send: Store -> Warehouse only
- Demand response actions: Allocate, Add Transport, Confirm Receive
- Lifecycle visibility: Pending -> Checked Out -> In Transit -> Completed
- Partial fulfillment and shortfall tracking
- Inventory quantity presentation (available/reusable/issued and shortfall context)

## Task Board
- [x] `INV-FLOW-001` **(done)** Audit current V2 demand + inventory code paths
  - Acceptance: Gaps listed with impacted files and API routes.
  - Completed: 2026-03-26

- [x] `INV-FLOW-002` **(done)** Add response metadata model (transport/receive/allocation) in API layer (non-destructive)
  - Acceptance: Metadata persisted/retrieved without schema-destructive changes.
  - Completed: 2026-03-26

- [x] `INV-FLOW-003` **(done)** Implement `Add Transport` API for demand responses
  - Acceptance: Transport details saved against selected response.
  - Completed: 2026-03-26

- [x] `INV-FLOW-004` **(done)** Implement `Confirm Receive` API for demand responses
  - Acceptance: Receiving store balances increment, movement logs written, lifecycle updated.
  - Completed: 2026-03-26

- [x] `INV-FLOW-005` **(done)** Upgrade response allocation API behavior
  - Acceptance: Allocation supports per-line quantities and partial allocation with remarks.
  - Completed: 2026-03-26

- [x] `INV-FLOW-006` **(done)** Upgrade `DemandsManager` UI for response workflow
  - Acceptance: Actions visible by state: Allocate / Add Transport / Confirm Receive / View details.
  - Completed: 2026-03-26

- [x] `INV-FLOW-007` **(done)** Add lifecycle + shortfall calculations in UI
  - Acceptance: Requested/Fulfilled/Received/Shortfall totals shown consistently.
  - Completed: 2026-03-26

- [x] `INV-FLOW-008` **(done)** Upgrade inventory list columns for flow parity
  - Acceptance: Inventory table shows staging-relevant quantity semantics.
  - Completed: 2026-03-26

- [ ] `INV-FLOW-009` **(todo)** Verify store/warehouse creation UX and validations
  - Acceptance: Type toggle + region-aware code behavior works end-to-end.

- [x] `INV-FLOW-010` **(done)** Run local quality checks + smoke tests
  - Acceptance: Build/test targets pass and key flows manually verified.
  - Completed: 2026-03-26 (TypeScript + next build)

- [ ] `INV-FLOW-011` **(todo)** Update documentation with implemented behavior
  - Acceptance: SoT docs updated with exact API/UI flow details.

- [x] `INV-FLOW-012` **(done)** Align purchase regular receiving wizard with staging lifecycle context
  - Acceptance: Receiving wizard shows requested/received/remaining per line, transport fields by type, and blocks over-receive at UI level.
  - Completed: 2026-03-26

- [x] `INV-FLOW-013` **(done)** Complete purchases list/detail parity fields
  - Acceptance: Purchases list includes Confirmed/Rejected By, Confirmed/Rejected At, Reject Reason, and Note; detail page includes PO metadata and status summary.
  - Completed: 2026-03-26

- [x] `INV-FLOW-014` **(done)** Complete vendors workflow field validation parity
  - Acceptance: Vendor create/update enforces company phone, contact person name/phone, and address to match staging-required form behavior.
  - Completed: 2026-03-26

- [x] `INV-FLOW-015` **(done)** Split weapon purchases/assignments into dedicated weapon-only operations
  - Acceptance: Weapon menu exposes separate purchases + guard/employee/client assignment flows; regular modules remain non-weapon; APIs enforce scope.
  - Completed: 2026-03-26

- [x] `INV-FLOW-016` **(done)** Extend weapon restrictions to include ammo category
  - Acceptance: Ammo follows same restrictions as weapons across regular purchases, assignments, demands, and inventory listing.
  - Completed: 2026-03-26

- [x] `INV-FLOW-017` **(done)** Add Weapon Operations inventory pages
  - Acceptance: Separate Weapon Inventory and Ammo Inventory pages available under Weapon Operations menu.
  - Completed: 2026-03-26

- [x] `INV-FLOW-018` **(done)** Add Weapon Operations adjustments flow
  - Acceptance: Weapon Adjustments and Create Weapon Adjustment routes available; adjustments API supports scoped weapon/ammo adjustments.
  - Completed: 2026-03-26

- [x] `INV-FLOW-019` **(done)** Redesign adjustments wizard to staging-style product table
  - Acceptance: Adjustment create flow includes per-line product stock context, condition, action (addition/subtraction), qty, totals, and note.
  - Completed: 2026-03-26

## Progress Log
- 2026-03-26: Tracker created.
- 2026-03-26: Purchase regular receiving wizard upgraded with per-line received/remaining visibility and transport type conditional fields (self/courier) for staging-aligned flow.
- 2026-03-26: Purchases list/detail parity fields finalized (confirmed/rejected metadata, reject reason, note, and PO metadata summary).
- 2026-03-26: Vendor module validation aligned to staging-required fields (company phone, contact person name/phone, address).
- 2026-03-26: Added weapon-scoped operation routes and sidebar entries (weapon purchases + weapon guard/employee/client assignments) with API-level category scope enforcement.
- 2026-03-26: Ammo category aligned to weapon restrictions; non-weapon flows now exclude both weapon and ammo.
- 2026-03-26: Added Weapon Inventory + Ammo Inventory pages under Weapon Operations.
- 2026-03-26: Added Weapon Adjustment routes and redesigned adjustment wizard with staging-like table/action flow.
