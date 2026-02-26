# ERP Delivery Source of Truth Checklist

Last updated: 2026-02-26  
Execution policy: **Core operational modules first**, Reports last, Mock mode separate from Real DB mode.

## Runtime Contract

- [x] Real DB is default mode.
- [x] Mock mode is explicit opt-in only (`USE_MOCKS=true` and optionally `NEXT_PUBLIC_USE_MOCKS=true`).
- [x] App fails fast if mock is off and `DATABASE_URL` is missing.

## Current Validation Baseline

- [x] `npm run build` passes.
- [x] `npx tsc --noEmit` is clean in this workspace.
- [x] Integration script pass recorded: **61/61 PASS** (includes manager-scope payroll access tests).

## Delivery Order (Locked)

1. Users & Access + RBAC hardening
2. Guards + Deployments
3. Clients
4. Payroll
5. Inventory
6. Imports
7. Reports (last)

## Module Completion Gates (applies to every core module)

A module is only marked complete when all are true:

- [ ] Backend: CRUD/read/action APIs complete for required workflows.
- [ ] Frontend: no placeholder/config-only screen remains for that module’s production flow.
- [ ] Data: no direct mock-only dependency in production path.
- [ ] Security: role/scope checks enforced server-side where applicable.
- [ ] Quality: integration tests for happy path + error paths (400/401/404/409).
- [ ] Build/type gates pass after module changes.

## Core Modules Tracker

### 1) Users & Access (Priority: P0)

Status: **In progress**

- [x] Users CRUD/search APIs + UI integration.
- [x] Roles + permissions APIs + UI integration.
- [x] M/S, C/S, switch-supervisor APIs + UI integration.
- [~] Enforce server-side Manager regional/office scope on all affected APIs (partially applied to guards/deployments/clients).
- [~] Add integration tests for manager-scoped access (positive + negative).
  - [x] Payroll manager-scope positive/negative tests (loans list/create/update).
  - [ ] Guards/deployments manager-scope tests.
- [ ] Add audit events for user/relationship mutating actions where missing.

### 2) Guards + Deployments (Priority: P0)

Status: **In progress**

- [x] Base APIs exist (`/api/guards*`, `/api/deployments*`, attendance/trainings/residences).
- [~] Manager scope enforcement applied on core routes:
  - [x] `/api/guards`, `/api/guards/search`, `/api/guards/[id]`, `/api/guards/[id]/status`
  - [x] `/api/deployments`, `/api/deployments/[id]`, `/api/deployments/[id]/end`
  - [x] `/api/clients`, `/api/clients/[id]` (region-based)
  - [x] payroll endpoints (manager scope enforced)
- [ ] Validate and finish all legacy-critical workflow actions against real DB:
  - [ ] guard enrollment/edit/update status
  - [ ] deployment create/update/end lifecycle
  - [ ] attendance + client attendance edge paths
  - [ ] blacklist/inactive transitions
  - [ ] docs checklist + emergency pool behavior on DB-backed records
- [ ] Remove remaining production-path mock fallbacks for guard/deployment screens.
- [ ] Add integration tests for full Guard->Deployment->Attendance lifecycle.

### 3) Clients (Priority: P0)

Status: **In progress**

- [x] Base APIs exist (`/api/clients*`, `/api/branches*`).
- [ ] Complete backend parity for client profile tabs and branch workflows:
  - [ ] branch/branchless transitions
  - [ ] branch type handling (Islamic/Conventional)
  - [ ] client billing prerequisites and invoicing dependencies
- [ ] Ensure client detail/profile pages are fully DB-backed (no production mock leakage).
- [ ] Add integration tests for client + branch + invoicing prerequisites flow.

### 4) Payroll (Priority: P1)

Status: **In progress (strong)**

- [x] Loans, extra-hours, other-deductions, special-duty, salary-v2, unpaid APIs + UI.
- [x] Holidays API + UI.
- [ ] Harden payroll calculations/posting logic parity with legacy workflows.
- [ ] Add end-to-end payroll cycle validations (month, approvals/posting, exports dependencies).
- [ ] Add integration tests for payroll calculation consistency and state transitions.

### 5) Inventory (Priority: P1)

Status: **In progress (strong)**

- [x] Categories/vendors/conditions/items/assignments/demand APIs + UI.
- [x] Stock-in/search/assign/condemned flows wired.
- [ ] Add stronger integrity checks:
  - [ ] assignment/return lifecycle validation
  - [ ] demand approval/fulfillment transitions
  - [ ] condition usage constraints and conflict behavior
- [ ] Add integration tests for full inventory lifecycle.

### 6) Imports (Priority: P1)

Status: **Not started (backend)**

- [ ] Build import APIs (validate/process/result logs) for users, guards, clients, inventory.
- [ ] Add job status tracking and error report download response shape.
- [ ] Wire import screens to backend instead of placeholders.
- [ ] Add integration tests for import validation failures and successful processing.

## Deferred Until Core Complete

### 7) Reports (Priority: Deferred / Last)

- [ ] Build dedicated operational/generated report APIs.
- [ ] Integrate report screens with real data endpoints.
- [ ] Validate report correctness after core module data integrity is stable.

### Fingerprint Device (System)

- [ ] Build backend APIs and persistence model.
- [ ] Integrate settings screen with real API.

## Current Sprint Plan (Main Modules First)

### Sprint M1 (start now)

Focus: **Users & Access RBAC hardening + Guards/Deployments lifecycle completion**

- [ ] Implement server-side manager scope helper and apply to:
  - [x] `/api/guards*`
  - [x] `/api/deployments*`
  - [x] `/api/clients*` (where manager filtering is required)
  - [x] payroll endpoints with manager-visible scope
- [~] Add automated integration tests for manager-scope restrictions.
  - [x] Added manager-scope tests in `scripts/api-integration-test.mjs` for payroll loan routes.
  - [ ] Expand manager-scope test assertions to guards/deployments APIs.
- [ ] Close guard/deployment lifecycle gaps and verify no runtime data-shape errors.

Exit criteria for M1:

- [x] Manager scope enforced server-side for core endpoints.
- [ ] Guard+Deployment lifecycle tests pass.
- [ ] No P1/P2 defects open in Users/Access + Guards/Deployments.

### Sprint M2

Focus: **Clients + Payroll hardening**

- [ ] Complete client branch/group/branchless transitions and billing prerequisites flow.
- [ ] Complete payroll calculation/posting consistency checks.
- [ ] Expand integration test coverage for these flows.

### Sprint M3

Focus: **Inventory hardening + Imports backend**

- [ ] Finalize inventory lifecycle constraints and test coverage.
- [ ] Build imports backend and replace placeholder flows.

## Known Open Risks

- [ ] Manager scope not fully enforced server-side yet (security + data leakage risk).
- [ ] Some screens still rely on placeholder/config patterns outside completed module paths.
- [ ] Imports and Reports backend are pending; must not block core ops stabilization.

## Progress Log

- 2026-02-24: Core plan locked to module-first delivery, Reports deferred to last.
- 2026-02-24: Batch A closure completed (holidays, inventory conditions/demand, guard bank/doc settings).
- 2026-02-24: Integration baseline recorded at 52/52 PASS.
- 2026-02-24: Sprint M1 started and partially completed:
  - Added reusable manager scope helpers in `src/lib/access/scope.ts` (`buildManagerScopeWhere`, `managerScopeDenied`).
  - Extended auth typings for `regionId`/`regionalOfficeId` in `src/types/next-auth.d.ts`.
  - Enforced manager server-side scope on core APIs:
    - Guards: list/search/update/status endpoints
    - Deployments: list/create/update/end endpoints
    - Clients: list/create/update endpoints (region scope)
  - Build validation: `npm run build` passes.
- 2026-02-26: Guard module change request implementation:
  - [x] Add Guard form: moved Regional Office to top and removed Region field.
  - [x] Deploy Guards: removed Region selection and switched guard filtering to Regional Office.
  - [x] Add Guard form: added multiple contact numbers with add/remove controls.
  - [x] Add Guard form: age auto-calculation from Date of Birth and joining-age auto-calculation from Joining Date.
  - [x] Guard profile general information: added Manager, Joining Age, Enrolled By, Profile Introducer, and Nearest Relative details.
  - [x] Blacklist flow updated to block by CNIC.
  - [x] Inactive Guard reactivation now requires mandatory reason (UI + API enforcement).
  - [x] Payroll net salary now recalculates when extra hours/special duty/other deductions are updated.
- 2026-02-26: Users/Access M1 hardening continued:
  - [x] Applied manager scope enforcement to payroll endpoints:
    - `/api/payroll/loans` and `/api/payroll/loans/[id]`
    - `/api/payroll/extra-hours` and `/api/payroll/extra-hours/[id]`
    - `/api/payroll/other-deductions` and `/api/payroll/other-deductions/[id]`
    - `/api/payroll/special-duty`
    - `/api/payroll/salary` and `/api/payroll/salary/[id]`
    - `/api/payroll/unpaid`
  - [x] Local quality gates re-run: `npx tsc --noEmit`, `npm run build`.
- 2026-02-26: Manager-scope integration tests added and validated:
  - [x] Extended `scripts/api-integration-test.mjs` with manager positive/negative payroll scope assertions:
    - out-of-scope manager denied on `/api/payroll/loans` POST and `/api/payroll/loans/[id]` PATCH
    - out-of-scope manager list filtering verified on `/api/payroll/loans` GET
    - in-scope manager allowed on `/api/payroll/loans` POST/PATCH and can view scoped list
  - [x] Integration baseline updated to **61/61 PASS**.
- 2026-02-26: Guard enrollment backend hardening:
  - [x] Fixed auto-generated `parwestId` collisions in `POST /api/guards`.
  - [x] Added explicit duplicate-CNIC pre-check in guard creation flow.
