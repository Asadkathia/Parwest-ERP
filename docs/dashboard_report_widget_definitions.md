# Dashboard & Report Widget Definitions (Data Sources, Filters, Date Logic, Formulas)

**Scope:** This document defines every dashboard/report widget referenced in `guard_erp_page_by_page_design (1).md`, with precise data sources, filters, date logic, and formulas. It also reconciles those widgets against the SRS requirements in `3. Software Requirements Specification.docx`.

## Global conventions (applies to all widgets)
- **Org scoping:** All queries apply `org_id` (RLS). Manager/Supervisor use `regional_office_id`/branch scope; client portal uses `client_id` scope.
- **Date “today”:** Use server-local date at 00:00–23:59 (or org time zone). When a widget says “today,” it means the current business day.
- **Status filtering:** Use canonical workflow statuses (e.g., `guard_status`, `attendance_status`, `invoice_status`, `payroll_status`).

---

# 1) Role-Based Dashboards (D0)

## D0.1 Super Admin / Admin Dashboard (Command Center)
### KPI: **Total Active Guards**
- **Data source:** `vw_guard_case_summary` or `guards`
- **Filters:** `org_id`, optional region
- **Date logic:** as of today
- **Formula:** `count(guards)` where `guard_status IN ('Enrolled','Pending Deployment','Deployed','Default')` and `guard_status NOT IN ('Resigned','Blocked')`.

### KPI: **Deployed Today**
- **Data source:** `vw_branch_deployment_status`, `guard_deployments`
- **Filters:** `org_id`, optional region
- **Date logic:** “today” = current date
- **Formula:** count of `guard_deployments` where `start_date <= today` and (`end_date IS NULL` or `end_date >= today`).

### KPI: **Attendance Completion %**
- **Data source:** `vw_attendance_daily_summary`, `guard_attendance`
- **Filters:** `org_id`, optional region/branch
- **Date logic:** “today” or selected date
- **Formula:** `attendance_marked / attendance_expected * 100`, where `attendance_expected` = scheduled guards or required headcount for the day, and `attendance_marked` = rows with `attendance_status IN ('Present','Absent','Leave','Late')`.

### KPI: **Payroll Status (Current Month)**
- **Data source:** `vw_payroll_run_summary`, `payroll_runs`, `payroll_items`
- **Filters:** `org_id`
- **Date logic:** `pay_period_month = current_month` (or fiscal period)
- **Formula:**
  - `run_status` = latest payroll run status for current month
  - `completion_pct = finalized_items / total_items * 100`

### KPI: **Outstanding Invoices**
- **Data source:** `vw_invoice_aging`, `invoices`, `invoice_payments`
- **Filters:** `org_id`
- **Date logic:** as-of today
- **Formula:** sum of `invoice_total - total_payments` for `invoice_status IN ('Unpaid','Partially Paid')`.

### KPI: **Overdue Invoices**
- **Data source:** `vw_invoice_aging`, `invoices`
- **Filters:** `org_id`
- **Date logic:** `due_date < today`
- **Formula:** sum of `invoice_total - total_payments` where `invoice_status IN ('Unpaid','Partially Paid')` and `due_date < today`.

### Alert: **Missing Attendance (Today)**
- **Data source:** `vw_attendance_daily_summary`, `guard_attendance`
- **Filters:** `org_id`, optional region
- **Date logic:** today
- **Formula:** list branches/guards with `attendance_expected > attendance_marked`.

### Alert: **Expiring Licenses/Docs (Next 30 Days)**
- **Data source:** `guard_documents`, `vw_guard_case_summary`
- **Filters:** `org_id`, doc_type in required set (CNIC/medical/training/etc.)
- **Date logic:** `expiry_date BETWEEN today AND today + 30 days`
- **Formula:** count or list guards/docs.

### Alert: **Pending Verifications**
- **Data source:** `guard_verifications`
- **Filters:** `org_id`
- **Date logic:** open-ended
- **Formula:** count where `verification_status = 'Pending'`.

### Alert: **Contract Ending Soon**
- **Data source:** `client_contracts`
- **Filters:** `org_id`
- **Date logic:** `end_date BETWEEN today AND today + 30/60 days` (configurable)
- **Formula:** count/list of contracts.

### Alert: **Overdue Payments**
- **Data source:** `invoices`, `invoice_payments`
- **Filters:** `org_id`
- **Date logic:** `due_date < today`
- **Formula:** list invoices with `balance > 0`.

### Trend: **Attendance Trend (7/30 days)**
- **Data source:** `vw_attendance_daily_summary`
- **Filters:** `org_id`, optional region
- **Date logic:** rolling 7-day or 30-day window ending today
- **Formula:** daily `attendance_completion_pct` time series.

### Trend: **Invoice Aging Distribution**
- **Data source:** `vw_invoice_aging`, `invoices`
- **Filters:** `org_id`
- **Date logic:** as-of today
- **Formula:** bucket unpaid balances by `age_days = today - due_date` into `0–30`, `31–60`, `61–90`, `90+`.

### Widget: **Critical Incidents / Tickets**
- **Data source:** `tickets`
- **Filters:** `org_id`, `priority IN ('High','Critical')`, `status IN ('Open','In Progress')`
- **Date logic:** open-ended
- **Formula:** list top N by `priority`, `created_at`.

---

## D0.2 Manager Dashboard (Operations Head)
### KPI: **Deployed vs Capacity**
- **Data source:** `vw_branch_deployment_status`
- **Filters:** `org_id`, `regional_office_id`
- **Date logic:** today
- **Formula:** `deployed_count / required_headcount * 100`.

### KPI: **Staffing Gaps**
- **Data source:** `vw_branch_deployment_status`
- **Filters:** `org_id`, region
- **Date logic:** today
- **Formula:** `required_headcount - deployed_count` (only positives). Sum and top branches.

### KPI: **Attendance Completion %**
- **Data source:** `vw_attendance_daily_summary`
- **Filters:** `org_id`, region
- **Date logic:** today
- **Formula:** same as Admin.

### KPI: **Absences Today**
- **Data source:** `guard_attendance`, `vw_attendance_daily_summary`
- **Filters:** `org_id`, region
- **Date logic:** today
- **Formula:** count of `attendance_status = 'Absent'`.

### KPI: **Open Tickets (My Region)**
- **Data source:** `tickets`
- **Filters:** `org_id`, region, `status IN ('Open','In Progress')`
- **Date logic:** open-ended
- **Formula:** count.

### Alert: **Branches Below Capacity**
- **Data source:** `vw_branch_deployment_status`
- **Filters:** `org_id`, region
- **Date logic:** today
- **Formula:** list branches where `deployed_count < required_headcount`.

### Alert: **Repeated Absences**
- **Data source:** `guard_attendance`
- **Filters:** `org_id`, region
- **Date logic:** rolling 7/30 days
- **Formula:** guards with `absent_count >= threshold` (policy-driven).

### Alert: **Guards Pending Redeployment**
- **Data source:** `guards`, `guard_status_history`
- **Filters:** `org_id`, region
- **Date logic:** today
- **Formula:** guards with `guard_status = 'Pending Deployment'` for `>= 7 days`.

### Alert: **High-Risk Exceptions**
- **Data source:** `guard_attendance_exceptions`, `tickets`
- **Filters:** `org_id`, region
- **Date logic:** rolling 30 days
- **Formula:** exceptions labeled `severity = High`.

### Mini Table: **Branches with Gaps (Top 10)**
- **Data source:** `vw_branch_deployment_status`
- **Filters:** `org_id`, region
- **Date logic:** today
- **Formula:** sort by `required_headcount - deployed_count` desc.

### Mini Table: **Absent Guards Today (Top 10)**
- **Data source:** `guard_attendance`
- **Filters:** `org_id`, region
- **Date logic:** today
- **Formula:** list guard rows with `attendance_status = 'Absent'`.

### Mini Table: **Pending Approvals**
- **Data source:** `guard_attendance_exceptions`
- **Filters:** `org_id`, region, `approval_status = 'Pending'`
- **Date logic:** open-ended
- **Formula:** list exceptions.

---

## D0.3 Supervisor Dashboard (Field Ops)
### Widget: **My Branches Today**
- **Data source:** `vw_branch_deployment_status`
- **Filters:** `org_id`, `branch_id IN user_scopes`
- **Date logic:** today
- **Formula:** per-branch cards with `required_headcount`, `deployed_count`, `absent_count`.

### Widget: **Attendance Completion Progress (Today)**
- **Data source:** `vw_attendance_daily_summary`
- **Filters:** `org_id`, branches in scope
- **Date logic:** today
- **Formula:** `attendance_marked / attendance_expected * 100`.

### Widget: **Absent List + Replacement Needs**
- **Data source:** `guard_attendance`, `guard_deployments`
- **Filters:** `org_id`, branch scope
- **Date logic:** today
- **Formula:** list `attendance_status='Absent'`; replacement need = missing count per branch.

### Widget: **Ticket Queue Assigned to Me**
- **Data source:** `tickets`
- **Filters:** `org_id`, `assignee_id = current_user`, `status IN ('Open','In Progress')`
- **Date logic:** open-ended
- **Formula:** list tickets by `priority`, `created_at`.

---

## D0.4 HR/Admin Dashboard (Personnel)
### KPI: **New Enrollments**
- **Data source:** `guards`
- **Filters:** `org_id`
- **Date logic:** rolling 7/30 days (configurable)
- **Formula:** count where `created_at BETWEEN start_date AND end_date`.

### KPI: **Documents Missing**
- **Data source:** `guard_documents`, `guards`
- **Filters:** `org_id`, required document types
- **Date logic:** today
- **Formula:** guards missing required docs = `required_docs_count - uploaded_docs_count`.

### KPI: **Verifications Pending**
- **Data source:** `guard_verifications`
- **Filters:** `org_id`
- **Date logic:** open-ended
- **Formula:** count where `verification_status = 'Pending'`.

### KPI: **Guards Not Deployed**
- **Data source:** `guards`, `guard_status_history`
- **Filters:** `org_id`
- **Date logic:** today
- **Formula:** count `guard_status IN ('Pending Deployment','Default')`.

### KPI: **Terminations Awaiting Clearance**
- **Data source:** `guard_clearance`
- **Filters:** `org_id`
- **Date logic:** open-ended
- **Formula:** count where `clearance_status = 'Pending'`.

### Alert: **Expired/Expiring CNIC/Medical/Training Docs**
- **Data source:** `guard_documents`
- **Filters:** `org_id`, doc types in policy
- **Date logic:**
  - Expired: `expiry_date < today`
  - Expiring: `expiry_date BETWEEN today AND today + 30 days`
- **Formula:** list guards by doc type.

### Alert: **Verification Failures**
- **Data source:** `guard_verifications`
- **Filters:** `org_id`
- **Date logic:** rolling 30 days
- **Formula:** list where `verification_status = 'Failed'`.

### Alert: **Re-Verification Due**
- **Data source:** `guard_verifications`
- **Filters:** `org_id`
- **Date logic:** `next_review_date <= today`
- **Formula:** list guards for follow-up.

### Mini Table: **Missing Required Documents**
- **Data source:** `guard_documents`
- **Filters:** `org_id`
- **Date logic:** today
- **Formula:** list guards missing required docs.

### Mini Table: **Verification Pending**
- **Data source:** `guard_verifications`
- **Filters:** `org_id`
- **Date logic:** open-ended
- **Formula:** list pending verification rows.

### Mini Table: **Clearance Pending**
- **Data source:** `guard_clearance`
- **Filters:** `org_id`
- **Date logic:** open-ended
- **Formula:** list pending clearances.

---

## D0.5 Accountant Dashboard (Finance)
### KPI: **Current Payroll Run Status**
- **Data source:** `payroll_runs`
- **Filters:** `org_id`
- **Date logic:** current month
- **Formula:** latest `payroll_runs.status` for current month.

### KPI: **Exceptions Blocking Finalize**
- **Data source:** `payroll_items`
- **Filters:** `org_id`, `item_status = 'Exception'`
- **Date logic:** current month
- **Formula:** count of exception items in active run.

### KPI: **Estimated Payout**
- **Data source:** `payroll_items`
- **Filters:** `org_id`, current run
- **Date logic:** current month
- **Formula:** sum of `net_pay`.

### KPI: **Outstanding Total**
- **Data source:** `invoices`, `invoice_payments`
- **Filters:** `org_id`
- **Date logic:** as-of today
- **Formula:** sum `invoice_total - total_payments` (unpaid/partial).

### KPI: **Overdue Total**
- **Data source:** `invoices`, `invoice_payments`
- **Filters:** `org_id`
- **Date logic:** `due_date < today`
- **Formula:** sum of overdue balances.

### KPI: **Invoices Due This Week**
- **Data source:** `invoices`
- **Filters:** `org_id`
- **Date logic:** `due_date BETWEEN today AND today + 7 days`
- **Formula:** count or sum of balances.

### Chart: **Invoice Aging (0–30/31–60/61–90/90+)**
- **Data source:** `vw_invoice_aging`
- **Filters:** `org_id`
- **Date logic:** as-of today
- **Formula:** bucket unpaid balances by `age_days = today - due_date`.

### Mini Table: **Payroll Exceptions**
- **Data source:** `payroll_items`
- **Filters:** `org_id`, `item_status = 'Exception'`
- **Date logic:** current month
- **Formula:** list rows by severity/amount.

### Mini Table: **Top Overdue Clients**
- **Data source:** `vw_invoice_aging`, `invoices`
- **Filters:** `org_id`
- **Date logic:** as-of today
- **Formula:** group by `client_id`, sum overdue balances, sort desc.

### Mini Table: **Payments Recorded Today**
- **Data source:** `invoice_payments`
- **Filters:** `org_id`
- **Date logic:** `payment_date = today`
- **Formula:** list payments.

---

## D0.6 Guard Dashboard (Optional)
### Widget: **Current Assignment**
- **Data source:** `guard_deployments`
- **Filters:** `guard_id = current_user.guard_id`
- **Date logic:** today
- **Formula:** current deployment where `start_date <= today` and (`end_date IS NULL` or `end_date >= today`).

### Widget: **Attendance Calendar**
- **Data source:** `guard_attendance`
- **Filters:** guard scope
- **Date logic:** month view (selected month)
- **Formula:** daily attendance status.

### Widget: **Payslips**
- **Data source:** `payroll_items`
- **Filters:** guard scope
- **Date logic:** month/year
- **Formula:** list payroll items with `net_pay` and `period`.

### Widget: **Requests (Leave/Issue Report)**
- **Data source:** `tickets` or `leave_requests`
- **Filters:** guard scope
- **Date logic:** open-ended
- **Formula:** list submitted items by status.

---

## D0.7 Client Portal Dashboard
### Widget: **Outstanding Invoices + Due Dates**
- **Data source:** `invoices`, `invoice_payments`
- **Filters:** `client_id` scope
- **Date logic:** as-of today
- **Formula:** list invoices where `balance > 0`, show `due_date`.

### Widget: **Invoice History + PDF Downloads**
- **Data source:** `invoices`, `invoice_line_items`
- **Filters:** client scope
- **Date logic:** date range filter
- **Formula:** list invoices with totals.

### Widget: **Payments History**
- **Data source:** `invoice_payments`
- **Filters:** client scope
- **Date logic:** date range filter
- **Formula:** list payments.

### Widget: **Ticket Status**
- **Data source:** `tickets`
- **Filters:** client scope
- **Date logic:** open-ended
- **Formula:** count by status.

---

## D1 Command Center (Admin Variant)
> Reuses Admin widgets plus the following context panel widgets.

### Widget: **My Tasks (Approvals/Pending Actions)**
- **Data source:** `workflow_tasks`, `guard_verifications`, `attendance_exceptions`
- **Filters:** `assignee_id = current_user`
- **Date logic:** open-ended
- **Formula:** list pending tasks by due date.

### Widget: **Critical Expiries**
- **Data source:** `guard_documents`, `inventory_assets`
- **Filters:** `org_id`, `expiry_date <= today + 30 days`
- **Date logic:** next 30 days
- **Formula:** list expiring items.

### Widget: **Overdue Invoices (Summary)**
- **Data source:** `vw_invoice_aging`
- **Filters:** `org_id`, overdue bucket
- **Date logic:** as-of today
- **Formula:** sum of balances in overdue buckets.

---

# 2) Inventory Dashboard (I1)

## I1 Inventory Dashboard
### KPI: **Total Assets**
- **Data source:** `inventory_assets`
- **Filters:** `org_id`
- **Date logic:** as-of today
- **Formula:** count of all assets.

### KPI: **Assigned**
- **Data source:** `inventory_assets`, `inventory_assignments`
- **Filters:** `org_id`, `status = 'Assigned'`
- **Date logic:** today
- **Formula:** count assets with active assignment.

### KPI: **In Stock**
- **Data source:** `inventory_assets`
- **Filters:** `org_id`, `status = 'In Stock'`
- **Date logic:** today
- **Formula:** count in-stock assets.

### KPI: **Expiring**
- **Data source:** `inventory_assets`
- **Filters:** `org_id`, `expiry_date <= today + 30 days`
- **Date logic:** next 30 days
- **Formula:** count expiring assets/licenses.

### Widget: **Expiry List**
- **Data source:** `inventory_assets`
- **Filters:** `org_id`, optional category
- **Date logic:** `expiry_date <= today + 30 days`
- **Formula:** list assets sorted by `expiry_date`.

---

# 3) Reports Library (R1)

## R1.1 Attendance Summary Report
- **Data source:** `guard_attendance`, `vw_attendance_daily_summary`
- **Filters:** date range, region, branch, client, supervisor, guard status
- **Date logic:** user-selected range; default current month
- **Formulas:**
  - Attendance completion % = `marked / expected * 100`
  - Absence rate = `absent / expected * 100`
  - Late rate = `late / expected * 100`

## R1.2 Payroll Summary Report
- **Data source:** `payroll_runs`, `payroll_items`
- **Filters:** month/year, region, client, guard type, payroll status
- **Date logic:** payroll period (monthly)
- **Formulas:**
  - Gross payroll = sum(`gross_pay`)
  - Deductions total = sum(`deductions`)
  - Net payroll = sum(`net_pay`)

## R1.3 Invoice Aging Report
- **Data source:** `vw_invoice_aging`, `invoices`
- **Filters:** as-of date, client, region, invoice status
- **Date logic:** `as_of_date` controls age calculation
- **Formulas:** aging buckets by `age_days = as_of_date - due_date`.

## R1.4 Deployment Strength Report
- **Data source:** `guard_deployments`, `branch_requirements`, `vw_branch_deployment_status`
- **Filters:** date range, region, client, branch, supervisor
- **Date logic:** snapshot for selected date or average over range
- **Formulas:**
  - Deployed count = active deployments on date
  - Required headcount = requirement
  - Staffing gap = `required - deployed`
  - Deployment duration = `end_date - start_date`

## R1.5 Inventory Expiry Report
- **Data source:** `inventory_assets`
- **Filters:** date range, category, location, status
- **Date logic:** expiry window (default next 30 days)
- **Formulas:** count by category; days to expiry = `expiry_date - today`.

---

# 4) SRS Reconciliation (Dashboard/Report Coverage)

| SRS Requirement | Covered Widget/Report | Notes |
| --- | --- | --- |
| Real-time dashboards & alerts | Admin/Manager/Supervisor dashboards, Command Center | Widgets defined above cover KPI/alerts. |
| CNIC expiry tracking | HR dashboard alerts + Command Center critical expiries | Uses `guard_documents.expiry_date`. |
| Age & policy compliance (max age) | HR dashboard alert (add filter `age > policy_age_limit`) | Needs guard DOB + policy settings. |
| Insurance/EOBI/Social Security capacity | Add KPI/alert on HR/Admin dashboards: `filled vs capacity` | Use scheme enrollment tables + capacity settings. |
| Live deployment dashboard | Manager/Supervisor/Deployment Strength report | Uses `vw_branch_deployment_status`. |
| Daily shortage report (5:00 PM) | Deployment Strength report (scheduled) + Manager KPI “Staffing Gaps” | Schedule report at 5:00 PM. |
| Guard rotation management (lock period) | Operations dashboard alerts for redeployment blocks | Requires deployment history + lock settings. |
| Undue shuffling detection (>2 changes/week/month) | Add alert/report on Manager dashboard | Query deployment history per guard. |
| Client-wise deployment report | Deployment Strength report + filter by client/location | Include replacements in history. |
| Uniform/shoes issuance validity | Inventory Expiry report + Inventory dashboard “Expiring” | Use issuance date + validity windows. |
| Training monitoring dashboards | HR dashboard or dedicated Training dashboard (monthly/quarterly) | Requires training records. |
| Salary reports (guard/client/region) | Payroll Summary report with group-by | Add group-by options. |
| Billing reports (client/region) | Invoice Aging report with group-by | Add group-by options. |
| Profit & loss analysis (salary vs billing) | Finance dashboard custom KPI/report | Compute `billing_total - payroll_total`, margin % and threshold alerts. |
| CEO/HR/Operations/Finance dashboards | Admin/HR/Manager/Accountant dashboards | Role dashboards map to SRS. |
| Armed deployment / weapon compliance | Not in dashboards list; add Inventory/Weapons dashboard or report | Use weapon issuance + training compliance tables. |
| Audit logs | Optional Audit Highlights widget + Audit Search page | Uses `audit_logs`. |

