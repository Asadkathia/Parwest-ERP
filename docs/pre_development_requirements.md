# Pre-Development Documentation Readiness (ERP)

This checklist captures the minimum documentation required before engineering starts. Each section is intended to be **complete enough to build** without extra discovery work.

---

## 1) Scope & Requirements (Complete)
- **SRS** defines functional and non-functional requirements for Guard, Deployment, Training, Inventory, Payroll, Billing, Dashboards, and Weapons control.  
  Source: `3. Software Requirements Specification.docx`.
- **Legacy analysis** enumerates existing module coverage and tables for migration parity checks.  
  Source: `system_analysis.md`.

---

## 2) Target Architecture & Modules (Complete)
- **Architecture stack, module structure, and workflow engine** are defined.  
  Source: `simplified_erp_architecture.md`.
- **Domain boundaries, canonical tables, and critical RPCs** are defined.  
  Source: `security_erp_system_blueprint_next.md`.

---

## 3) UI/UX Coverage (Complete)
- **Page-by-page UI spec** covers all modules, dashboards, and settings.  
  Source: `guard_erp_page_by_page_design (1).md`.
- **Approval Center** and **Broadcast Notifications** are defined as required admin features.  
  Source: `guard_erp_page_by_page_design (1).md`.

---

## 4) Workflow & Approval Gates (Complete)
Minimum lifecycle transitions and approval gates:

| Entity | Core Statuses | Required Approvals |
| --- | --- | --- |
| Guard | enrolled → verified → deployed → terminated | Training Head + COO for enrollment, Super Admin gate for termination |
| Deployment | draft → active → revoked | Super Admin gate for forced revoke |
| Attendance | pending → approved/rejected | Supervisor/Manager approval for exceptions |
| Payroll | draft → review → final | Super Admin approval for finalization |
| Invoice | draft → sent → paid/overdue | Super Admin approval for void/credit |
| Inventory | in_stock → assigned → returned → retired | Super Admin approval for write-off |
| Tickets | open → in_progress → resolved/closed | Supervisor/Manager approval for closure (optional) |

Approval records are captured via `approval_requests` with `requires_super_admin` gating.  
Source: `security_erp_system_blueprint_next.md`.

---

## 5) Permissions & RLS (Complete)
**Roles**: Super Admin/Admin, Manager, Supervisor, Accountant, HR/Admin, Inventory Officer, Auditor (read-only), Client Portal User.  
Source: `guard_erp_page_by_page_design (1).md`.

**Permission rules**:
- Scope-based access is enforced in RLS (`org_id`, `regional_office_id`, `branch_id`).
- UI respects permissions; restricted actions remain visible but disabled.
- A global `check_permission` RPC determines module/action access.  
Source: `security_erp_system_blueprint_next.md`.

---

## 6) API/RPC Contract Requirements (Complete)
Minimum RPC list with required payloads:

| RPC | Purpose | Required Inputs |
| --- | --- | --- |
| `check_permission` | Role/action authorization | user_id, module, action |
| `get_user_scopes` | Scope resolution | user_id |
| `transition_entity_status` | Workflow transitions | entity_type, entity_id, to_status, payload |
| `deploy_guard` | Deploy guard to branch | guard_id, branch_id, shift_type, deployed_at, contract_id? |
| `revoke_deployment` | End deployment | deployment_id, revoked_at, reason? |
| `upsert_attendance_bulk` | Attendance entry | branch_id, attendance_date, rows[] |
| `compute_attendance_summary` | Dashboard/rollups | month, year, branch_id?, client_id? |

Source: `security_erp_system_blueprint_next.md`.

---

## 7) Notifications & Broadcasts (Complete)
- `notifications` supports **user**, **role**, and **org-wide** audiences.
- Super Admin broadcasts surface on **all dashboards** via realtime/push and banner UI.  
Source: `security_erp_system_blueprint_next.md`, `guard_erp_page_by_page_design (1).md`.

---

## 8) Reporting & Dashboards (Complete)
- Role-specific dashboard widgets and KPI sources are defined.  
Source: `guard_erp_page_by_page_design (1).md`.
- Scheduled reports and export jobs are documented.  
Source: `security_erp_system_blueprint_next.md`.

---

## 9) Implementation Plan (Complete)
- Phased migration plan and schema-first delivery approach are defined.  
Source: `implementation_plan.md`.

---

## 10) Operations & Release Runbook (Complete)
- Deployment, monitoring, backups, and incident response are documented.  
Source: `docs/operational_runbook.md`.

---

## 11) Implementation Roadmap (Complete)
- Frontend-first, end-to-end delivery roadmap defined with phase tests.  
Source: `implementation_roadmap.md`.

---

## 12) Pre-Dev “Go/No-Go” Checklist (All must be true)
- [x] Scope locked (SRS + system analysis).
- [x] Canonical data model defined.
- [x] UI/UX spec complete.
- [x] Workflow + approvals defined.
- [x] Permissions & RLS approach defined.
- [x] RPC contract list defined.
- [x] Broadcast notifications defined.
- [x] Delivery plan defined.
- [x] Operational runbook defined.
- [x] Implementation roadmap defined.
