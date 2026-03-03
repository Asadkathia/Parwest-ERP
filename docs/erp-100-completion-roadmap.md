# ERP 100% Completion Roadmap

Last updated: 2026-03-03  
Status model: `todo` | `in_progress` | `blocked` | `done`  
Execution model: Evidence-first completion (`[x]` only after proof)

## Document Rules

- Every task must have: ID, owner, status, acceptance criteria, evidence, dates.
- Do not mark done without command and/or file evidence.
- Re-open by changing `[x]` to `[ ]` and appending reason in `Progress Log`.
- This file is the execution checklist for end-to-end ERP completion.

## Global Definition of Done (DoD)

A module is 100% complete only if all are true:

- [ ] Backend APIs complete for required workflows.
- [ ] Frontend production path has no placeholder/config-only behavior.
- [ ] No direct mock dependency in production runtime.
- [ ] RBAC + scope checks enforced server-side where applicable.
- [ ] Audit logging present on all mutating operations.
- [ ] Error contracts validated (`400/401/403/404/409/422/500` as applicable).
- [ ] Integration tests include happy + negative paths.
- [ ] `npm run ci:quality` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:integration:strict-real` passes.
- [ ] Engineering + QA + Product + Ops signoff complete.

## Program Health Dashboard

- [x] Total tasks baseline recorded
- [x] Done count tracked
- [x] Blocked count tracked
- [ ] Module completion % tracked weekly
- [ ] Open P1/P2 defect count tracked

Current snapshot (2026-03-03):
- Total tracked tasks in this roadmap: `69`
- Done: `7`
- In progress: `0`
- Blocked: `1`
- Todo: `61`
- Source-of-truth operational completion: see `docs/delivery-source-of-truth-checklist.md` (`95%`, `18/19` in Operational Validation & Handoff)

---

## A) Cross-Cutting Workstreams

- [ ] ERP-XGT-001 | status:todo | owner:@platform  
  - Objective: Standardize completion gates across all modules.  
  - Acceptance Criteria: Global gate matrix referenced by all module sections.  
  - Evidence Required: Updated sections + gate matrix link.  
  - Started:  
  - Completed:

- [ ] ERP-XGT-002 | status:todo | owner:@backend  
  - Objective: Enforce unified API response envelope across all route handlers.  
  - Acceptance Criteria: No legacy divergent shapes on protected APIs.  
  - Evidence Required: Route audit table + integration assertions.  
  - Started:  
  - Completed:

- [ ] ERP-XGT-003 | status:todo | owner:@backend  
  - Objective: Publish shared API contracts (`ApiSuccess`, `ApiError`, pagination/filter types).  
  - Acceptance Criteria: Shared types consumed by all core modules.  
  - Evidence Required: `src/lib/api/*` references.  
  - Started:  
  - Completed:

- [ ] ERP-XGT-004 | status:in_progress | owner:@frontend  
  - Objective: Remove/guard any remaining mock fallback in production UI flow.  
  - Acceptance Criteria: Runtime-safe “unavailable/error” UX replaces fallback data.  
  - Evidence Required: Page-level audit with file list.  
  - Started: 2026-03-03
  - Completed:

- [ ] ERP-XGT-005 | status:todo | owner:@qa  
  - Objective: Full RBAC/scope matrix verification across sensitive endpoints.  
  - Acceptance Criteria: Out-of-scope denied, in-scope allowed, tested in strict real profile.  
  - Evidence Required: Integration output summary + route mapping.  
  - Started:  
  - Completed:

---

## B) Module Checklists

### 1) Dashboard

- [ ] ERP-DASH-001 | status:todo | owner:@frontend
- [ ] ERP-DASH-002 | status:todo | owner:@backend
- [ ] ERP-DASH-003 | status:todo | owner:@qa

### 2) Guards

- [ ] ERP-GRD-001 | status:todo | owner:@backend
- [ ] ERP-GRD-002 | status:todo | owner:@frontend
- [ ] ERP-GRD-003 | status:todo | owner:@qa
- [x] ERP-GRD-004 | status:done | owner:@frontend
  - Objective: Add explicit guard profile picture placeholder state.
  - Evidence Required: `src/components/guards/ProfileImageCard.tsx`, `npm run ci:quality`.
  - Started: 2026-03-02
  - Completed: 2026-03-02
- [x] ERP-GRD-005 | status:done | owner:@frontend
  - Objective: Show guard image/placeholder on guards listing and search result screens.
  - Evidence Required: `src/components/guards/GuardAvatar.tsx`, `src/app/(dashboard)/guards/page.tsx`, `src/app/(dashboard)/guards/search/manager.tsx`, `npm run ci:quality`.
  - Started: 2026-03-02
  - Completed: 2026-03-02
- [x] ERP-GRD-006 | status:done | owner:@frontend
  - Objective: Remove passport-related inputs from add guard workflow and related extraction labels.
  - Evidence Required: `src/app/(dashboard)/guards/new/form.tsx`, `src/lib/mockData/ocr.ts`, `npm run ci:quality`.
  - Started: 2026-03-02
  - Completed: 2026-03-02
- [x] ERP-GRD-007 | status:done | owner:@frontend
  - Objective: Remove guard detail page mock-profile fallback dependency from production path.
  - Evidence Required: `src/app/(dashboard)/guards/[id]/page.tsx`, `npm run ci:quality`.
  - Started: 2026-03-03
  - Completed: 2026-03-03
- [x] ERP-GRD-008 | status:done | owner:@frontend
  - Objective: Remove emergency guard pool page dependency on mock dataset and source it from DB-derived guard data.
  - Evidence Required: `src/lib/guards/emergency.ts`, `src/app/(dashboard)/guards/emergency/page.tsx`, `src/components/guards/EmergencyGuardTable.tsx`, `npm run ci:quality`.
  - Started: 2026-03-03
  - Completed: 2026-03-03

### 3) Deployments + Attendance

- [ ] ERP-DEP-001 | status:todo | owner:@backend
- [ ] ERP-DEP-002 | status:todo | owner:@frontend
- [ ] ERP-DEP-003 | status:todo | owner:@qa

### 4) Clients + Branches + Billing

- [ ] ERP-CLI-100 | status:todo | owner:@backend
- [ ] ERP-CLI-101 | status:todo | owner:@frontend
- [ ] ERP-CLI-102 | status:todo | owner:@qa
- [x] ERP-CLI-103 | status:done | owner:@backend
  - Objective: Nested branch-create API parity + branch mutation audit logging hardening.
  - Evidence Required: `src/app/api/clients/[id]/branches/route.ts`, `src/app/api/branches/route.ts`, `src/app/api/branches/[id]/route.ts`, integration `213/213 PASS`.
  - Started: 2026-03-02
  - Completed: 2026-03-02
- [x] ERP-CLI-104 | status:done | owner:@frontend
  - Objective: Add separate branch/branchless client add selection buttons and preselected add flow.
  - Evidence Required: `src/app/(dashboard)/clients/page.tsx`, `src/app/(dashboard)/clients/new/page.tsx`, `src/app/(dashboard)/clients/new/form.tsx`, `npm run ci:quality`.
  - Started: 2026-03-02
  - Completed: 2026-03-02
- [x] ERP-CLI-105 | status:done | owner:@frontend
  - Objective: Remove non-mock runtime fallback client rows on clients listing page.
  - Evidence Required: `src/app/(dashboard)/clients/page.tsx`, `npm run ci:quality`.
  - Started: 2026-03-02
  - Completed: 2026-03-02
- [x] ERP-CLI-106 | status:done | owner:@frontend
  - Objective: Remove direct mock branch-type dependency from client branches list/detail/edit paths.
  - Evidence Required: `src/lib/branches/model.ts`, `src/app/(dashboard)/clients/branches/page.tsx`, `src/app/(dashboard)/clients/branches/[id]/page.tsx`, `src/app/(dashboard)/clients/branches/[id]/edit/form.tsx`, `npm run ci:quality`.
  - Started: 2026-03-03
  - Completed: 2026-03-03

### 5) Payroll

- [ ] ERP-PAY-100 | status:todo | owner:@backend
- [ ] ERP-PAY-101 | status:todo | owner:@frontend
- [ ] ERP-PAY-102 | status:todo | owner:@qa
- [x] ERP-PAY-103 | status:done | owner:@frontend
  - Objective: Remove bulk-loan upload page dependency on seeded mock draft rows.
  - Evidence Required: `src/lib/payroll/loans-bulk.ts`, `src/app/(dashboard)/payroll/loans/bulk/page.tsx`, `npm run ci:quality`.
  - Started: 2026-03-03
  - Completed: 2026-03-03

### 6) Inventory

- [ ] ERP-INV-100 | status:todo | owner:@backend
- [ ] ERP-INV-101 | status:todo | owner:@frontend
- [ ] ERP-INV-102 | status:todo | owner:@qa

### 7) Users + Access

- [ ] ERP-UAL-100 | status:todo | owner:@backend
- [ ] ERP-UAL-101 | status:todo | owner:@frontend
- [ ] ERP-UAL-102 | status:todo | owner:@qa

### 8) Ticketing

- [ ] ERP-TKT-001 | status:todo | owner:@backend
- [ ] ERP-TKT-002 | status:todo | owner:@frontend
- [ ] ERP-TKT-003 | status:todo | owner:@qa

### 9) Settings + Masters

- [ ] ERP-SET-001 | status:todo | owner:@backend
- [ ] ERP-SET-002 | status:todo | owner:@frontend
- [ ] ERP-SET-003 | status:todo | owner:@qa

### 10) Reports

- [ ] ERP-RPT-100 | status:todo | owner:@backend
- [ ] ERP-RPT-101 | status:todo | owner:@frontend
- [ ] ERP-RPT-102 | status:todo | owner:@qa

### 11) Imports

- [ ] ERP-IMP-100 | status:todo | owner:@backend
- [ ] ERP-IMP-101 | status:todo | owner:@frontend
- [ ] ERP-IMP-102 | status:todo | owner:@qa

### 12) Requisitions

- [ ] ERP-REQ-001 | status:todo | owner:@backend
- [ ] ERP-REQ-002 | status:todo | owner:@frontend
- [ ] ERP-REQ-003 | status:todo | owner:@qa

### 13) Audit + System (Workflow/Fingerprint)

- [ ] ERP-SYS-100 | status:todo | owner:@backend
- [ ] ERP-SYS-101 | status:todo | owner:@frontend
- [ ] ERP-SYS-102 | status:todo | owner:@qa

---

## C) Data + Migration Workstream

- [ ] ERP-DATA-001 | status:todo | owner:@backend  
  - Objective: Schema parity audit vs ERP documentation.  
  - Evidence Required: Model-to-screen mapping.

- [ ] ERP-DATA-002 | status:todo | owner:@backend  
  - Objective: Constraint/index hardening.  
  - Evidence Required: migration diff + runtime verification.

- [ ] ERP-DATA-003 | status:todo | owner:@platform  
  - Objective: Rollback-safe migration runbook.  
  - Evidence Required: documented rollback path.

---

## D) QA + Test Matrix

- [ ] ERP-QA-001 | status:todo | owner:@qa  
  - Objective: Expand route-level negative-path coverage.
- [ ] ERP-QA-002 | status:todo | owner:@qa  
  - Objective: Real-profile mandatory gate in CI validation policy.
- [ ] ERP-QA-003 | status:todo | owner:@qa  
  - Objective: Full-system regression suite signoff.
- [ ] ERP-QA-004 | status:todo | owner:@qa  
  - Objective: UAT checklist completion with defect closure.

---

## E) Release + Signoff

- [ ] ERP-REL-100 | status:todo | owner:@backend  
  - Objective: Engineering signoff.
- [ ] ERP-REL-101 | status:todo | owner:@qa  
  - Objective: QA signoff.
- [ ] ERP-REL-102 | status:todo | owner:@product  
  - Objective: Product signoff.
- [ ] ERP-REL-103 | status:todo | owner:@platform  
  - Objective: Ops/release signoff.
- [ ] ERP-REL-104 | status:todo | owner:@release  
  - Objective: Final go/no-go decision and release window lock.
- [ ] ERP-REL-106 | status:blocked | owner:@release  
  - Objective: Execute human approval collection and finalize signoff packet for `RC-2026-03-02-01`.  
  - Blocker: Engineering/QA/Product/Ops human approvals are still pending in `docs/release-signoff-rc-2026-03-02-01.md`.

- [x] ERP-REL-105 | status:done | owner:@release  
  - Objective: One-command signoff workflow orchestration (bulk sync -> status -> handoff -> optional gate).  
  - Evidence Required: `scripts/run-release-signoff-workflow.mjs`, `package.json` script `release:signoff:workflow`, run output with dry-run payload.  
  - Started: 2026-03-02  
  - Completed: 2026-03-02

---

## F) Risk Register

- [ ] ERP-RISK-001 | status:todo | owner:@platform | High  
  - Trigger: Strict-real profile regressions.
- [ ] ERP-RISK-002 | status:todo | owner:@backend | High  
  - Trigger: Scope/RBAC regression on sensitive APIs.
- [ ] ERP-RISK-003 | status:todo | owner:@frontend | Medium  
  - Trigger: Hidden mock fallback in production path.
- [ ] ERP-RISK-004 | status:todo | owner:@qa | Medium  
  - Trigger: Incomplete negative-path contract coverage.

---

## Progress Log

- 2026-03-02: Checklist initialized.
- 2026-03-02: `ERP-REL-105` completed. Added `release:signoff:workflow` orchestrator and validated dry-run execution with `docs/release-signoff-bulk-template.json`.
- 2026-03-02: `ERP-CLI-103` completed. Added `POST /api/clients/[id]/branches`, branch mutation audit logs, and scope assertions in integration (`213/213 PASS`).
- 2026-03-02: Program Health Dashboard baseline updated with numeric task counts and explicit release signoff blocker (`ERP-REL-106`).
- 2026-03-02: `ERP-GRD-004` completed. Added explicit guard profile no-photo placeholder state.
- 2026-03-02: `ERP-GRD-005` completed. Added guard image/placeholder rendering on `/guards` and `/guards/search` result rows.
- 2026-03-02: `ERP-GRD-006` completed. Removed passport inputs from add-guard form and removed passport OCR document-type label.
- 2026-03-03: `ERP-GRD-007` completed. Removed mock-profile merge/fallback from guard detail page and added explicit unavailable-state handling.
- 2026-03-03: `ERP-GRD-008` completed. Removed emergency guard pool mock dataset dependency and switched to DB-derived emergency rows with explicit unavailable-state handling.
- 2026-03-03: `ERP-XGT-004` progressed. Removed SHSHK/Admin Center direct seeded mock dependencies from dashboard flow (`src/app/(dashboard)/dashboard/shshk/page.tsx`, `src/app/(dashboard)/dashboard/admin-center/manager.tsx`) and decoupled shared types from mockData.
- 2026-03-03: `ERP-PAY-103` completed. Removed bulk-loan upload page seeded mock-row dependency and switched to upload-driven runtime draft initialization.
- 2026-03-02: `ERP-CLI-104` completed. Added Branch Client / Branchless Client mode selection buttons and preselected add flow (`mode=branch|branchless`).
- 2026-03-02: `ERP-CLI-105` completed. Removed non-mock DB-error fallback client rows from clients listing page and retained explicit unavailable-state messaging.
- 2026-03-03: `ERP-CLI-106` completed. Removed `getMockBranchType` dependency from client branches list/detail/edit and replaced with non-mock branch-model utility.
- YYYY-MM-DD: (append entries as tasks move states)

## Change Control

- [ ] ERP-CR-001 | status:todo | owner:@product  
  - Objective: Any new scope must be logged as change request.
