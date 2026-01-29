# Security Services ERP — System Blueprint (Next.js + Supabase)

**Purpose:** Define the target system boundaries, canonical data model, database functions, RLS access model, and UI workspace map for building the **new ERP** (clean DB, no legacy duplication). Data migration from old MySQL is **out of scope for build v1** and will be handled later via ETL.

---

## 1) Principles and Non‑Goals

### Guiding principles
- **Workflow-first**: the ERP is a lifecycle system (Guard → Deployment → Attendance → Payroll → Billing → Audit).
- **Database-enforced security**: Supabase **RLS is the real boundary**; UI permissions are convenience.
- **Atomic business operations**: payroll, invoicing, deployments use **Postgres functions (RPC)** with transactions.
- **Auditability by default**: every critical change leaves a trail.
- **Modular delivery**: each domain is a “module” with standard patterns (list → detail → create, actions, validations).

### Non-goals (for build phase)
- Full feature parity with every legacy table.
- Migrating historical noise/duplicates.
- Recreating old monolith behaviors that the business doesn’t trust.

---

## 2) Domain Boundaries (Bounded Contexts)

> Each boundary owns its tables and its “critical functions”. Cross-boundary reads happen via views or RPC.

### A. Identity & Access (IAM)
**Owns:** users, roles, permissions, scope, session profile.
- Staff users (Supabase Auth) + **profiles**
- RBAC with scope (org/regional/branch)
- Optional: client portal users

### B. Guard Lifecycle
**Owns:** guard master record + documents + status lifecycle + verification + loans + clearance.
- Guard case file is the center of operations.

### C. Client & Contracting
**Owns:** clients, branches, contracts, rate cards.
- Contracts drive invoicing rates.

### D. Operations & Deployment
**Owns:** deployments/assignments, capacity, shift patterns/rosters.
- Enforces “who is deployed where, when, and under what shift”.

### E. Attendance & Leave
**Owns:** daily attendance records, approvals, exceptions.
- Attendance is the downstream source for payroll + billing.

### F. Payroll & Finance
**Owns:** salary runs/ledgers, payslips, loan deductions.
- Ledgers are append-only “runs” that can be finalized/locked.

### G. Billing & Payments
**Owns:** invoices, line items, payments, aging.

### H. Inventory & Assets
**Owns:** assets/products, assignments, expiries, condition changes.

### I. Tickets & Support
**Owns:** tickets, comments, attachments.

### J. Reporting & Audit
**Owns:** report configs, exports, audit log.
- Reporting is built on read models (views/materialized views).

### K. Workflow & Automation Platform Layer
**Owns:** workflow transitions, validation rules, scheduled jobs metadata.
- Turns lifecycle changes into a configurable engine.

---

## 3) Canonical Data Model (New DB)

### 3.1 Key design choices
- **Primary keys**: use **UUID** for all business entities (recommended for Supabase + imports). Lookup tables can be SERIAL/SMALLINT.
- **Multi-tenancy**: all records carry **org_id**.
- **Scope columns**: where relevant, include **regional_office_id** and/or **branch_id**.
- **Flexible fields**: use **JSONB** only for truly variable shapes (family, history, misc attributes). Keep query-heavy facts relational.

### 3.2 Canonical tables (grouped)

#### A) Organization & Scope
- **organizations**(id, name, is_active, created_at)
- **regions**(id, org_id, name)
- **regional_offices**(id, org_id, region_id, name, short_name, address, is_head_office, created_at)
- **regional_office_contacts**(id, regional_office_id, contact_type, contact_value)

#### B) IAM (Auth + RBAC)
- **profiles**(id = auth.users.id, org_id, full_name, role_id, regional_office_id?, contact_no, is_active, last_login, created_at, updated_at)
- **roles**(id, org_id, name, description)
- **permissions**(id, module, action, UNIQUE(module, action))
- **role_permissions**(role_id, permission_id, scope: 'all'|'regional'|'branch'|'own')
- **user_scopes**(id, user_id, scope_type: 'regional'|'branch'|'client', scope_id)
- **user_role_overrides**(optional: user_id, permission_id, allow/deny)

#### C) Guard Lifecycle
- **guard_statuses**(id, org_id, name, color, is_active)
- **guard_designations**(id, org_id, name)
- **guards**(
  id, org_id,
  parwest_id, name, cnic_no, contact_no, father_name, dob, gender, marital_status,
  current_status_id, designation_id,
  regional_office_id,
  joining_date, termination_date,
  personal_info JSONB,  -- education, blood group, ex-service, religion, etc
  created_by, created_at, updated_at, deleted_at
)
- **guard_bank_accounts**(id, org_id, guard_id, bank_name, account_title, account_number, branch_code, is_primary)
- **guard_family_members**(id, org_id, guard_id, relation, name, cnic?, contact?, occupation?, details JSONB)
- **guard_employment_history**(id, org_id, guard_id, company_name, designation, from_date, to_date, leaving_reason)
- **guard_documents**(id, org_id, guard_id, document_type_id, file_path, file_name, uploaded_by, created_at)
- **document_types**(id, org_id, entity_type: 'guard'|'ticket'|'invoice', name, is_required, metadata JSONB)
- **guard_verifications**(id, org_id, guard_id, verification_type, status, verified_date, document_path?, remarks, verified_by, created_at)
- **guard_status_history**(id, org_id, guard_id, from_status_id, to_status_id, changed_by, changed_at, payload JSONB)
- **guard_loans**(id, org_id, guard_id, loan_amount, installment_amount, remaining_amount, loan_date, purpose, status, approved_by, created_at)
- **guard_clearance**(id, org_id, guard_id, clearance_date, final_salary, pending_loans, inventory_returned, documents_returned, remarks, processed_by, status)

#### D) Client & Contracting
- **client_types**(id, org_id, name)
- **clients**(id, org_id, name, email, phone, address, client_type_id, is_active, enrollment_date, enrolled_by, created_at, updated_at)
- **client_branches**(id, org_id, client_id, name, address, city, province, regional_office_id, is_active,
  guard_capacity, day_cpo_capacity, night_cpo_capacity, so_capacity, aso_capacity,
  supervisor_id?, manager_id?,
  latitude?, longitude?,
  enrollment_date, closing_date,
  created_at, updated_at
)
- **client_contracts**(id, org_id, client_id, start_date, end_date, is_active, terms, created_at)
- **contract_rates**(id, org_id, contract_id, guard_type, rate, overtime_rate?)

#### E) Operations & Deployment
- **guard_deployments**(id, org_id, guard_id, branch_id, contract_id?, shift_type, deployed_at, revoked_at?, deployed_by, revoked_by?, is_active)
- **branch_capacity_history**(id, org_id, branch_id, changed_by, changed_at, from_capacity JSONB, to_capacity JSONB)
- **rosters**(id, org_id, branch_id, roster_date, shift_type, created_by, created_at)
- **roster_items**(id, org_id, roster_id, guard_id, expected_status: 'P'|'OFF', notes?)

#### F) Attendance & Leave
- **guard_attendance**(id, org_id, guard_id, branch_id, attendance_date, status: 'P'|'A'|'L'|'H', shift, marked_by, source: 'web'|'mobile', created_at, UNIQUE(guard_id, attendance_date))
- **leave_requests**(id, org_id, guard_id, from_date, to_date, leave_type, reason, status, requested_by, approved_by?, created_at)
- **attendance_exceptions**(optional: id, org_id, branch_id, date, type, payload JSONB, created_at)

#### G) Payroll & Finance
- **payroll_runs**(id, org_id, month, year, regional_office_id?, status: 'draft'|'review'|'final', generated_by, generated_at, finalized_by?, finalized_at?)
- **payroll_items**(id, org_id, payroll_run_id, guard_id, basic_salary, allowances JSONB, deductions JSONB, gross_salary, net_salary, payment_status, bank_account_id?, computed_payload JSONB)
- **payslip_exports**(id, org_id, payroll_run_id, exported_by, exported_at, file_path?)
- **loan_deductions**(id, org_id, payroll_item_id, loan_id, amount)

#### H) Billing & Payments
- **invoices**(id, org_id, client_id, invoice_number, invoice_month, invoice_year, subtotal, tax_amount, total_amount, status: 'draft'|'sent'|'paid'|'overdue', due_date, generated_at, generated_by)
- **invoice_line_items**(id, org_id, invoice_id, branch_id, description, guard_type, quantity, rate, amount)
- **invoice_payments**(id, org_id, invoice_id, amount, payment_date, payment_method, reference_no, recorded_by, created_at)
- **invoice_exports**(optional: id, org_id, invoice_id, file_path, exported_at)

#### I) Inventory & Assets
- **inventory_categories**(id, org_id, name)
- **inventory_product_types**(id, org_id, category_id, name)
- **inventory_products**(id, org_id, category_id, product_type_id, serial_number, license_number?, license_expiry?, condition, status,
  regional_office_id?, vendor_id?, purchase_date?, purchase_price?, metadata JSONB, created_at)
- **inventory_assignments**(id, org_id, product_id, guard_id?, branch_id?, assigned_at, returned_at?, assigned_by, returned_by?, condition_on_return?)
- **inventory_events**(optional: id, org_id, product_id, event_type, payload JSONB, created_at)

#### J) Tickets & Support
- **ticket_categories**(id, org_id, name)
- **ticket_priorities**(id, org_id, name, color)
- **ticket_statuses**(id, org_id, name)
- **tickets**(id, org_id, title, description, category_id, priority_id, status_id, created_by, assigned_to?, closed_at?, created_at, updated_at)
- **ticket_comments**(id, org_id, ticket_id, content, created_by, is_internal, created_at)
- **ticket_attachments**(id, org_id, ticket_id, file_path, file_name, uploaded_by, created_at)

#### K) Workflow, Audit, Notifications
- **workflow_transitions**(id, org_id, entity_type, from_status, to_status, required_roles TEXT[], required_fields TEXT[], validation_rules JSONB, is_active)
- **audit_logs**(id, org_id, entity_type, entity_id, action, before JSONB, after JSONB, actor_user_id, actor_role?, created_at, ip?, user_agent?)
- **notifications**(id, org_id, user_id, title, body, link?, severity, read_at?, created_at)
- **scheduled_reports**(id, org_id, name, report_type, cron_expr, filters JSONB, recipients JSONB, is_active)
- **export_jobs**(optional: id, org_id, job_type, params JSONB, status, file_path?, created_by, created_at)

---

## 4) Critical DB Functions (RPC) and Triggers

> These functions keep business logic consistent and transactional. UI calls them through Supabase RPC.

### 4.1 IAM / Permissions
1. **check_permission(user_id, module, action)** → boolean
   - Resolves role_permissions (+ optional overrides)
   - Applies scope rules
2. **get_user_scopes(user_id)** → regions/branches/clients arrays
3. **assert_scope(entity_table, entity_id, user_id)** → raises if out of scope (optional helper)

### 4.2 Workflow Engine
4. **transition_entity_status(entity_type, entity_id, to_status, payload JSONB)**
   - Validates allowed transition from workflow_transitions
   - Validates required fields + custom rules
   - Writes status history table (guard_status_history / invoice status log / ticket log)
   - Writes audit log

### 4.3 Deployments & Capacity
5. **deploy_guard(guard_id, branch_id, shift_type, deployed_at, contract_id?)**
   - Ensures guard is eligible (status)
   - Ensures only one active deployment for the guard (or supports multi-site if required)
   - Checks capacity constraints (branch capacity by guard type/shift)
   - Writes guard_deployments + audit
6. **revoke_deployment(deployment_id, revoked_at, reason?)**

### 4.4 Attendance
7. **upsert_attendance_bulk(branch_id, attendance_date, rows JSONB)**
   - Transactional bulk insert/update
   - Validates guard is deployed (or logs exception)
   - Produces attendance_exceptions
8. **compute_attendance_summary(month, year, branch_id?, client_id?)**
   - Used for dashboards, payroll, invoices

### 4.5 Payroll
9. **generate_payroll_run(month, year, regional_office_id?)** → payroll_run_id
   - Creates run + computes items
10. **compute_payroll_item(guard_id, month, year, policy JSONB)** → computed breakdown
11. **apply_loan_deductions(payroll_run_id)**
12. **finalize_payroll_run(payroll_run_id)**
   - Locks run, prevents edits, creates payslip exports entries

### 4.6 Invoicing
13. **generate_invoices(month, year, client_id?)** → invoice_ids
   - Uses contract rates + attendance summaries
14. **compute_invoice(invoice_id)**
15. **record_invoice_payment(invoice_id, amount, payment_date, method, reference_no)**
16. **update_invoice_statuses(today_date)**
   - Marks overdue based on due_date + outstanding

### 4.7 Inventory
17. **issue_inventory(product_id, guard_id?, branch_id?, assigned_by)**
   - Validates availability + status
18. **return_inventory(assignment_id, condition_on_return, returned_by)**
19. **check_license_expiry(days_ahead)** → list of items expiring

### 4.8 Scheduled Reports
20. **run_scheduled_reports(now_ts)**
   - Generates report outputs + emails recipients

### 4.9 Triggers (database-level)
- **set_updated_at()** trigger for updated_at fields.
- **audit_trigger()** on INSERT/UPDATE/DELETE for core tables (guards, deployments, attendance, payroll_items, invoices, inventory_products, tickets).
- **status_history_trigger()** optionally called by workflow transitions.

---

## 5) RLS Rules per Role (Supabase)

### 5.1 Role set (recommended baseline)
To keep it simple but complete, model these as roles in `roles`:
1. **system_admin** (head office)
2. **regional_manager** (regional office head)
3. **hr_officer**
4. **ops_supervisor**
5. **finance_officer**
6. **inventory_officer**
7. **auditor_readonly** (optional)
8. **client_portal** (optional)

> If you want to keep “5 roles”, you can merge inventory into ops, and auditor into admin.

### 5.2 Scope model
- Every user has **org_id**.
- Optional scopes:
  - **regional_office_id** on profile
  - **branch scope** via `user_scopes`
  - **client scope** for portal via `user_scopes`

### 5.3 RLS policy patterns
Create helper functions (SECURITY DEFINER):
- **current_org_id()** → org_id from profiles(auth.uid())
- **current_role()** → role name
- **has_permission(module, action)** → boolean via role_permissions
- **in_region(regional_office_id)** → boolean
- **in_branch(branch_id)** → boolean

Then apply table policies:

#### Global baseline (all tables)
- **SELECT/INSERT/UPDATE/DELETE** always requires `org_id = current_org_id()`.

#### Region-scoped tables
Examples: guards, client_branches, inventory_products, payroll_runs
- Allow if **system_admin** OR user in same regional office.

#### Branch-scoped tables
Examples: guard_attendance, rosters, deployments
- Allow if system_admin OR regional_manager (same region) OR ops_supervisor assigned to branch.

#### Sensitive tables
- guard_bank_accounts, payroll_items
- Allow if system_admin OR finance_officer (same scope) OR hr_officer (read-only for bank if required).

#### Client portal
- invoices, invoice_line_items (read-only) where client_id in user_scopes.
- tickets where created_by = portal user OR client_id scope.

### 5.4 Example role permissions (high-level)
- **system_admin**: all modules/all actions/all scope
- **regional_manager**: all modules except IAM admin (no role editing), scope = regional
- **hr_officer**: guards CRUD + documents + verifications, read deployments/attendance, no payroll finalize
- **ops_supervisor**: deployments + attendance + rosters, read-only guards + clients
- **finance_officer**: payroll runs + invoices + payments, read-only guard identity, no guard edits
- **inventory_officer**: inventory CRUD + assignments, read-only others
- **auditor_readonly**: select-only across org + audit search

### 5.5 Storage (Supabase Storage) policies
- Bucket: **guard-documents**
  - Allow upload if has_permission('guards','update') AND in_region(guard.regional_office_id)
  - Read if user can read that guard
- Bucket: **ticket-attachments**
  - Allow upload if user can comment on ticket

---

## 6) UI Workspaces Map (Information Architecture)

> This is not “UI design”. It’s the functional workspaces and route map that the UI will implement.

### 6.1 Primary workspaces
1. **Command Center Dashboard**
   - Alerts: license expiries, overdue invoices, missing attendance, guards pending verification
   - KPIs: active guards, deployed vs capacity, payroll due, invoice aging

2. **Guards Workspace (Case File)**
   - List + filters (status, region, designation)
   - Guard detail: Overview, Documents, Verification, Deployments, Attendance, Payroll, Loans, Clearance, Activity

3. **Deployments Workspace (Operations Matrix)**
   - Branch view (required vs deployed vs absent)
   - Actions: deploy, swap, revoke, extend
   - Optional map view

4. **Attendance Workspace**
   - Daily attendance per branch
   - Bulk marking + anomaly detection
   - Leave approvals

5. **Payroll Workspace**
   - Payroll runs (draft/review/final)
   - Exceptions + approvals
   - Payslip exports

6. **Billing Workspace**
   - Invoice generation (monthly)
   - Invoice detail + line items
   - Payments + aging

7. **Inventory Workspace**
   - Stock list, asset detail, expiry dashboard
   - Assign/return flows

8. **Tickets Workspace**
   - Queue + assignment
   - Ticket thread (comments + attachments)

9. **Reports & Audit**
   - Report library + scheduled reports
   - Export center
   - Audit search timeline

10. **Settings (Admin)**
   - Users, roles, permissions
   - Workflow transitions
   - Lookup tables (statuses, designations, document types)
   - Templates (emails, PDFs)

### 6.2 Suggested Next.js route map
- **/(auth)**
  - /login
  - /forgot-password
- **/(dashboard)**
  - /dashboard
  - /guards
  - /guards/new
  - /guards/[id]
  - /deployments
  - /attendance
  - /payroll
  - /billing/invoices
  - /billing/invoices/[id]
  - /inventory
  - /tickets
  - /reports
  - /audit
  - /settings/users
  - /settings/roles
  - /settings/workflows
  - /settings/lookups

---

## 7) Read Models (Views) for Fast UI

Build DB views for common screens:
- **vw_guard_case_summary** (guard + current status + current deployment)
- **vw_branch_deployment_status** (capacity vs deployed vs absent)
- **vw_attendance_daily_summary** (branch/day totals)
- **vw_payroll_run_summary** (run totals + exceptions)
- **vw_invoice_aging** (client totals + overdue buckets)
- **vw_inventory_expiry** (license expiries)

Optional: materialize heavy monthly views.

---

## 8) What this blueprint enables next

Once this is locked, UI design becomes a controlled step:
- We can design **futuristic, simple, interactive** screens around the workspaces (command center, case file, matrix, ledgers).
- No generic dashboard guessing.

---

## 9) Build order (recommended)
1. IAM + org/scope + RLS skeleton
2. Guards (case file) + documents
3. Clients/branches/contracts
4. Deployments + attendance
5. Payroll runs
6. Invoices + payments
7. Inventory
8. Tickets
9. Reports + scheduled jobs + audit search

---

## 10) Environment, Supabase Setup, and Operations

This section defines the **environment variables**, **Supabase project setup**, **RLS deployment**, **backup/restore**, and **operational monitoring** expectations. It is split by **local dev**, **staging**, and **production** to prevent drift and ensure safe deployments.

### 10.1 Environment variables (shared catalog)
Use consistent names across all environments. Local uses `.env.local`; staging/production use a secrets manager or hosting provider secrets.

| Variable | Purpose | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public; safe to expose in browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Browser auth + RLS policies apply. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | **Server-only** for admin jobs and migrations. Never expose to client. |
| `DATABASE_URL` | Postgres connection string | Used for migrations/CLI; should use service role credentials. |
| `SUPABASE_PROJECT_REF` | Supabase project ref | For CLI linking and deployment scripts. |
| `SUPABASE_JWT_SECRET` | JWT signing secret | Needed for local auth emulation or custom auth flows. |
| `SUPABASE_STORAGE_BUCKET` | Default storage bucket | For document uploads (guard docs, tickets, invoices). |
| `LOG_LEVEL` | App log verbosity | e.g., `debug`, `info`, `warn`, `error`. |
| `SENTRY_DSN` (or equivalent) | Error monitoring | Required for staging/prod observability. |

### 10.2 Supabase project setup (baseline)
1. **Create project** for each environment (separate Supabase projects for local, staging, production).
2. **Enable Auth + Storage** and configure base settings (site URL, redirects, storage buckets).
3. **Create roles and policies** via migrations (see RLS deployment below).
4. **Configure secrets** (JWT secret, service role, project ref) in the environment manager.
5. **Set up scheduled jobs** (e.g., payroll run generation, report exports) using Supabase cron or external schedulers.

### 10.3 RLS deployment steps (safe rollout)
1. **Migrations first**: apply schema migrations in a single transaction where possible.
2. **Enable RLS** on new tables immediately: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
3. **Create policies** for each table (read/write/owner/scoped access).
4. **Validate with role simulation**:
   - `anon` (web client) must be restricted to allowed reads and writes.
   - `authenticated` should respect role/scope (org/regional/branch).
   - `service_role` should bypass RLS only for internal jobs.
5. **Add regression checks**: basic read/write tests per policy and an audit log smoke test.
6. **Lock down**: remove any temporary policy grants after validation.

### 10.4 Backup and restore expectations
**Production** is the source of truth. Backups must be automated and tested.
- **Backups**:
  - Use Supabase automated backups (daily) and keep a rolling retention window.
  - Export monthly snapshots to off-platform storage (e.g., S3/Blob).
- **Restore drills**:
  - Quarterly restore to a **staging clone** to validate backup integrity.
  - Document restore steps and recovery times (RTO/RPO).
- **Point-in-time recovery (PITR)**:
  - Enable if available for production.
  - Maintain WAL retention where supported.

### 10.5 Monitoring, logging, and alerting (operational expectations)
**Goal:** detect failures early, correlate incidents, and protect data integrity.
- **Database monitoring**: query latency, connection saturation, replication health, and slow query logs.
- **Application logging**: structured JSON logs with request IDs, user IDs, and org IDs (no PII).
- **Audit trail monitoring**: alert if audit log insert rates drop unexpectedly.
- **Error tracking**: client + server error monitoring (Sentry or equivalent).
- **Alerting**: page on-call for:
  - Elevated error rates (HTTP 5xx/4xx spikes).
  - Failed cron jobs or missed scheduled payroll/invoice runs.
  - Storage upload failures or permission errors.
  - Database disk/CPU saturation or connection limits exceeded.

### 10.6 Local development
**Purpose:** fast iteration with safe defaults.
- Use a **local Supabase stack** (CLI) or a dedicated dev project.
- `.env.local` stores local URLs and keys only.
- Keep RLS **enabled** even locally to prevent security drift.
- Use seed data scripts for common scenarios (guard lifecycle, deployment, payroll).

### 10.7 Staging environment
**Purpose:** pre-prod validation with production-like constraints.
- Separate Supabase project with staging data (sanitized or synthetic).
- Full RLS policies enforced.
- Run migration + RLS regression tests on each deployment.
- Enable monitoring + error tracking at near-production thresholds.
- Regularly restore **production backup snapshots** to staging for realistic QA.

### 10.8 Production environment
**Purpose:** stable, auditable, and secure operations.
- Secrets stored in a managed vault; **no `.env` files** in the repo.
- Production Supabase project isolated from dev/staging.
- Strict RLS policies with minimal service role access.
- Backups verified with restore drills.
- Alerting and on-call escalation configured before go-live.
