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

### 3.2 Canonical tables — full data dictionary

> Types are Postgres-native. All UUIDs are `uuid` with `gen_random_uuid()` defaults unless stated. All tables include `org_id` for tenancy. Timestamp defaults use `now()` and are `timestamptz`.

#### A) Organization & Scope

##### organizations
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Organization/tenant identifier. |
| name | text | Unique per org | — | No | Legal/brand name. |
| is_active | boolean | — | true | No | Controls tenant-level access. |
| created_at | timestamptz | — | now() | No | Record creation time. |

**Indexes/constraints**: `UNIQUE(name)`.

##### regions
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Region identifier. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | Unique per org | — | No | Region label. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### regional_offices
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Regional office identifier. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| region_id | uuid | FK → regions.id | — | No | Parent region. |
| name | text | — | — | No | Office name. |
| short_name | text | — | — | Yes | Short label for UI. |
| address | text | — | — | Yes | Physical address. |
| is_head_office | boolean | — | false | No | Marks the main office. |
| created_at | timestamptz | — | now() | No | Creation time. |

**Indexes/constraints**: `UNIQUE(org_id, name)`, `INDEX(org_id, region_id)`.

##### regional_office_contacts
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Contact row id. |
| regional_office_id | uuid | FK → regional_offices.id | — | No | Office being contacted. |
| contact_type | text | Check in ('phone','email','fax','other') | — | No | Type of contact. |
| contact_value | text | — | — | No | Phone/email value. |

**Indexes/constraints**: `INDEX(regional_office_id)`.

#### B) IAM (Auth + RBAC)

##### profiles
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK, FK → auth.users.id | — | No | Tied to Supabase auth user. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| full_name | text | — | — | No | Staff display name. |
| role_id | uuid | FK → roles.id | — | No | Primary role. |
| regional_office_id | uuid | FK → regional_offices.id | — | Yes | Default regional scope. |
| contact_no | text | — | — | Yes | Phone number. |
| is_active | boolean | — | true | No | User enabled/disabled. |
| last_login | timestamptz | — | — | Yes | Last sign-in. |
| created_at | timestamptz | — | now() | No | Creation time. |
| updated_at | timestamptz | — | now() | No | Updated time (trigger). |

**Indexes/constraints**: `INDEX(org_id, role_id)`, `INDEX(regional_office_id)`.

##### roles
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Role identifier. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Role name. |
| description | text | — | — | Yes | Role notes. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### permissions
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Permission identifier. |
| module | text | — | — | No | Domain/module name. |
| action | text | — | — | No | Action verb. |

**Indexes/constraints**: `UNIQUE(module, action)`.

##### role_permissions
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| role_id | uuid | PK (composite), FK → roles.id | — | No | Role. |
| permission_id | uuid | PK (composite), FK → permissions.id | — | No | Permission. |
| scope | text | Check in ('all','regional','branch','own') | 'own' | No | Scope level granted. |

**Indexes/constraints**: `PRIMARY KEY(role_id, permission_id)`.

##### user_scopes
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Scope assignment id. |
| user_id | uuid | FK → profiles.id | — | No | User being scoped. |
| scope_type | text | Check in ('regional','branch','client') | — | No | Scope type. |
| scope_id | uuid | — | — | No | Regional/branch/client id. |

**Indexes/constraints**: `UNIQUE(user_id, scope_type, scope_id)`, `INDEX(scope_type, scope_id)`.

##### user_role_overrides
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| user_id | uuid | PK (composite), FK → profiles.id | — | No | User. |
| permission_id | uuid | PK (composite), FK → permissions.id | — | No | Permission override. |
| is_allowed | boolean | — | true | No | Allow/deny toggle. |

**Indexes/constraints**: `PRIMARY KEY(user_id, permission_id)`.

#### C) Guard Lifecycle

##### guard_statuses
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Status id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Status label (Active/Inactive/etc). |
| color | text | — | — | Yes | UI color. |
| is_active | boolean | — | true | No | Available for selection. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### guard_designations
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Designation id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Designation name. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### guards
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Guard identifier. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| parwest_id | text | Unique per org | — | No | Internal guard code. |
| name | text | — | — | No | Full name. |
| cnic_no | text | Unique per org | — | No | National ID. |
| contact_no | text | — | — | Yes | Contact number. |
| father_name | text | — | — | Yes | Father/guardian name. |
| dob | date | — | — | Yes | Date of birth. |
| gender | text | Check in ('male','female','other') | — | Yes | Gender. |
| marital_status | text | Check in ('single','married','divorced','widowed') | — | Yes | Marital status. |
| current_status_id | uuid | FK → guard_statuses.id | — | No | Current lifecycle status. |
| designation_id | uuid | FK → guard_designations.id | — | Yes | Current designation. |
| regional_office_id | uuid | FK → regional_offices.id | — | Yes | Owning office. |
| joining_date | date | — | — | Yes | Start date. |
| termination_date | date | — | — | Yes | End date if terminated. |
| personal_info | jsonb | — | '{}'::jsonb | No | Variable attributes (education, etc). |
| created_by | uuid | FK → profiles.id | — | Yes | Creator user. |
| created_at | timestamptz | — | now() | No | Created time. |
| updated_at | timestamptz | — | now() | No | Updated time. |
| deleted_at | timestamptz | — | — | Yes | Soft-delete timestamp. |

**Indexes/constraints**: `UNIQUE(org_id, parwest_id)`, `UNIQUE(org_id, cnic_no)`, `INDEX(org_id, regional_office_id)`, `INDEX(current_status_id)`.

##### guard_bank_accounts
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Bank account id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard owner. |
| bank_name | text | — | — | No | Bank name. |
| account_title | text | — | — | No | Account holder name. |
| account_number | text | — | — | No | Bank account number. |
| branch_code | text | — | — | Yes | Branch code. |
| is_primary | boolean | — | false | No | Primary payment account. |

**Indexes/constraints**: `UNIQUE(guard_id, account_number)`, `INDEX(guard_id)`, partial `UNIQUE(guard_id) WHERE is_primary`.

##### guard_family_members
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Family member id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard owner. |
| relation | text | — | — | No | Relationship (spouse/child/etc). |
| name | text | — | — | No | Full name. |
| cnic | text | — | — | Yes | National ID. |
| contact | text | — | — | Yes | Contact number. |
| occupation | text | — | — | Yes | Occupation. |
| details | jsonb | — | '{}'::jsonb | No | Extra info. |

**Indexes/constraints**: `INDEX(guard_id)`, `UNIQUE(guard_id, relation, name)`.

##### guard_employment_history
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Employment history id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard owner. |
| company_name | text | — | — | No | Previous employer. |
| designation | text | — | — | Yes | Previous designation. |
| from_date | date | — | — | Yes | Start date. |
| to_date | date | — | — | Yes | End date. |
| leaving_reason | text | — | — | Yes | Reason for leaving. |

**Indexes/constraints**: `INDEX(guard_id)`.

##### guard_documents
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Document row id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard owner. |
| document_type_id | uuid | FK → document_types.id | — | No | Document type. |
| file_path | text | — | — | No | Storage path. |
| file_name | text | — | — | No | Original filename. |
| uploaded_by | uuid | FK → profiles.id | — | Yes | Uploader. |
| created_at | timestamptz | — | now() | No | Upload time. |

**Indexes/constraints**: `INDEX(guard_id, document_type_id)`.

##### document_types
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Document type id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| entity_type | text | Check in ('guard','ticket','invoice') | — | No | Target entity. |
| name | text | — | — | No | Display name. |
| is_required | boolean | — | false | No | Required for completion. |
| metadata | jsonb | — | '{}'::jsonb | No | Additional config. |

**Indexes/constraints**: `UNIQUE(org_id, entity_type, name)`.

##### guard_verifications
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Verification row id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard owner. |
| verification_type | text | — | — | No | Type (police/medical/etc). |
| status | text | Check in ('pending','approved','rejected') | 'pending' | No | Verification status. |
| verified_date | date | — | — | Yes | Verification date. |
| document_path | text | — | — | Yes | Evidence document path. |
| remarks | text | — | — | Yes | Remarks. |
| verified_by | uuid | FK → profiles.id | — | Yes | Verifier user. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(guard_id, verification_type)`.

##### guard_status_history
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | History id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard owner. |
| from_status_id | uuid | FK → guard_statuses.id | — | Yes | Previous status. |
| to_status_id | uuid | FK → guard_statuses.id | — | No | New status. |
| changed_by | uuid | FK → profiles.id | — | Yes | Actor. |
| changed_at | timestamptz | — | now() | No | Change time. |
| payload | jsonb | — | '{}'::jsonb | No | Additional data. |

**Indexes/constraints**: `INDEX(guard_id, changed_at)`.

##### guard_loans
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Loan id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard owner. |
| loan_amount | numeric(12,2) | — | 0 | No | Total loan amount. |
| installment_amount | numeric(12,2) | — | 0 | No | Monthly deduction. |
| remaining_amount | numeric(12,2) | — | 0 | No | Remaining balance. |
| loan_date | date | — | — | No | Loan issued date. |
| purpose | text | — | — | Yes | Purpose notes. |
| status | text | Check in ('active','closed','defaulted') | 'active' | No | Loan status. |
| approved_by | uuid | FK → profiles.id | — | Yes | Approver. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(guard_id, status)`.

##### guard_clearance
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Clearance id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard owner. |
| clearance_date | date | — | — | No | Final clearance date. |
| final_salary | numeric(12,2) | — | 0 | No | Final payout. |
| pending_loans | numeric(12,2) | — | 0 | No | Outstanding loan amount. |
| inventory_returned | boolean | — | false | No | Whether assets returned. |
| documents_returned | boolean | — | false | No | Whether docs returned. |
| remarks | text | — | — | Yes | Notes. |
| processed_by | uuid | FK → profiles.id | — | Yes | Processor. |
| status | text | Check in ('pending','cleared','blocked') | 'pending' | No | Clearance status. |

**Indexes/constraints**: `UNIQUE(guard_id)`, `INDEX(status)`.

#### D) Client & Contracting

##### client_types
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Client type id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Type label. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### clients
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Client id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Client name. |
| email | text | — | — | Yes | Contact email. |
| phone | text | — | — | Yes | Contact phone. |
| address | text | — | — | Yes | Address. |
| client_type_id | uuid | FK → client_types.id | — | Yes | Classification. |
| is_active | boolean | — | true | No | Active flag. |
| enrollment_date | date | — | — | Yes | Onboarding date. |
| enrolled_by | uuid | FK → profiles.id | — | Yes | Creator. |
| created_at | timestamptz | — | now() | No | Created time. |
| updated_at | timestamptz | — | now() | No | Updated time. |

**Indexes/constraints**: `UNIQUE(org_id, name)`, `INDEX(client_type_id)`.

##### client_branches
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Branch id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| client_id | uuid | FK → clients.id | — | No | Parent client. |
| name | text | — | — | No | Branch name. |
| address | text | — | — | Yes | Branch address. |
| city | text | — | — | Yes | City. |
| province | text | — | — | Yes | Province/state. |
| regional_office_id | uuid | FK → regional_offices.id | — | Yes | Owning office. |
| is_active | boolean | — | true | No | Active flag. |
| guard_capacity | integer | — | 0 | No | Total guard slots. |
| day_cpo_capacity | integer | — | 0 | No | Day CPO slots. |
| night_cpo_capacity | integer | — | 0 | No | Night CPO slots. |
| so_capacity | integer | — | 0 | No | SO slots. |
| aso_capacity | integer | — | 0 | No | ASO slots. |
| supervisor_id | uuid | FK → profiles.id | — | Yes | Assigned supervisor. |
| manager_id | uuid | FK → profiles.id | — | Yes | Client manager. |
| latitude | numeric(9,6) | — | — | Yes | Map latitude. |
| longitude | numeric(9,6) | — | — | Yes | Map longitude. |
| enrollment_date | date | — | — | Yes | Start date. |
| closing_date | date | — | — | Yes | Closure date. |
| created_at | timestamptz | — | now() | No | Created time. |
| updated_at | timestamptz | — | now() | No | Updated time. |

**Indexes/constraints**: `UNIQUE(client_id, name)`, `INDEX(org_id, regional_office_id)`, `INDEX(client_id)`.

##### client_contracts
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Contract id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| client_id | uuid | FK → clients.id | — | No | Client. |
| start_date | date | — | — | No | Contract start. |
| end_date | date | — | — | Yes | Contract end. |
| is_active | boolean | — | true | No | Active flag. |
| terms | text | — | — | Yes | Contract terms. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(client_id, is_active)`.

##### contract_rates
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Rate row id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| contract_id | uuid | FK → client_contracts.id | — | No | Contract. |
| guard_type | text | — | — | No | Guard designation/type. |
| rate | numeric(12,2) | — | 0 | No | Base rate. |
| overtime_rate | numeric(12,2) | — | — | Yes | Overtime rate. |

**Indexes/constraints**: `UNIQUE(contract_id, guard_type)`.

#### E) Operations & Deployment

##### guard_deployments
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Deployment id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard. |
| branch_id | uuid | FK → client_branches.id | — | No | Branch. |
| contract_id | uuid | FK → client_contracts.id | — | Yes | Contract. |
| shift_type | text | Check in ('day','night','rotational') | — | No | Shift type. |
| deployed_at | timestamptz | — | now() | No | Deployment time. |
| revoked_at | timestamptz | — | — | Yes | Revocation time. |
| deployed_by | uuid | FK → profiles.id | — | Yes | Deployer. |
| revoked_by | uuid | FK → profiles.id | — | Yes | Revoker. |
| is_active | boolean | — | true | No | Active flag. |

**Indexes/constraints**: `UNIQUE(guard_id) WHERE is_active`, `INDEX(branch_id, is_active)`, `INDEX(guard_id)`.

##### branch_capacity_history
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Capacity history id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| branch_id | uuid | FK → client_branches.id | — | No | Branch. |
| changed_by | uuid | FK → profiles.id | — | Yes | Actor. |
| changed_at | timestamptz | — | now() | No | Change time. |
| from_capacity | jsonb | — | '{}'::jsonb | No | Previous capacity snapshot. |
| to_capacity | jsonb | — | '{}'::jsonb | No | New capacity snapshot. |

**Indexes/constraints**: `INDEX(branch_id, changed_at)`.

##### rosters
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Roster id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| branch_id | uuid | FK → client_branches.id | — | No | Branch. |
| roster_date | date | — | — | No | Roster date. |
| shift_type | text | Check in ('day','night','rotational') | — | No | Shift. |
| created_by | uuid | FK → profiles.id | — | Yes | Creator. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `UNIQUE(branch_id, roster_date, shift_type)`, `INDEX(branch_id)`.

##### roster_items
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Roster item id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| roster_id | uuid | FK → rosters.id | — | No | Parent roster. |
| guard_id | uuid | FK → guards.id | — | No | Guard. |
| expected_status | text | Check in ('P','OFF') | 'P' | No | Expected presence. |
| notes | text | — | — | Yes | Notes. |

**Indexes/constraints**: `UNIQUE(roster_id, guard_id)`, `INDEX(guard_id)`.

#### F) Attendance & Leave

##### guard_attendance
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Attendance row id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard. |
| branch_id | uuid | FK → client_branches.id | — | No | Branch. |
| attendance_date | date | — | — | No | Attendance date. |
| status | text | Check in ('P','A','L','H') | 'P' | No | Present/Absent/Leave/Holiday. |
| shift | text | Check in ('day','night','rotational') | — | Yes | Shift. |
| marked_by | uuid | FK → profiles.id | — | Yes | Marker. |
| source | text | Check in ('web','mobile') | 'web' | No | Source system. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `UNIQUE(guard_id, attendance_date)`, `INDEX(branch_id, attendance_date)`.

##### leave_requests
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Leave request id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| guard_id | uuid | FK → guards.id | — | No | Guard. |
| from_date | date | — | — | No | Leave start. |
| to_date | date | — | — | No | Leave end. |
| leave_type | text | — | — | No | Leave type. |
| reason | text | — | — | Yes | Reason. |
| status | text | Check in ('pending','approved','rejected','cancelled') | 'pending' | No | Workflow status. |
| requested_by | uuid | FK → profiles.id | — | Yes | Requester. |
| approved_by | uuid | FK → profiles.id | — | Yes | Approver. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(guard_id, status)`, `INDEX(from_date, to_date)`.

##### attendance_exceptions
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Exception id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| branch_id | uuid | FK → client_branches.id | — | No | Branch. |
| date | date | — | — | No | Exception date. |
| type | text | — | — | No | Exception type. |
| payload | jsonb | — | '{}'::jsonb | No | Details. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(branch_id, date)`.

#### G) Payroll & Finance

##### payroll_runs
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Payroll run id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| month | smallint | Check 1-12 | — | No | Payroll month. |
| year | smallint | — | — | No | Payroll year. |
| regional_office_id | uuid | FK → regional_offices.id | — | Yes | Optional regional scope. |
| status | text | Check in ('draft','review','final') | 'draft' | No | Run status. |
| generated_by | uuid | FK → profiles.id | — | Yes | Generator. |
| generated_at | timestamptz | — | now() | No | Generation time. |
| finalized_by | uuid | FK → profiles.id | — | Yes | Finalizer. |
| finalized_at | timestamptz | — | — | Yes | Finalization time. |

**Indexes/constraints**: `UNIQUE(org_id, month, year, regional_office_id)`, `INDEX(status)`.

##### payroll_items
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Payroll item id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| payroll_run_id | uuid | FK → payroll_runs.id | — | No | Run. |
| guard_id | uuid | FK → guards.id | — | No | Guard. |
| basic_salary | numeric(12,2) | — | 0 | No | Base salary. |
| allowances | jsonb | — | '{}'::jsonb | No | Allowance breakdown. |
| deductions | jsonb | — | '{}'::jsonb | No | Deduction breakdown. |
| gross_salary | numeric(12,2) | — | 0 | No | Gross. |
| net_salary | numeric(12,2) | — | 0 | No | Net. |
| payment_status | text | Check in ('pending','paid','hold') | 'pending' | No | Payment state. |
| bank_account_id | uuid | FK → guard_bank_accounts.id | — | Yes | Payout account. |
| computed_payload | jsonb | — | '{}'::jsonb | No | Computation audit. |

**Indexes/constraints**: `UNIQUE(payroll_run_id, guard_id)`, `INDEX(guard_id)`.

##### payslip_exports
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Export id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| payroll_run_id | uuid | FK → payroll_runs.id | — | No | Run. |
| exported_by | uuid | FK → profiles.id | — | Yes | Exporter. |
| exported_at | timestamptz | — | now() | No | Export time. |
| file_path | text | — | — | Yes | Storage path. |

**Indexes/constraints**: `INDEX(payroll_run_id)`.

##### loan_deductions
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Deduction id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| payroll_item_id | uuid | FK → payroll_items.id | — | No | Payroll item. |
| loan_id | uuid | FK → guard_loans.id | — | No | Loan. |
| amount | numeric(12,2) | — | 0 | No | Deducted amount. |

**Indexes/constraints**: `UNIQUE(payroll_item_id, loan_id)`.

#### H) Billing & Payments

##### invoices
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Invoice id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| client_id | uuid | FK → clients.id | — | No | Client. |
| invoice_number | text | Unique per org | — | No | Invoice identifier. |
| invoice_month | smallint | Check 1-12 | — | No | Billing month. |
| invoice_year | smallint | — | — | No | Billing year. |
| subtotal | numeric(12,2) | — | 0 | No | Subtotal. |
| tax_amount | numeric(12,2) | — | 0 | No | Tax. |
| total_amount | numeric(12,2) | — | 0 | No | Total. |
| status | text | Check in ('draft','sent','paid','overdue') | 'draft' | No | Invoice status. |
| due_date | date | — | — | Yes | Payment due. |
| generated_at | timestamptz | — | now() | No | Generation time. |
| generated_by | uuid | FK → profiles.id | — | Yes | Generator. |

**Indexes/constraints**: `UNIQUE(org_id, invoice_number)`, `INDEX(client_id, invoice_year, invoice_month)`.

##### invoice_line_items
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Line item id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| invoice_id | uuid | FK → invoices.id | — | No | Invoice. |
| branch_id | uuid | FK → client_branches.id | — | Yes | Branch billed. |
| description | text | — | — | No | Line description. |
| guard_type | text | — | — | Yes | Guard type for rate. |
| quantity | integer | — | 0 | No | Units. |
| rate | numeric(12,2) | — | 0 | No | Unit rate. |
| amount | numeric(12,2) | — | 0 | No | Line total. |

**Indexes/constraints**: `INDEX(invoice_id)`, `INDEX(branch_id)`.

##### invoice_payments
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Payment id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| invoice_id | uuid | FK → invoices.id | — | No | Invoice. |
| amount | numeric(12,2) | — | 0 | No | Payment amount. |
| payment_date | date | — | — | No | Payment date. |
| payment_method | text | — | — | Yes | Method (bank/cash/etc). |
| reference_no | text | — | — | Yes | Reference. |
| recorded_by | uuid | FK → profiles.id | — | Yes | Recorder. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(invoice_id, payment_date)`.

##### invoice_exports
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Export id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| invoice_id | uuid | FK → invoices.id | — | No | Invoice. |
| file_path | text | — | — | Yes | Storage path. |
| exported_at | timestamptz | — | now() | No | Export time. |

**Indexes/constraints**: `INDEX(invoice_id)`.

#### I) Inventory & Assets

##### inventory_categories
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Category id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Category name. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### inventory_product_types
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Product type id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| category_id | uuid | FK → inventory_categories.id | — | No | Category. |
| name | text | — | — | No | Type name. |

**Indexes/constraints**: `UNIQUE(category_id, name)`.

##### inventory_products
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Inventory item id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| category_id | uuid | FK → inventory_categories.id | — | No | Category. |
| product_type_id | uuid | FK → inventory_product_types.id | — | No | Type. |
| serial_number | text | Unique per org | — | No | Serial number. |
| license_number | text | — | — | Yes | License number. |
| license_expiry | date | — | — | Yes | License expiry. |
| condition | text | — | — | Yes | Condition notes. |
| status | text | Check in ('available','assigned','retired','lost') | 'available' | No | Availability status. |
| regional_office_id | uuid | FK → regional_offices.id | — | Yes | Owning office. |
| vendor_id | uuid | — | — | Yes | Vendor reference (if tracked). |
| purchase_date | date | — | — | Yes | Purchase date. |
| purchase_price | numeric(12,2) | — | — | Yes | Purchase cost. |
| metadata | jsonb | — | '{}'::jsonb | No | Extra data. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `UNIQUE(org_id, serial_number)`, `INDEX(category_id)`, `INDEX(product_type_id)`, `INDEX(status)`.

##### inventory_assignments
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Assignment id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| product_id | uuid | FK → inventory_products.id | — | No | Product. |
| guard_id | uuid | FK → guards.id | — | Yes | Guard assignment. |
| branch_id | uuid | FK → client_branches.id | — | Yes | Branch assignment. |
| assigned_at | timestamptz | — | now() | No | Assignment time. |
| returned_at | timestamptz | — | — | Yes | Return time. |
| assigned_by | uuid | FK → profiles.id | — | Yes | Issuer. |
| returned_by | uuid | FK → profiles.id | — | Yes | Receiver. |
| condition_on_return | text | — | — | Yes | Return condition. |

**Indexes/constraints**: `UNIQUE(product_id) WHERE returned_at IS NULL`, `INDEX(guard_id)`, `INDEX(branch_id)`.

##### inventory_events
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Inventory event id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| product_id | uuid | FK → inventory_products.id | — | No | Product. |
| event_type | text | — | — | No | Event type. |
| payload | jsonb | — | '{}'::jsonb | No | Event data. |
| created_at | timestamptz | — | now() | No | Event time. |

**Indexes/constraints**: `INDEX(product_id, created_at)`.

#### J) Tickets & Support

##### ticket_categories
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Category id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Category name. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### ticket_priorities
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Priority id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Priority label. |
| color | text | — | — | Yes | UI color. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### ticket_statuses
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Status id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Status label. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### tickets
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Ticket id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| title | text | — | — | No | Ticket title. |
| description | text | — | — | Yes | Problem description. |
| category_id | uuid | FK → ticket_categories.id | — | Yes | Category. |
| priority_id | uuid | FK → ticket_priorities.id | — | Yes | Priority. |
| status_id | uuid | FK → ticket_statuses.id | — | No | Current status. |
| created_by | uuid | FK → profiles.id | — | Yes | Creator. |
| assigned_to | uuid | FK → profiles.id | — | Yes | Assignee. |
| closed_at | timestamptz | — | — | Yes | Closure time. |
| created_at | timestamptz | — | now() | No | Created time. |
| updated_at | timestamptz | — | now() | No | Updated time. |

**Indexes/constraints**: `INDEX(status_id, priority_id)`, `INDEX(assigned_to)`.

##### ticket_comments
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Comment id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| ticket_id | uuid | FK → tickets.id | — | No | Ticket. |
| content | text | — | — | No | Comment body. |
| created_by | uuid | FK → profiles.id | — | Yes | Author. |
| is_internal | boolean | — | false | No | Internal only. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(ticket_id, created_at)`.

##### ticket_attachments
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Attachment id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| ticket_id | uuid | FK → tickets.id | — | No | Ticket. |
| file_path | text | — | — | No | Storage path. |
| file_name | text | — | — | No | Original filename. |
| uploaded_by | uuid | FK → profiles.id | — | Yes | Uploader. |
| created_at | timestamptz | — | now() | No | Uploaded time. |

**Indexes/constraints**: `INDEX(ticket_id)`.

#### K) Workflow, Audit, Notifications

##### workflow_transitions
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Transition id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| entity_type | text | — | — | No | Entity name. |
| from_status | text | — | — | Yes | From status. |
| to_status | text | — | — | No | To status. |
| required_roles | text[] | — | '{}' | No | Roles allowed. |
| required_fields | text[] | — | '{}' | No | Required fields. |
| validation_rules | jsonb | — | '{}'::jsonb | No | Custom rules. |
| is_active | boolean | — | true | No | Enabled. |

**Indexes/constraints**: `UNIQUE(org_id, entity_type, from_status, to_status)`.

##### audit_logs
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Audit log id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| entity_type | text | — | — | No | Entity table. |
| entity_id | uuid | — | — | No | Entity id. |
| action | text | — | — | No | Action type (insert/update/delete). |
| before | jsonb | — | '{}'::jsonb | No | Previous data. |
| after | jsonb | — | '{}'::jsonb | No | New data. |
| actor_user_id | uuid | FK → profiles.id | — | Yes | Actor. |
| actor_role | text | — | — | Yes | Role at time of action. |
| created_at | timestamptz | — | now() | No | Event time. |
| ip | inet | — | — | Yes | Actor IP. |
| user_agent | text | — | — | Yes | Actor user agent. |

**Indexes/constraints**: `INDEX(entity_type, entity_id)`, `INDEX(actor_user_id, created_at)`.

##### notifications
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Notification id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| user_id | uuid | FK → profiles.id | — | No | Recipient. |
| title | text | — | — | No | Short title. |
| body | text | — | — | No | Body content. |
| link | text | — | — | Yes | Deep link. |
| severity | text | Check in ('info','warning','critical') | 'info' | No | Severity. |
| read_at | timestamptz | — | — | Yes | Read timestamp. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(user_id, read_at)`.

##### scheduled_reports
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Scheduled report id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| name | text | — | — | No | Report name. |
| report_type | text | — | — | No | Report kind. |
| cron_expr | text | — | — | No | Cron schedule. |
| filters | jsonb | — | '{}'::jsonb | No | Filters. |
| recipients | jsonb | — | '{}'::jsonb | No | Recipient list. |
| is_active | boolean | — | true | No | Enabled. |

**Indexes/constraints**: `UNIQUE(org_id, name)`.

##### export_jobs
| Field | Type | Constraints | Default | Nullable | Business meaning |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | gen_random_uuid() | No | Export job id. |
| org_id | uuid | FK → organizations.id | — | No | Tenant owner. |
| job_type | text | — | — | No | Job type. |
| params | jsonb | — | '{}'::jsonb | No | Parameters. |
| status | text | Check in ('queued','running','failed','completed') | 'queued' | No | Job status. |
| file_path | text | — | — | Yes | Output file. |
| created_by | uuid | FK → profiles.id | — | Yes | Creator. |
| created_at | timestamptz | — | now() | No | Created time. |

**Indexes/constraints**: `INDEX(status, created_at)`.

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

