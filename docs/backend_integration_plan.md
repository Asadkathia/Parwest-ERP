# Backend Integration Plan (Supabase)

> **Project**: Parwest ERP (Security Guard Management)  
> **Source of truth**: `docs/security_erp_system_blueprint_next.md`, `docs/iam_access_matrix.md`, `docs/api_contracts.md`, `docs/legacy_to_canonical_mapping.md`, `docs/system_analysis.md`  
> **Strategy**: Build clean canonical backend first, migrate legacy data later via ETL.

---

## 1) Goals

- Implement the canonical Postgres/Supabase backend defined in the blueprint.
- Enforce RLS + permissions as the primary security boundary.
- Provide transactional RPCs for core business actions.
- Keep UI on mock data until backend stabilizes, then wire live data.
- Prepare for legacy migration without contaminating the new schema.

---

## 2) Scope & Phasing

### Phase 8.1 — Schema & RLS Skeleton (Week 1)
**Focus**: tables, roles, RLS helpers, base policies.

**Deliverables**
- Canonical tables created (UUID PKs, `org_id` everywhere).
- RLS helper functions:
  - `current_org_id()`
  - `current_role()`
  - `has_permission(module, action)`
  - `in_region(regional_office_id)`
  - `in_branch(branch_id)`
- Baseline RLS policies applied to core tables.
- Seed roles + permissions from `iam_access_matrix.md`.
- Audit triggers for core entities.

### Phase 8.2 — RPCs & Workflows (Week 1–2)
**Focus**: transactional functions and workflow transitions.

**Deliverables**
- RPCs implemented per `api_contracts.md`.
- Workflow engine (`transition_entity_status`) integrated with status history + audit logs.
- Validation rules aligned with `workflows.md`.

### Phase 8.3 — Data Wiring (Week 2)
**Focus**: replace mock data for a limited slice first.

**Initial wiring**
- Guards list + details
- Deployments matrix + deploy/swap/revoke
- Attendance bulk updates

### Phase 8.4 — Extended Wiring (Week 3+)
**Focus**: payroll, billing, inventory, tickets.

---

## 3) Canonical Tables (Minimum Viable Set)

### IAM / Org
- `organizations`, `regions`, `regional_offices`, `regional_office_contacts`
- `profiles`, `roles`, `permissions`, `role_permissions`, `user_scopes`, `user_role_overrides`

### Guards
- `guards`, `guard_statuses`, `guard_status_history`, `guard_designations`
- `guard_family_members`, `guard_employment_history`
- `guard_bank_accounts`, `guard_documents`, `document_types`
- `guard_verifications`, `guard_clearance`
- `guard_attendance`, `attendance_exceptions`
- `guard_loans`, `loan_deductions`
- `audit_logs`

### Clients & Contracts
- `clients`, `client_types`, `client_branches`
- `client_contracts`, `contract_rates`

### Deployments
- `guard_deployments`, `branch_capacity_history`

### Payroll
- `payroll_runs`, `payroll_items`, `payslip_exports`

### Billing
- `invoices`, `invoice_line_items`, `invoice_payments`

### Inventory
- `inventory_products`, `inventory_assignments`

### Tickets (optional in Week 1)
- `tickets`, `ticket_comments`, `ticket_attachments`

### Reports
- `export_jobs`

---

## 4) RLS Model (Baseline)

**Global baseline**
- All tables must enforce `org_id = current_org_id()`.

**Scope rules**
- Region-scoped tables: `guards`, `client_branches`, `inventory_products`, `payroll_runs`
- Branch-scoped tables: `guard_attendance`, `guard_deployments`
- Sensitive tables: `guard_bank_accounts`, `payroll_items`
- Client portal: invoices + line items limited to scoped `client_id`

---

## 5) RPCs (Transaction‑Safe)

**IAM**
- `check_permission`
- `get_user_scopes`
- `assert_scope`

**Workflow**
- `transition_entity_status`

**Deployments**
- `deploy_guard`
- `revoke_deployment`

**Attendance**
- `upsert_attendance_bulk`
- `compute_attendance_summary`

**Payroll**
- `generate_payroll_run`
- `compute_payroll_item`
- `apply_loan_deductions`
- `finalize_payroll_run`

**Billing**
- `generate_invoices`
- `compute_invoice`
- `record_invoice_payment`
- `update_invoice_statuses`

**Inventory**
- `issue_inventory`
- `return_inventory`
- `check_license_expiry`

**Reports**
- `run_scheduled_reports`

---

## 6) Migration Strategy (Legacy → Canonical)

**Principles**
- Do not mirror legacy structure.
- Clean, dedupe, normalize before load.
- Validate counts + referential integrity after load.

**Mapping references**
- `docs/legacy_to_canonical_mapping.md`
- `docs/system_analysis.md`

---

## 7) Execution Checklist

### Week 1
- [ ] Create schema migrations for canonical tables
- [ ] Create RLS helper functions + base policies
- [ ] Seed roles/permissions
- [ ] Add audit triggers
- [ ] Implement Deployments + Attendance RPCs

### Week 2
- [ ] Implement Payroll + Billing RPCs
- [ ] Wire Guards + Deployments to real data
- [ ] Implement workflow transitions

### Week 3+
- [ ] Inventory RPCs + wiring
- [ ] Tickets + Reports wiring
- [ ] Start migration dry runs (ETL)

---

## 8) Definition of Done

- Backend schema matches blueprint.
- RLS enforces org + scope for all core tables.
- RPCs cover deployments, attendance, payroll, billing.
- Guards + Deployments + Attendance wired to live data.
- Migration plan validated via ETL dry run.

