# Implementation Roadmap (Frontend-First → Backend Integration)

This roadmap follows a **frontend-first** approach, then integrates backend services. Each phase ends with testing and explicit deliverables.

---

## Phase 0 — Project Initialization
**Goals**: Ensure baseline setup and repositories are ready.

**Tasks**
- Establish repo structure, linting, formatting, and CI.
- Confirm documentation baseline and pre-dev checklist.
- Define release cadence and QA checkpoints.
- Align naming conventions for routes, modules, and shared components.
- Add baseline environments (local, staging, production) in CI/CD config.

**Deliverables**
- Repo scaffolding + CI pipeline.
- Documented engineering conventions.

**Testing**
- ✅ Run lint/build checks.
- ✅ Validate docs alignment against `pre_development_requirements.md`.

---

## Phase 1 — Design System & App Shell
**Goals**: Create the reusable UI foundation and layout structure.

**Tasks**
- Implement design tokens (color, spacing, typography).
- Build global layout shell (sidebar, top bar, context rail).
- Implement core UI components (buttons, cards, tables, badges).
- Add global states (loading, empty, error, permission denied).
- Implement navigation scaffolding for modules and settings pages.
- Add global search placeholder and notification bell UI.

**Deliverables**
- App shell layout and tokenized design system.
- Base component library (button, card, table, badge, tabs, forms).

**Testing**
- ✅ UI smoke test: navigation, layout responsiveness, component rendering.

---

## Phase 2 — Core UI Pages (Frontend-Only)
**Goals**: Build all module pages using mocked data and static states.

**Tasks**
- Auth flows: login, forgot password, reset password.
- Dashboard variants for Admin, Manager, Supervisor, HR, Finance.
- Module screens: Guards, Deployments, Attendance, Payroll, Billing, Inventory, Tickets, Reports, Settings.
- Approval Center and Broadcast Notifications pages.
- Data tables with sorting/filtering skeletons.
- Build empty state, error state, and permission-denied state for each module.
- Implement right context panel content per page (stats, alerts, shortcuts).

**Deliverables**
- Full UI route map with static data stubs.
- Role-based dashboard layouts.

**Testing**
- ✅ UI flow walkthroughs for each module.
- ✅ Snapshot tests for key screens (optional).

---

## Phase 3 — Forms & Validation (Frontend-Only)
**Goals**: Ensure all create/edit flows are wired with validation.

**Tasks**
- Implement React Hook Form + Zod schemas.
- Add inline validation and error states.
- Create drawer-based forms for create/edit actions.
- Build reusable form sections (guard profile, documents, bank info, contracts).
- Add file upload UI components (document upload, attachments).
- Implement form-level unsaved changes prompts.

**Deliverables**
- Validated forms for all core modules (guard, client, deployment, attendance, payroll, invoice, inventory, tickets).

**Testing**
- ✅ Form validation tests (field-level + schema-level).

---

## Phase 4 — Backend Schema & RLS
**Goals**: Implement database schema and enforce security policies.

**Tasks**
- Apply canonical schema migrations.
- Implement RLS helpers and base policies.
- Seed lookup data (roles, permissions, statuses).
- Add `approval_requests` table and notification audience fields.
- Create storage buckets and policies (documents, exports).

**Deliverables**
- Database schema deployed with RLS enabled.
- Seed scripts for baseline lookups.

**Testing**
- ✅ RLS tests: allowed vs denied access per role (using test users).

---

## Phase 5 — RPCs & Business Logic
**Goals**: Implement backend functions for workflow and transactions.

**Tasks**
- Build RPCs from `docs/api_contracts.md`.
- Implement workflow transitions and audit logging.
- Add approval request processing.
- Implement bulk attendance upsert and summary computations.
- Implement payroll run generation and finalization logic.
- Implement invoice generation and aging logic.

**Deliverables**
- RPCs deployed and versioned.
- Audit log coverage for all critical mutations.

**Testing**
- ✅ RPC integration tests (success + failure paths).

---

## Phase 6 — Frontend ↔ Backend Integration
**Goals**: Replace mocked data with live Supabase queries.

**Tasks**
- Wire lists and detail views to Supabase.
- Integrate RPC calls for create/update/transition actions.
- Implement notifications + realtime for dashboards.
- Enforce permission checks in UI (disable actions, show tooltips).
- Add optimistic UI updates where safe (e.g., status changes).
- Add pagination, filtering, and saved views for large tables.

**Deliverables**
- Fully functional CRUD flows connected to backend.
- Role-aware UI and permissions.

**Testing**
- ✅ End-to-end smoke tests for all modules.

---

## Phase 7 — Reporting, Exports & Scheduled Jobs
**Goals**: Deliver reporting and scheduled exports.

**Tasks**
- Implement report queries and filters.
- Export jobs (PDF/Excel) and job tracking UI.
- Scheduled reports via cron/edge functions.
- Implement audit search UI and log streaming.
- Add notification broadcasts and dashboard banners.

**Deliverables**
- Reports aligned with `dashboard_report_widget_definitions.md`.
- Export job tracking and scheduling UI.

**Testing**
- ✅ Report validation against `dashboard_report_widget_definitions.md`.

---

## Phase 8 — Migration & Data Load (if required)
**Goals**: Migrate legacy data into canonical schema.

**Tasks**
- Build ETL scripts following `legacy_to_canonical_mapping.md`.
- Run dry-run imports and reconciliation.
- Perform final import and verification.
- Validate dedupe outcomes and missing-data policies.
- Create migration reports for stakeholder review.

**Deliverables**
- Data migration logs and reconciliation reports.

**Testing**
- ✅ Data reconciliation checks and audit sampling.

---

## Phase 9 — Hardening & Go-Live
**Goals**: Prepare for production launch.

**Tasks**
- Performance tuning and indexing.
- Final QA regression.
- Release checklist in `docs/operational_runbook.md`.
- Load testing on dashboards and reports.
- Security review of RLS policies and service role usage.
- Runbook dry run and rollback drill.

**Deliverables**
- Signed-off QA checklist and go-live approval.

**Testing**
- ✅ Full regression suite + performance benchmarks.

---

## Completion Criteria (100% readiness)
- All modules fully functional and integrated.
- QA acceptance criteria satisfied (`qa_acceptance_criteria.md`).
- Deployment runbook executed successfully.
- Stakeholder sign-off and go-live approval.
