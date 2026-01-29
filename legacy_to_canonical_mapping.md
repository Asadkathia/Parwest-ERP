# Legacy → Canonical Mapping Plan (Based on `system_analysis.md`)

This document maps **legacy MySQL tables** listed in `system_analysis.md` to the **canonical Supabase/Postgres tables** defined in `security_erp_system_blueprint_next.md`. It includes field mappings, deduplication rules, missing/invalid data handling, deprecated/consolidated tables, a migration timeline, and a validation checklist.

---

## 1) Guard Lifecycle

### 1.1 Core guard identity
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `guards` | `guards` | `guards.id` → new UUID; `parwest_id`, `name`, `cnic_no`, `contact_no`, `father_name`, `dob`, `gender`, `marital_status`, `joining_date`, `termination_date`, `regional_office_id` → same fields | **Primary dedupe key:** `cnic_no` (if valid). Secondary: `parwest_id` + `name` + `dob`. Keep earliest `created_at` and latest `updated_at` | If `cnic_no` missing/invalid, keep record but flag in `personal_info.validation_errors`. If `dob` invalid, set `dob` = NULL and log in migration report |
| `guard_statuses` | `guard_statuses` | `name`, `color` | Normalize status names (trim/case); merge aliases | Missing color → default from legacy UI palette or NULL |
| `guard_designation` | `guard_designations` | `name` | Normalize by lowercase name | If name empty → map to `Unknown` designation |

### 1.2 Personal/extended info
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `guard_family` | `guard_family_members` | `guard_id`, `relation`, `name`, `cnic`, `contact`, `occupation`, extras → `details` JSONB | Dedupe per guard: `relation` + `name` + `cnic` | Missing relation/name → keep record with `relation = 'Unknown'` and log |
| `guard_nearest_relatives` | `guard_family_members` | Map `relation` = 'Nearest Relative' and move fields to `details` | Same as above | Same as above |
| `guard_employment_history` | `guard_employment_history` | `company_name`, `designation`, `from_date`, `to_date`, `leaving_reason` | Dedupe by `company_name` + `from_date` + `to_date` | If dates invalid → set NULL and log |
| `guard_educations_types`, `blood_groups`, `religions`, `sects` | `guards.personal_info` JSONB | Map legacy lookup values into `personal_info` (e.g., `education_level`, `blood_group`, `religion`, `sect`) | Normalize by lowercase/trim | If missing, omit from JSON |
| `guard_ex_services` | `guards.personal_info` JSONB | `ex_service` flag + detail fields | Merge per guard | If missing → default `false` |
| `guard_bank_details` | `guard_bank_accounts` | `bank_name`, `account_title`, `account_number`, `branch_code`, `is_primary` | Dedupe per guard by `account_number` | Missing account number → keep row with `is_primary = false`, flagged in validation |

### 1.3 Documents & verification
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `guard_documents` | `guard_documents` | `guard_id`, `document_type_id`, `file_path`, `file_name`, `uploaded_by`, `created_at` | Dedupe by `guard_id` + `document_type_id` + `file_name` | Missing file path → keep record and mark `metadata.missing_file = true` |
| `document_types` | `document_types` | `name` with `entity_type='guard'` | Normalize by lowercase/trim | If name missing → drop row |
| `guard_verifications`, `guard_verification_types`, `guard_verification_statuses`, `guard_special_branch_check_history`, `guard_mental_health_check` | `guard_verifications` | Type + status lookups normalized into `verification_type` and `status`; details moved into `remarks` or JSONB | Merge per guard by `verification_type` + latest `verified_date` | Missing status → set `status = 'pending'` |

### 1.4 Status & history
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `guard_history`, `guard_update_history`, `guard_status_by_col` | `guard_status_history` + `audit_logs` | Use `guard_status_history` for status changes; everything else becomes `audit_logs` (entity_type = 'guard') | Dedupe by `guard_id` + `changed_at` + `to_status_id` | If timestamps invalid, use import timestamp and log |

### 1.5 Attendance & leave
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `guard_attendance` | `guard_attendance` | `guard_id`, `attendance_date`, `status`, `branch_id`, `shift`, `marked_by` | Unique on `guard_id + attendance_date` (canonical constraint); keep latest `updated_at` | Invalid status → map to `A` (absent) and log |
| `guard_attendance_years` | `attendance_exceptions` (optional) | Convert yearly rollups into exception payloads or discard if derived | Dedupe by year + guard | If derived → mark as derived and skip in canonical |
| `guard_attendance_update_history` | `audit_logs` | entity_type = 'guard_attendance' | Dedupe by `guard_id + attendance_date + changed_at` | Missing actor → `actor_user_id = NULL` |
| `guard_remaining_leaves` | `leave_requests` (or derived) | Seed leave balance as a legacy “opening balance” request | Dedupe by guard + year | Missing year → infer from `created_at` |

### 1.6 Payroll & loans
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `guard_salary`, `guard_salary_posted`, `guards_paid_salary` | `payroll_runs`, `payroll_items` | Map month/year into `payroll_runs`; each guard row into `payroll_items` (salary, allowances, deductions, net) | Dedupe per guard + month/year; prefer `posted` over `draft` | Missing month/year → derive from `created_at` |
| `guard_salary_new_table`, `guards_basic_salary`, `guard_salary_categories`, `payroll_salary_rules*` | `payroll_items` + policy metadata | Migrate rules to JSON policy reference in `computed_payload` | Dedupe by rule name | Unknown rule → migrate as JSON blob |
| `guard_extra_hours`, `payroll_special_duty`, `allowance_types`, `allowance_type_additions`, `eid_allowances` | `payroll_items.allowances` JSONB | Normalize allowance keys | Dedupe by guard + month + allowance type | Missing amount → skip and log |
| `payroll_deduction`, `payroll_other_deductions`, `deduction_types`, `apsaa_deductions`, `cwf_deductions`, `special_branch_deductions` | `payroll_items.deductions` JSONB | Normalize deduction keys | Dedupe by guard + month + deduction type | Missing amount → skip and log |
| `guard_unpaid_salaries`, `guard_unpaid_salary` | `payroll_items.payment_status` | **Consolidate duplicates** → single status in canonical | Prefer the latest record | Missing status → default `unpaid` |
| `guard_loans`, `user_finalize_loan_history`, `users_finalize_loans`, `payroll_loan_demand` | `guard_loans`, `loan_deductions` | Loan rows map to `guard_loans`; deductions to `loan_deductions` | Dedupe by guard + loan_date + amount | Missing loan status → `pending` |
| `guard_clearance`, `guard_clearance_history_stat`, `guard_default_clearance` | `guard_clearance` | Map totals and status; history to `audit_logs` | Dedupe by guard + clearance_date | Missing clearance_date → NULL and log |

---

## 2) Clients, Contracts & Deployments

### 2.1 Clients & branches
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `clients` | `clients` | `name`, `email`, `phone`, `address`, `client_type_id`, `enrollment_date` | Dedupe by `name` + `phone` (or `email`) | Missing name → skip record |
| `client_types` | `client_types` | `name` | Normalize by lowercase/trim | Missing name → drop |
| `client_branches`, `client_branch_update_history` | `client_branches` + `audit_logs` | Map branch fields; history to `audit_logs` | Dedupe by `client_id` + `name` + `address` | Missing `client_id` → skip and log |
| `client_contact_info` | `clients` + `client_branches` (optional) | Primary contact to `clients` fields; extra contacts → JSON in `client_branches` | Dedupe by `name` + `phone` | Missing contact fields → drop |
| `client_provinces`, `cities` | `client_branches` | `province` and `city` into strings | Normalize by lowercase/trim | Missing province/city → NULL |

### 2.2 Contracts & rates
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `client_contracts` | `client_contracts` | `client_id`, `start_date`, `end_date`, `terms`, `is_active` | Dedupe by `client_id` + `start_date` | If dates invalid, set NULL and log |
| `client_contracts_rates`, `contract_rates` | `contract_rates` | `contract_id`, `guard_type`, `rate`, `overtime_rate` | Dedupe by `contract_id` + `guard_type` | Missing rate → skip and log |

### 2.3 Deployments & capacity
| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `client_guard_association` | `guard_deployments` | `guard_id`, `branch_id`, `shift_type`, `deployed_at`, `revoked_at`, `is_active` | Keep latest active deployment per guard; older → archived | Missing branch → skip; missing shift → default 'day' |
| `client_branch_guard_capacity_history` | `branch_capacity_history` | capacity fields moved to JSONB `from_capacity`/`to_capacity` | Dedupe by `branch_id` + `changed_at` | Missing capacity → set NULL, log |
| `client_branch_wise_guard_salary` | `contract_rates` (or payroll policy) | Map branch overrides into `contract_rates` or `payroll_items.computed_payload` | Dedupe by branch + guard type | Missing rate → skip |
| `client_branches_extra_guard_demands` | `attendance_exceptions` (optional) | Store as staffing exception | Dedupe by branch + date | Missing date → infer from created_at |

---

## 3) Inventory

| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `inventory_categories` | `inventory_categories` | `name` | Normalize by lowercase/trim | Missing name → drop |
| `inventory_products_names` | `inventory_product_types` | `name`, `category_id` | Dedupe by category + name | Missing category → skip |
| `inventory_products` | `inventory_products` | core product fields, `condition`, `status`, `serial_number`, `license_*` | Dedupe by `serial_number` or `license_number` | Missing serial/license → allow if category non-serialized (flag in metadata) |
| `inventory_assign_history`, `inventory_issued_to_guards` | `inventory_assignments` | `product_id`, `guard_id`, `branch_id`, `assigned_at`, `returned_at` | Dedupe by product + assigned_at | Missing assigned_at → set to created_at |
| `inventory_item_conditions`, `inventory_products_status` | `inventory_products` | Normalize condition/status values | Merge by lowercase name | Missing status → default 'available' |
| `inventory_non_reuseable_products` | `inventory_products` + `inventory_events` | Mark `metadata.non_reusable=true` and log events | N/A | N/A |
| `inventory_vendors`, `inventory_warranty_types` | `inventory_products.metadata` | Vendor/warranty into JSONB | Dedupe by vendor name | Missing vendor → omit |

---

## 4) Tickets

| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `tickets` | `tickets` | `title`, `description`, `category_id`, `priority_id`, `status_id`, `created_by`, `assigned_to`, `created_at` | Dedupe by `title` + `created_at` + `created_by` | Missing category/priority/status → map to defaults |
| `ticket_categories`, `ticket_priorities`, `ticket_statuses` | `ticket_categories`, `ticket_priorities`, `ticket_statuses` | `name`, `color` (priority) | Normalize by lowercase/trim | Missing name → drop |
| `ticket_comments` | `ticket_comments` | `ticket_id`, `content`, `created_by`, `created_at` | Dedupe by ticket + created_at + author | Missing content → drop |
| `ticket_attachments` | `ticket_attachments` | `ticket_id`, `file_path`, `file_name`, `uploaded_by`, `created_at` | Dedupe by ticket + file_name | Missing file_path → log and keep metadata |
| `ticket_users`, `ticket_modules`, `ticket_permissions` | `tickets` / `audit_logs` | Store assignments and module links in `tickets` or `audit_logs` | Dedupe by ticket + user | Missing user → skip |

---

## 5) Invoicing & Payments

| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `client_invoices` | `invoices` | `client_id`, `invoice_number`, `invoice_month`, `invoice_year`, `subtotal`, `tax_amount`, `total_amount`, `status`, `due_date` | Dedupe by `invoice_number` | Missing totals → recompute from line items |
| `client_invoices_details` | `invoice_line_items` | `invoice_id`, `branch_id`, `description`, `guard_type`, `quantity`, `rate`, `amount` | Dedupe by invoice + branch + description | Missing amount → compute `quantity * rate` |
| `invoice_payment_history` | `invoice_payments` | `invoice_id`, `amount`, `payment_date`, `payment_method`, `reference_no`, `recorded_by` | Dedupe by invoice + payment_date + amount | Missing payment date → use created_at |
| `invoice_statuses` | `invoices.status` | Normalize statuses to canonical: draft/sent/paid/overdue | Dedupe by status name | Unknown status → map to `draft` |
| `tax_rates` | `invoices.tax_amount` | Apply to recomputation only | N/A | Missing tax rates → keep stored `tax_amount` |
| `invoices_errors` | `audit_logs` | Store as `entity_type='invoice'` + error payload | N/A | N/A |

---

## 6) Users, Roles & Permissions

| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `users` | `profiles` (auth.users) | `full_name`, `contact_no`, `is_active`, `role_id`, `regional_office_id` | Dedupe by email or username | Missing auth email → create placeholder and force reset |
| `user_personal_information` | `profiles` | Merge extra profile fields | Dedupe by user_id | Missing fields → ignore |
| `custom_guard_roles`, `roles` | `roles` | Normalize role names | Merge duplicates by lowercase name | Missing name → skip |
| `custom_permissions`, `permissions` | `permissions` | Normalize module/action | Merge duplicates by (module, action) | Missing module/action → skip |
| `custom_role_permissions`, `role_has_permissions` | `role_permissions` | Map role_id + permission_id + scope | Dedupe by role + permission | Missing scope → default 'all' |
| `custom_user_permissions` | `user_role_overrides` | user-level allow/deny | Dedupe by user + permission | Missing allow/deny → skip |
| `users_logged_in_history`, `wrong_login_user_attempts` | `audit_logs` | Store as audit events | Dedupe by user + timestamp | Missing user → skip |
| `mail_queues_by_users` | `notifications` (optional) | Convert to pending notification records | Dedupe by user + subject + created_at | Missing user → skip |
| `manager_supervisor_association`, `branch_manager_association`, `client_user_association` | `user_scopes` | Convert into scope rows (regional/branch/client) | Dedupe by user + scope | Missing scope id → skip |

---

## 7) Reference Data, Audit, Reporting

| Legacy table | Canonical table | Key field mappings | Deduplication rules | Missing/invalid handling |
| --- | --- | --- | --- | --- |
| `audits` | `audit_logs` | Map entity_type, action, before/after | Dedupe by entity + action + created_at | Missing entity_id → log with NULL |
| `scheduled_reports`, `scheduled_*` | `scheduled_reports` | `name`, `report_type`, `cron_expr`, `filters`, `recipients` | Dedupe by name + report_type | Missing cron → disable `is_active=false` |
| `dashboard_*` | **Deprecated** (no canonical equivalent) | Replace with new UI configs | N/A | N/A |
| `guard_status_colors` | `guard_statuses.color` | Merge into `guard_statuses` | Dedupe by status | Missing color → default |

---

## 8) Deprecated or Consolidated Legacy Tables

### Deprecated (no canonical equivalent)
- `dashboard_main_options`, `dashboard_sub_options`, `dashboard_options_by_user_role`, `dashboard_options_by_users` (UI config to be rebuilt).
- `guard_attendance_years` (derived summary; recompute in new system).
- `guard_status_colors` (merged into `guard_statuses.color`).
- `inventory_non_reuseable_products` (modeled as metadata/events).
- `invoices_errors` (migrate as `audit_logs` only).

### Consolidated
- `guard_unpaid_salaries` + `guard_unpaid_salary` → `payroll_items.payment_status`.
- `guard_salary`, `guard_salary_posted`, `guards_paid_salary` → `payroll_runs` + `payroll_items`.
- `guard_history`, `guard_update_history`, `guard_status_by_col` → `guard_status_history` + `audit_logs`.
- `user_personal_information` → `profiles`.
- `custom_guard_roles` + `roles` → `roles`.
- `custom_permissions` + `permissions` → `permissions`.
- `custom_role_permissions` + `role_has_permissions` → `role_permissions`.

---

## 9) Missing/Invalid Data Policy (Global)

1. **Hard validation failures:**
   - Drop rows only when the entity cannot be linked (e.g., `client_branch` without `client_id`).
2. **Soft validation failures:**
   - Keep rows but flag in `metadata` or `personal_info.validation_errors`.
3. **Null-safe defaults:**
   - Use canonical defaults (e.g., `status='draft'`, `payment_status='unpaid'`, `is_active=true`), but record legacy value in JSONB when ambiguous.
4. **Date sanitation:**
   - If invalid, set to NULL and record raw value in `metadata.invalid_dates`.

---

## 10) Migration Timeline (Proposed)

| Phase | Weeks | Scope |
| --- | --- | --- |
| 1. Mapping & data profiling | 1-2 | Confirm schemas, row counts, field null rates, and mapping gaps |
| 2. ETL build & dry runs | 3-5 | Build extract/transform jobs, unit tests for mappings, and trial loads |
| 3. Deduplication & cleanup | 6-7 | Apply dedupe rules, normalize reference data, validate FK integrity |
| 4. Full migration run | 8 | Load all tables to canonical, generate validation reports |
| 5. Reconciliation & sign-off | 9 | Financial totals, headcount, attendance rollups, and audit sampling |
| 6. Cutover & freeze | 10 | Final delta migration, freeze legacy writes, go-live |

---

## 11) Validation Checklist

### Data integrity
- [ ] Row counts per entity match expected (post-dedupe deltas documented).
- [ ] All required foreign keys resolve (guard_id, client_id, branch_id, contract_id).
- [ ] No orphaned documents or attachments.

### Functional reconciliation
- [ ] Payroll totals per month match legacy (`gross_salary`, `net_salary`).
- [ ] Invoice totals per month match legacy (subtotal/tax/total).
- [ ] Attendance rollups per branch match legacy monthly totals.
- [ ] Inventory on-hand counts match legacy (per category + status).

### Security & access
- [ ] User roles map correctly; scoped access checks pass.
- [ ] Audit trail entries exist for critical entities.

### Spot checks
- [ ] Sample 20 guards: identity, status, documents, payroll history.
- [ ] Sample 10 clients: branches, contracts, deployments.
- [ ] Sample 10 invoices: line items, payments, status.

---

## References
- Legacy tables and descriptions are sourced from `system_analysis.md`.
- Canonical tables are sourced from `security_erp_system_blueprint_next.md`.
