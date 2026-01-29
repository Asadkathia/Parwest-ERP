# IAM Access Matrix & RLS Policy Map

## Anchors (source of truth)
- **IAM schema + RLS patterns** live in the system blueprint (roles, permissions, role_permissions, user_scopes, scope model, and RLS helper patterns).【F:security_erp_system_blueprint_next.md†L70-L211】【F:security_erp_system_blueprint_next.md†L240-L317】
- **Role behavior expectations** (UI-aligned) are defined in the page-by-page design spec (role list + UX rules).【F:guard_erp_page_by_page_design (1).md†L60-L116】

---

## 1) Role Catalog + Scope Semantics

The ERP uses RBAC with scope. Roles map to the blueprint’s baseline roles while preserving the UI role behaviors:

| UI role label | Blueprint role | Scope basis | Scope sources |
| --- | --- | --- | --- |
| Super Admin / Admin | system_admin | Org-wide | org_id on profile (full org access) |
| Manager (Operations Head) | regional_manager | Region | profile.regional_office_id + user_scopes(regional) |
| Supervisor (Field Ops) | ops_supervisor | Branch | user_scopes(branch) (can be limited to assigned branches) |
| HR/Admin | hr_officer | Region | profile.regional_office_id + user_scopes(regional) |
| Accountant | finance_officer | Region | profile.regional_office_id + user_scopes(regional) |
| Inventory Officer | inventory_officer | Region | profile.regional_office_id + user_scopes(regional) |
| Auditor (read-only) | auditor_readonly | Org-wide read | org_id on profile |
| Client Portal User | client_portal | Client | user_scopes(client) |

**Scope mechanics**
- **org_id** is required on all rows for multi-tenant isolation (global baseline).【F:security_erp_system_blueprint_next.md†L53-L109】【F:security_erp_system_blueprint_next.md†L262-L277】
- **regional/branch/client** constraints come from **profiles.regional_office_id** and **user_scopes** (branch/client/regional assignments).【F:security_erp_system_blueprint_next.md†L99-L111】【F:security_erp_system_blueprint_next.md†L248-L271】

---

## 2) Module Permission Matrix (Roles × Allowed Operations)

Legend: **R**=Read, **C**=Create, **U**=Update, **D**=Delete, **A**=Approve/Finalize, **X**=Export/Close

| Module | System Admin | Regional Manager | HR Officer | Ops Supervisor | Finance Officer | Inventory Officer | Auditor | Client Portal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IAM (users, roles, permissions) | R/C/U/D | R (no role editing) | — | — | — | — | R | — |
| Guards (master + docs + verification) | R/C/U/D | R/C/U | R/C/U | R | R | R | R | — |
| Client & Contracts | R/C/U/D | R/C/U | R | R | R | R | R | R (own client) |
| Deployments & Rosters | R/C/U/D | R/C/U/A | R | R/C/U | R | R | R | — |
| Attendance & Leave | R/C/U/D | R/C/U/A | R | R/C/U | R | R | R | — |
| Payroll | R/C/U/D/A/X | R (no finalize) | R | R | R/C/U/A/X | R | R | — |
| Billing & Payments | R/C/U/D/A/X | R | R | R | R/C/U/A/X | R | R | R (invoices only) |
| Inventory & Assets | R/C/U/D | R | R | R | R | R/C/U/D | R | — |
| Tickets & Support | R/C/U/D/A | R/C/U/A | R/C/U | R/C/U | R/C/U | R/C/U | R | R/C/U (own client) |
| Reporting & Audit | R/C/U/D | R | R | R | R | R | R | R (limited) |
| Workflow & Automation | R/C/U/D | R | R | R | R | R | R | — |

**Notes**
- “Regional Manager” does **not** edit IAM roles/permissions (per blueprint).【F:security_erp_system_blueprint_next.md†L300-L317】
- “Auditor” is **read-only** across org scope.【F:security_erp_system_blueprint_next.md†L300-L317】
- UI must reflect restricted actions (disabled buttons with tooltips when read-only).【F:guard_erp_page_by_page_design (1).md†L90-L116】

---

## 3) RLS Policies by Table (Read/Write/Delete)

**Global baseline** (all tables):
- `org_id = current_org_id()` for SELECT/INSERT/UPDATE/DELETE.【F:security_erp_system_blueprint_next.md†L262-L277】

### 3.1 IAM tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| profiles | system_admin (org) OR regional_manager (own region) OR self | system_admin; regional_manager limited to own region | system_admin only |
| roles | system_admin only | system_admin only | system_admin only |
| permissions | system_admin only | system_admin only | system_admin only |
| role_permissions | system_admin only | system_admin only | system_admin only |
| user_scopes | system_admin OR regional_manager (own region users) | system_admin OR regional_manager (own region users) | system_admin only |
| user_role_overrides | system_admin only | system_admin only | system_admin only |

### 3.2 Guard lifecycle tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| guards | in_region(guards.regional_office_id) OR system_admin | system_admin/HR (region) | system_admin/HR (region) |
| guard_documents | in_region(guard.regional_office_id) | HR upload; system_admin | system_admin/HR (region) |
| guard_verifications | in_region(guard.regional_office_id) | HR update/verify | system_admin/HR (region) |
| guard_loans | in_region(guard.regional_office_id) | HR/finance (region) | system_admin/finance (region) |
| guard_clearance | in_region(guard.regional_office_id) | HR/finance (region) | system_admin only |
| guard_status_history | in_region(guard.regional_office_id) | system/RPC only | system_admin only |

### 3.3 Client & contracting tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| clients | in_region(client.regional_office_id) OR system_admin | system_admin/regional_manager | system_admin only |
| client_branches | in_region(client_branches.regional_office_id) OR in_branch | system_admin/regional_manager | system_admin only |
| client_contracts | in_region(contract.region) OR system_admin | system_admin/finance | system_admin only |
| contract_rates | in_region(contract.region) OR system_admin | system_admin/finance | system_admin only |

### 3.4 Operations & deployment tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| guard_deployments | in_region(branch.region) OR in_branch(branch) | ops_supervisor (branch) or regional_manager (region) | system_admin/ops (scope) |
| branch_capacity_history | in_region(branch.region) | system_admin/regional_manager | system_admin only |
| rosters | in_branch(branch) OR in_region(branch.region) | ops_supervisor (branch) | system_admin/ops (scope) |
| roster_items | in_branch(branch) OR in_region(branch.region) | ops_supervisor (branch) | system_admin/ops (scope) |

### 3.5 Attendance & leave tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| guard_attendance | in_branch(branch) OR in_region(branch.region) | ops_supervisor (branch) or regional_manager (region) | system_admin only |
| leave_requests | in_region(guard.region) | HR (region) or supervisor (branch) | system_admin only |
| attendance_exceptions | in_branch(branch) OR in_region(branch.region) | system/RPC only | system_admin only |

### 3.6 Payroll & finance tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| payroll_runs | in_region(region) OR system_admin | finance_officer (region) | system_admin only |
| payroll_items | in_region(guard.region) OR system_admin | finance_officer (region) | system_admin only |
| payslip_exports | in_region(region) OR system_admin | finance_officer (region) | system_admin only |
| loan_deductions | in_region(guard.region) OR system_admin | finance_officer (region) | system_admin only |

### 3.7 Billing & payments tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| invoices | in_region(client.region) OR client_scope(client_id) | finance_officer (region) | system_admin only |
| invoice_line_items | in_region(client.region) OR client_scope(client_id) | finance_officer (region) | system_admin only |
| invoice_payments | in_region(client.region) OR client_scope(client_id) | finance_officer (region) | system_admin only |
| invoice_exports | in_region(client.region) OR client_scope(client_id) | finance_officer (region) | system_admin only |

### 3.8 Inventory & assets tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| inventory_products | in_region(regional_office_id) | inventory_officer (region) | system_admin only |
| inventory_assignments | in_region(branch.region) | inventory_officer (region) | system_admin only |
| inventory_events | in_region(product.region) | system/RPC only | system_admin only |

### 3.9 Tickets & support tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| tickets | in_region(region) OR client_scope(client_id) | any scoped role | system_admin only |
| ticket_comments | in_region(region) OR client_scope(client_id) | any scoped role | system_admin only |
| ticket_attachments | in_region(region) OR client_scope(client_id) | any scoped role | system_admin only |
| ticket_statuses/categories/priorities | org scope | system_admin only | system_admin only |

### 3.10 Reporting, audit, workflow tables
| Table | Read condition | Write condition | Delete condition |
| --- | --- | --- | --- |
| audit_logs | org scope OR auditor_readonly | system/RPC only | system_admin only |
| scheduled_reports | org scope | system_admin/finance | system_admin only |
| export_jobs | org scope | system_admin/finance | system_admin only |
| workflow_transitions | org scope | system_admin only | system_admin only |
| notifications | user_id = auth.uid() | system/RPC only | system_admin only |

**RLS pattern anchors**
- Region-scoped tables allow users in same regional office (or system_admin).【F:security_erp_system_blueprint_next.md†L262-L286】
- Branch-scoped tables allow system_admin/regional_manager/ops_supervisor with branch scope.【F:security_erp_system_blueprint_next.md†L262-L291】
- Sensitive tables (bank/payroll) restrict to system_admin/finance (and HR read-only where needed).【F:security_erp_system_blueprint_next.md†L287-L291】
- Client portal scope applies to invoices/tickets via user_scopes(client).【F:security_erp_system_blueprint_next.md†L292-L297】

---

## 4) Enforcement: `role_permissions` + `user_scopes`

### 4.1 `role_permissions`
- `permissions` are unique (module, action). Roles are granted permissions via `role_permissions` and a **scope** (`all | regional | branch | own`).【F:security_erp_system_blueprint_next.md†L99-L111】
- RLS helper **`has_permission(module, action)`** evaluates the active user’s role permissions and optional user overrides. This function is referenced by policies or invoked by RPC endpoints (e.g., `check_permission`).【F:security_erp_system_blueprint_next.md†L200-L213】【F:security_erp_system_blueprint_next.md†L262-L271】

### 4.2 `user_scopes`
- `user_scopes` stores **branch/client/regional** assignments for a user, used by helper functions (e.g., `in_branch`, `in_region`).【F:security_erp_system_blueprint_next.md†L99-L111】【F:security_erp_system_blueprint_next.md†L262-L271】
- Policies combine **scope checks** + **role permissions**:
  - Example: `in_branch(branch_id)` AND `has_permission('attendance','update')` for `guard_attendance` writes.
  - Client portal reads: `client_id IN user_scopes(client)` AND `has_permission('billing','read')` for invoices.

### 4.3 Suggested enforcement flow (RLS + RPC)
1. **RLS** checks `org_id`, then `has_permission` + scope helper functions (region/branch/client).
2. **RPC** functions (e.g., `deploy_guard`, `generate_payroll_run`) re-check `has_permission` and assert scope for critical multi-row operations before writing data.【F:security_erp_system_blueprint_next.md†L200-L239】
3. **UI** mirrors access: show disabled actions when permission is missing and block pages with `PermissionDenied` when not authorized.【F:guard_erp_page_by_page_design (1).md†L90-L116】

---

## 5) Implementation Checklist (DB + App)

- [ ] Implement helper functions: `current_org_id`, `current_role`, `has_permission`, `in_region`, `in_branch` (SECURITY DEFINER).【F:security_erp_system_blueprint_next.md†L262-L271】
- [ ] Add RLS policies using the matrix above; start with **org_id** rule on all tables.【F:security_erp_system_blueprint_next.md†L262-L277】
- [ ] Ensure RPC functions call `check_permission` and `assert_scope` before mutation operations.【F:security_erp_system_blueprint_next.md†L200-L213】
- [ ] Mirror permissions in UI (disabled controls + permission denied).【F:guard_erp_page_by_page_design (1).md†L90-L116】
