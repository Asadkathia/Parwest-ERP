# Guard Management ERP — Page-by-Page UI Design (Light Mode, Nexus-Style)

**Stack:** Next.js 14 (App Router) · Tailwind CSS · shadcn/ui (Radix) · TanStack Table · React Hook Form + Zod · Framer Motion · Lucide · Recharts  
**Backend:** Supabase (Auth + Postgres + RLS + Storage + RPC)

**Design Constraint:** Replicate the *layout rhythm, spacing discipline, component system, and neutral + blue accent palette* of the reference Nexus-style UI **in light mode only**.  
**Content Constraint:** All objects, workflows, labels, and actions follow Guard ERP requirements and the system blueprint.

---

## 0) Design Tokens (Light Mode Only)

> These tokens are the “source of truth” for visual consistency across every page.

### Color tokens
- **App background:** `--bg = #F8FAFC` (soft off-white)
- **Surface/card:** `--surface = #FFFFFF`
- **Sidebar bg:** `--sidebar = #EEF2F7` (light neutral, slightly darker than canvas)
- **Border/subtle:** `--border = #E2E8F0`
- **Text primary:** `--text = #0F172A`
- **Text muted:** `--muted = #64748B`
- **Accent (primary):** `--primary = #2563EB` (cool blue)
- **Accent soft:** `--primary-soft = #DBEAFE`
- **Success:** `--success = #16A34A`, **Warning:** `--warning = #F59E0B`, **Error:** `--error = #DC2626`, **Info:** `--info = #0284C7`

### Radius, elevation, spacing
- **Radius:** base `12px`, cards/buttons `16px` (2xl feel)
- **Elevation:** soft shadows only (no heavy borders)
- **Spacing rhythm:** 4/8/12/16/24/32 px increments
- **Typography:** Inter/Sora-style; enable tabular numbers for finance tables.

### Component variants (CVA rule)
- `Button`: `primary | secondary | ghost | destructive`
- `Badge`: `status` variants (note: semantic colors only)
- `Card`: `default | subtle | warning | error`
- `Table density`: `compact` default with optional `comfortable`

---

## 1) Global App Shell (All Pages)

### Layout (Fixed)
**Three-column** persistent shell:
1. **Left Sidebar** (240px, collapsible)
2. **Main Workspace** (fluid)
3. **Right Context Panel** (320px, sticky)

### Global components
- Sidebar: `SidebarNavigation`, `NavGroup`, `NavItem`, `CollapseToggle`
- Top bar: `GlobalSearch`, `CmdKPalette`, `Notifications`, `UserMenu`
- Main: `PageHeader`, `Breadcrumbs`, `InlineTabs`, `PrimaryCTA`, `SecondaryActionsMenu`
- Right: `ContextSidebar` with `ContextCards`, `QuickStats`, `Alerts`
- System states: `LoadingSkeleton`, `EmptyState`, `ErrorState`, `PermissionDenied`

### Navigation (ERP Modules)
Dashboard · Guards · Deployments · Attendance · Payroll · Billing · Inventory · Tickets · Reports · Settings

---

## 2) Role & Permission UX Rules (UI + RLS Aligned)

> RLS enforces; UI reflects.

### Roles (baseline)
- **Super Admin/Admin** (full org)
- **Manager** (operations head)
- **Supervisor** (field ops)
- **Accountant** (finance)
- **HR/Admin** (guard lifecycle)
- **Inventory Officer**
- **Auditor (read-only)**
- **Client Portal User** (optional, external)

### UI behavior for restricted actions
- If user can **view but not edit** → show disabled action with tooltip: “Insufficient permission”.
- If user cannot view entity → `PermissionDenied` page.

---

## 3) Page-by-Page Designs

> Each page includes: Purpose, Layout, Components, Data, Actions (RPC), Validation, States, Permissions.

---

# AUTH

## A1) Login — `/login`
**Purpose:** Staff login via Supabase Auth.

**Layout:** Centered card, minimal background, no sidebar.  
**Components:** `AuthCard`, `InputEmail`, `InputPassword`, `ButtonPrimary`, `LinkForgotPassword`.  
**Actions:** Supabase `signInWithPassword`.  
**States:** loading, invalid credentials, locked user.  

## A2) Forgot Password — `/forgot-password`
**Purpose:** Send reset link.  
**Components:** `AuthCard`, email input, success toast.

## A3) Reset Password — `/reset-password`
**Purpose:** Set new password after token.  
**Validation:** strong password rules.

---

# DASHBOARD (Command Center)


## D0) Role-Based Dashboards (Derived from Current System Roles)

Roles and hierarchy are taken from the legacy system analysis (to keep continuity and policy alignment):
- **SUPER ADMIN / ADMIN** (full access)
- **MANAGER** (Operations Head, role_id = 5)
- **SUPERVISOR** (Field Operations, role_id = 3)
- **ACCOUNTANT** (Financial access)
- **HR/ADMIN** (Personnel management)
- **GUARD (optional)** (limited access, mostly via mobile)
- **CLIENT PORTAL USER** (external access)

**Rule:** Every authenticated user lands on a **role-specific dashboard** that reflects what they need to do today.  
Implementation options:
- **Single route** `/dashboard` renders role-aware widgets based on role + permission + scope (recommended).
- Optional aliases: `/dashboard/admin`, `/dashboard/ops`, `/dashboard/hr`, `/dashboard/finance` for direct linking.

### How dashboards align with DB + RLS
- All dashboard queries use **org_id scoping** and **RLS** to automatically limit data.
- Managers/Supervisors see only their **regional/branch scope**.
- Client portal users see only their **client_id scoped** data (invoices, tickets).
- Dashboards are built from **read models** (views) for speed:
  - `vw_guard_case_summary`
  - `vw_branch_deployment_status`
  - `vw_attendance_daily_summary`
  - `vw_payroll_run_summary`
  - `vw_invoice_aging`
  - `vw_inventory_expiry` (only if inventory module exists in permissions)
  - `audit_logs` (only if audit module exists in permissions)

### Common widget library (reused across roles)
- KPI stat cards (`KPIStatCard`)
- Alerts list (`AlertCard`)
- Task queue (`TaskQueue`)
- Mini tables (`MiniTable`)
- Trends (`LineChart` / `BarChart`)
- Quick actions (`ActionTiles`)
- Context rail shows “My scope” and “Critical alerts”

---

### D0.1 SUPER ADMIN / ADMIN Dashboard — `/dashboard` (admin variant)
**Focus:** Whole-org command center + escalations across all regions and modules.

**Primary widgets**
- KPIs: Total active guards, deployed today, attendance completion %, payroll status (current month), outstanding invoices, overdue invoices
- Alerts: missing attendance (today), expiring licenses/docs (next 30 days), pending verifications, contract ending soon (if configured), overdue payments
- Trends: attendance trend (7/30 days), invoice aging distribution
- “Critical Incidents / Tickets” (top priority tickets)

**Quick actions (drawers)**
- Add Guard, Add Client/Branch, Deploy Guard, Mark Attendance, Generate Payroll Run, Generate Invoices, Create User/Role

**Data sources**
- Views: `vw_guard_case_summary`, `vw_branch_deployment_status`, `vw_attendance_daily_summary`, `vw_payroll_run_summary`, `vw_invoice_aging`
- Optional: `vw_inventory_expiry`, `audit_logs`

**Permissions**
- Full access. Also sees “System Health” card: failed jobs/exports, pending approvals.

---

### D0.2 MANAGER Dashboard (Operations Head, role_id=5) — `/dashboard` (ops variant)
**Focus:** Deployment strength + compliance for their region(s).

**Primary widgets**
- KPIs: deployed vs capacity, staffing gaps, attendance completion %, absences today, open tickets in my region
- Alerts: branches below capacity, repeated absences, guards pending redeployment, high-risk exceptions
- Mini tables:
  - “Branches with gaps” (top 10)
  - “Absent guards today” (top 10)
  - “Pending approvals” (attendance exception approvals if used)

**Quick actions**
- Open Deployment Matrix (pre-filtered to region)
- Deploy / Swap / Revoke deployment
- Approve exceptions (if enabled)
- Broadcast instructions/notes (optional feature)

**Data sources**
- Views: `vw_branch_deployment_status`, `vw_attendance_daily_summary`, `vw_guard_case_summary`
- Tables: `guard_deployments`, `guard_attendance`, `tickets`

**RLS alignment**
- RLS restricts to manager’s **regional_office_id** / region scope.

---

### D0.3 SUPERVISOR Dashboard (Field Ops, role_id=3) — `/dashboard` (field variant)
**Focus:** Today’s operations for assigned branches.

**Primary widgets**
- “My Branches Today” (branch cards with capacity/deployed/absent)
- Attendance completion progress (today) per branch
- “Absent list” + replacement needs
- Ticket queue assigned to me (if ticketing enabled)
- Quick notes/instructions panel (optional)

**Quick actions**
- Mark Attendance (opens Attendance Daily pre-filled with branch + today)
- Request replacement (creates ticket or ops request)
- Deploy guard (only if supervisor has permission)
- Call/notify quick actions (UI only unless integrated)

**Data sources**
- Views: `vw_branch_deployment_status`, `vw_attendance_daily_summary`
- Tables: `guard_attendance`, `guard_deployments`, `tickets`

**RLS alignment**
- RLS restricts to supervisor’s `user_scopes` branch list or assigned branches.

---

### D0.4 HR/ADMIN Dashboard (Personnel Mgmt) — `/dashboard` (hr variant)
**Focus:** Guard lifecycle pipeline and compliance.

**Primary widgets**
- Pipeline KPIs: new enrollments, documents missing, verifications pending, guards not deployed, terminations awaiting clearance
- Alerts: expired/expiring CNIC/medical/training docs, verification failures, re-verification due
- Mini tables:
  - “Missing required documents”
  - “Verification pending”
  - “Clearance pending”

**Quick actions**
- Enroll Guard (wizard)
- Upload documents
- Start/complete verification
- Change guard status (workflow-driven)
- Start clearance checklist

**Data sources**
- Tables: `guards`, `guard_documents`, `guard_verifications`, `guard_status_history`, `guard_clearance`
- View: `vw_guard_case_summary`

**RLS alignment**
- Scoped to HR office region if applicable; Admin can see all.

---

### D0.5 ACCOUNTANT Dashboard (Finance) — `/dashboard` (finance variant)
**Focus:** Payroll + invoicing + collections.

**Primary widgets**
- Payroll: current payroll run status, exceptions blocking finalize, estimated payout
- Billing: outstanding total, overdue total, invoices due this week
- Invoice aging chart (0–30, 31–60, 61–90, 90+)
- Mini tables:
  - “Payroll exceptions”
  - “Top overdue clients”
  - “Payments recorded today”

**Quick actions**
- Generate payroll run
- Finalize payroll (confirmation modal)
- Generate invoices
- Record payment (drawer)
- Export payroll/invoice PDFs

**Data sources**
- Views: `vw_payroll_run_summary`, `vw_invoice_aging`
- Tables: `payroll_runs`, `payroll_items`, `invoices`, `invoice_payments`

**RLS alignment**
- Finance access limited to org/region per policy.

---

### D0.6 GUARD Dashboard (Optional System User) — `/dashboard` (guard variant)
**Focus:** Personal info + duty + payslips (mostly mobile-first; web minimal).

**Primary widgets**
- Current assignment (branch, shift, reporting instructions)
- Attendance calendar (read-only or self-check if allowed)
- Payslips (download/view)
- Requests: leave request, issue/report (creates ticket)

**Quick actions**
- Submit leave request
- Raise ticket / incident report
- View documents (read-only)

**Data sources**
- Tables: `guard_deployments` (current), `guard_attendance`, `payroll_items` (only own), `tickets` (only own)

**RLS alignment**
- Guard can access only `guard_id = auth.uid()` mapped or explicit link table.

---

### D0.7 CLIENT PORTAL USER Dashboard (External) — `/portal/dashboard`
**Focus:** Billing transparency + support.

**Primary widgets**
- Outstanding invoices + due dates
- Invoice history + PDF downloads
- Payments history
- Ticket status (open/closed)

**Quick actions**
- Download invoice PDF
- Raise support ticket
- Update billing contact (optional)

**Data sources**
- Tables: `invoices`, `invoice_line_items`, `invoice_payments`, `tickets`
- View: `vw_invoice_aging` (client-scoped)

**RLS alignment**
- Client portal user sees only `client_id` in their scope.

---

### Optional modules (Inventory, Audit) without adding new “roles”
The legacy system includes Inventory and Audit modules. If your RBAC grants access to these modules, the same role dashboards automatically surface:
- **Inventory Expiry** widgets (for Admin/Manager/HR as permitted)
- **Audit Highlights** widget (for Admin/Manager/Accountant/HR as permitted)

## D1) Command Center (Admin Variant) — `/dashboard`
**Purpose:** Operational overview and action launchpad.

**Main workspace**
- Header: “Command Center” + date + region selector (if scoped)
- Sections:
  1. KPI row (`KPIStatCard` x 6)
  2. Alerts feed (`AlertCard` list)
  3. Quick Actions (`ActionTiles`)
  4. Trends (`LineChart`, `BarChart`)

**Right context panel**
- “My Tasks” (approvals / pending actions)
- “Critical Expiries” (licenses/docs)
- “Overdue Invoices” summary

**Data (views)**
- `vw_guard_status_distribution`
- `vw_attendance_daily_summary`
- `vw_invoice_aging`
- `vw_inventory_expiry`

**Actions (RPC)**
- Open drawers: Add Guard, Deploy Guard, Mark Attendance, Generate Payroll, Generate Invoices

**Permissions**
- All roles can view; cards shown based on module access.

---

# GUARDS WORKSPACE

## G1) Guards List — `/guards`
**Purpose:** Search/filter guards, bulk actions.

**Main workspace**
- Header: Guards + actions: `Add Guard` (drawer), `Export`
- `FilterBar`: status, designation, region, branch, verification, loan
- `SavedViews` dropdown
- `DataTable` (compact)

**Right context panel**
- “Guard Alerts” (pending verifications, expiring docs)
- “Quick Stats” (active, deployed, pending)

**Data**
- `vw_guard_case_summary` (guard + current status + current deployment + region)

**Row actions**
- View case file
- Change status (workflow)
- Start deployment (if eligible)
- Upload document

**Bulk actions**
- Export
- Change status (if allowed)
- Assign region

**States**
- Empty: “No guards found. Add your first guard.”
- Loading skeleton
- Permission-denied on action buttons

**Permissions**
- HR/Admin: full CRUD
- Supervisor: read + limited operational actions
- Accountant: read only (no edits)
- Auditor: read only

---

## G2) Create Guard (Drawer) — from `/guards`
**Purpose:** Guided guard enrollment.

**Drawer: multi-step wizard**
1. Identity & Basic Info (CNIC, name, father name, DOB, contact)
2. Address & Personal (JSONB: education, blood group, etc)
3. Bank Account
4. Required Documents (upload checklist)
5. Review & Submit

**Components**
- `Stepper`
- `FormSectionCard`
- `UploadDropzone` (Supabase Storage)
- `RequiredDocsChecklist`

**Validation**
- CNIC format + uniqueness
- Required docs presence
- Contact format

**Actions**
- Insert guard + related tables
- Upload docs to bucket `guard-documents`

---

## G3) Guard Case File — `/guards/[id]`
**Purpose:** Primary object workspace for one guard.

**Header**
- Title: Guard Name + ID
- Status badge (semantic)
- Primary CTA (contextual): Deploy / Verify / Start Clearance
- Secondary actions: Edit, Print Summary, Add Loan, Upload Doc

**Workflow Stepper**
Enrolled → Verified → Deployed → Active → Terminated → Cleared  
(Clickable nodes show stage history; transitions via workflow rules.)

**Tabs**
1. Overview
2. Documents
3. Verification
4. Deployments
5. Attendance
6. Payroll
7. Loans
8. Clearance
9. Activity

**Right context panel**
- Current Deployment card (branch, shift, since)
- Loan balance
- Expiring documents
- Attendance warnings
- Quick actions (allowed only)

### G3.1 Overview tab
- Info cards: Identity, Contact, Personal, Bank, Employment Snapshot
- Mini stats: Attendance month-to-date, last salary, last deployment change

### G3.2 Documents tab
- Required docs checklist + upload
- Table of documents: type, uploaded date, uploaded by, preview/download

### G3.3 Verification tab
- Verification items list: police, medical, training, character
- Status chips + “Verify” action with notes + attachments

### G3.4 Deployments tab
- Current deployment card
- Deployment history table
- Actions: deploy / revoke / swap (drawer)

### G3.5 Attendance tab
- Monthly calendar heatmap (P/A/L/H)
- Table view with filters
- Exception markers

### G3.6 Payroll tab
- Salary history list (runs)
- Payslip downloads
- Breakdown viewer (read-only for non-finance)

### G3.7 Loans tab
- Loan ledger table
- Add loan drawer (HR/Finance only)
- Deduction schedule view

### G3.8 Clearance tab
- Checklist: inventory return, loan settlement, final salary
- “Finalize clearance” (destructive confirm)

### G3.9 Activity tab
- Timeline (audit + operational): status changes, doc uploads, deployments, attendance edits

**Data**
- `guards`, `guard_documents`, `guard_verifications`, `guard_deployments`, `guard_attendance`,
  `payroll_items`, `guard_loans`, `guard_clearance`, `audit_logs`

**Actions (RPC)**
- `transition_entity_status('guard', guard_id, to_status, payload)`
- `deploy_guard(...)`, `revoke_deployment(...)`
- `upsert_attendance_bulk(...)` (when editing)
- `add_guard_loan(...)` (or insert with trigger)
- `finalize_clearance(guard_id)`

---

# CLIENTS & BRANCHES

## C1) Clients List — `/clients`
**Purpose:** Manage clients.

**Components**
- Table: client, type, active branches, active contracts, billing status
- Create client drawer

**Permissions:** Admin/Manager/HR read; Finance read/write invoices; Supervisor read.

## C2) Client Detail — `/clients/[id]`
**Tabs:** Overview · Branches · Contracts & Rates · Invoices · Tickets · Activity  
**Right panel:** client financial summary + overdue

## C3) Branch Detail — `/clients/branches/[id]`
**Purpose:** Branch operations hub.
**Tabs:** Deployment Matrix · Attendance Summary · Invoices · Tickets · Activity  
**Right panel:** capacity summary + exceptions

---

# DEPLOYMENTS WORKSPACE

## O1) Deployments Matrix — `/deployments`
**Purpose:** Operational matrix by branch.

**Main workspace layout**
- Left sub-panel inside main: Branch list (search + filters)
- Center: Capacity vs Deployed bars by guard type/shift
- Table: deployed guards (name, shift, start date, status)

**Key actions**
- Deploy Guard (drawer)
- Swap Guard (drawer)
- Revoke/End Deployment (confirm)

**Drawer: Deploy Guard**
- Select guard (eligibility check: status + not already active)
- Select branch + shift + start date
- Shows capacity impact + warnings

**Data**
- `vw_branch_deployment_status`
- `guard_deployments`, `client_branches`

**Actions (RPC)**
- `deploy_guard(...)`
- `revoke_deployment(...)`

**Permissions**
- Supervisor/Manager: deploy actions
- HR: may deploy if allowed
- Accountant: read-only

---

# ATTENDANCE WORKSPACE

## A1) Attendance Daily — `/attendance`
**Purpose:** Bulk attendance marking for a branch/date.

**Main workspace**
- Branch selector, date selector, shift toggle
- KPI strip: Present/Absent/Leave/Holiday/Exceptions
- Bulk `DataTable` (guards deployed to branch)
- Inline status toggles with keyboard shortcuts
- Save draft vs Submit (optional)

**Right context panel**
- Exceptions list
- “Not deployed but marked present” warnings
- Missing guards

**Data**
- `guard_attendance`, `guard_deployments`, `vw_attendance_daily_summary`

**Actions (RPC)**
- `upsert_attendance_bulk(branch_id, date, rows_json)`

**Permissions**
- Supervisor: mark attendance in scoped branches
- Manager: broader scope
- HR/Finance: read

---

## A2) Leave Requests — `/attendance/leave`
**Purpose:** Approve/reject leave.

**Components**
- Table: guard, dates, type, status
- Detail drawer: approve/reject with remarks

---

# PAYROLL WORKSPACE

## P1) Payroll Runs — `/payroll`
**Purpose:** Create and manage payroll runs.

**Main workspace**
- Table: month/year, region, status, totals, exceptions
- CTA: Generate Payroll Run (drawer)

**Actions (RPC)**
- `generate_payroll_run(month, year, region?)`

**Permissions**
- Accountant: full
- Admin/Manager: view + finalize if allowed
- HR: view items, limited actions

---

## P2) Payroll Run Detail — `/payroll/[runId]`
**Header**
- Run month/year + status badge
- CTA: Recompute / Finalize / Export

**Tabs**
1. Items (table with filters)
2. Exceptions (review queue)
3. Loan Deductions
4. Exports
5. Activity

**Right panel**
- Totals summary, exception count
- Finalize readiness checklist

**Actions (RPC)**
- `finalize_payroll_run(run_id)`
- `apply_loan_deductions(run_id)`
- `compute_payroll_item(...)` (if per-item recompute supported)

---

# BILLING WORKSPACE

## B1) Invoices List — `/billing/invoices`
**Purpose:** Invoice lifecycle list.

**Components**
- Filters: month/year, client, status, overdue
- KPI strip: Outstanding, Overdue, Paid
- Table: invoice #, client, period, amount, due, status

**Actions**
- Generate invoices (drawer)
- Export PDF

**RPC**
- `generate_invoices(month, year, client_id?)`
- `update_invoice_statuses(today)`

---

## B2) Invoice Detail — `/billing/invoices/[id]`
**Header**
- Invoice # + status badge + due date
- CTA: Record Payment (drawer), Download PDF

**Tabs**
1. Line Items (branch-wise)
2. Payments
3. Activity

**Right panel**
- Totals, outstanding, aging badge
- Client snapshot

**RPC**
- `record_invoice_payment(...)`
- `compute_invoice(invoice_id)` (if recompute supported)

---

# INVENTORY WORKSPACE

## I1) Inventory Dashboard — `/inventory`
**Purpose:** Snapshot & expiries.

**Components**
- KPIs: total, assigned, in stock, expiring
- Expiry list widget
- Quick actions: Add asset, Issue, Return

## I2) Inventory List — `/inventory/assets`
**Purpose:** Asset register.

**Table columns**
Category, Type, Serial, License, Expiry, Condition, Status, Location, Assigned To

**Actions**
- Issue (drawer), Return (drawer), Mark maintenance/lost

**RPC**
- `issue_inventory(...)`
- `return_inventory(...)`
- `check_license_expiry(days_ahead)`

## I3) Asset Detail — `/inventory/assets/[id]`
**Tabs:** Overview · Assignment History · Events · Documents · Activity  
**Right panel:** expiry warnings + current assignment

---

# TICKETS WORKSPACE

## T1) Tickets List — `/tickets`
**Purpose:** Ops queue.

**Components**
- Queue-style list: status, priority, assignee
- Filters: status, category, branch/client

## T2) Ticket Detail — `/tickets/[id]`
**Purpose:** Threaded resolution.

**Layout**
- Header with status + assign
- Thread with internal/external comments
- Attachments uploader

---

# REPORTS & AUDIT

## R1) Reports Library — `/reports`
**Purpose:** Run and export reports.

**Reports**
- Attendance summary
- Payroll summary
- Invoice aging
- Deployment strength
- Inventory expiry

**Components**
- Report cards + filter drawers
- Export jobs table

## R2) Scheduled Reports — `/reports/scheduled`
**Purpose:** Configure schedule + recipients.

## R3) Audit Search — `/audit`
**Purpose:** Search all critical changes.

**Components**
- Filters: entity_type, actor, date range, action
- Results: timeline + diff viewer

---

# SETTINGS

## S1) Users — `/settings/users`
**Purpose:** Manage staff users and scopes.

**Components**
- User list table
- Create/edit drawer
- Scope assignment UI (regional/branch)

## S2) Roles & Permissions — `/settings/roles`
**Purpose:** Configure RBAC.

**Components**
- Roles list
- Permission matrix (module/action)
- Scope selector per permission

## S3) Workflow Transitions — `/settings/workflows`
**Purpose:** Configure lifecycle transitions.

**Components**
- Table: entity_type, from, to, required roles, required fields
- Create/edit drawer with JSON rule editor

## S4) Lookups — `/settings/lookups`
**Purpose:** Manage statuses/designations/document types, ticket categories, etc.

---

## 4) Reusable UI Patterns (Implementation Notes)

### Drawers over pages
- Create/Edit/Deploy/Record Payment/Issue Asset → **Side Drawer**
- Destructive or irreversible → **Modal Confirm**

### Tables (ERP-grade)
- Compact density default
- Saved views
- Bulk actions
- Sticky headers

### Activity timelines everywhere
- Guard, Deployment, Attendance, Payroll, Invoice, Inventory, Ticket

### Alerts as first-class objects
- Expiring docs/licenses
- Missing attendance
- Overdue invoices
- Pending verifications

---

## 5) Minimum “Must Feel Like Nexus” Checklist
- Fixed 3-column shell (sidebar + workspace + context rail)
- Horizontal workflow stepper on primary objects
- Read-first info cards with edit-on-demand
- Dense, controllable data tables
- Drawers for actions, modals for confirmations
- Subtle accent usage only (no colorful noise)
- Light mode calm palette with soft elevation
