# ERP System Complete Analysis

---

## Executive Summary

This is a comprehensive analysis of a **Security Services ERP System** built on **Laravel PHP** with **MySQL** database. The system manages:
- **Security Guards** (hiring, deployment, attendance, payroll, documents)
- **Clients** (companies, branches, contracts, invoicing)
- **Inventory** (weapons, uniforms, equipment)
- **Users** (staff with role-based permissions)
- **Ticketing** (support/complaint management)
- **Reporting** (scheduled and ad-hoc reports)

---

## 1. Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Backend Framework | Laravel | PHP |
| Database | MySQL | - |
| Frontend | Blade Templates + jQuery + Bootstrap | - |
| Authentication | Laravel Auth Guards + Spatie Permissions | - |
| File Handling | Local Storage | - |
| PDF Generation | DomPDF | - |
| Excel Import/Export | Maatwebsite Excel | - |
| Audit Logging | Owen-IT Auditing | - |
| Task Scheduling | Laravel Console Commands | - |
| Email | Laravel Mail (SMTP) | - |

---

## 2. Complete Database Schema

### 2.1 Module Summary

| Module | Models/Tables | Primary Purpose |
|--------|---------------|-----------------|
| Guards | 79 | Employee management, attendance, payroll |
| Clients | 19 | Client companies, branches, contracts |
| Users | 15 | Staff, roles, permissions |
| Inventory | 11 | Physical assets tracking |
| Ticketation | 11 | Support ticket management |
| Invoice | 3 | Billing and payments |
| ScheduledReports | 5 | Automated reporting |
| Mix (Reference Data) | 4 | Lookup tables |
| Documents | 2 | Document type definitions |
| Authorization | 1 | Password reset tokens |
| Dashboard | 4 | Dashboard configuration |
| **TOTAL** | **~154** | - |

---

### 2.2 Guards Module (79 Tables)

#### Core Guard Tables
| Table | Description |
|-------|-------------|
| `guards` | Main guard records (208KB model - largest in system) |
| `guard_statuses` | Status definitions (Present, Absent, Terminated, Training, etc.) |
| `guard_status_colors` | UI colors for statuses |
| `guard_designation` | Position types (Guard, Supervisor, etc.) |
| `guard_roles` | Guard role definitions |

#### Guard Personal Information
| Table | Description |
|-------|-------------|
| `guard_family` | Family member records |
| `guard_nearest_relatives` | Emergency contacts |
| `guard_employment_history` | Previous job history |
| `guard_judicial_cases` | Legal case records |
| `guard_bank_details` | Banking information |
| `guard_educations_types` | Education levels |
| `guard_ex_services` | Military/police background |

#### Guard Documents
| Table | Description |
|-------|-------------|
| `guard_documents` | Uploaded documents |
| `guard_pledged_documents` | Pledged document tracking |
| `guard_pledged_documents_types` | Pledgeable document types |
| `guard_pledged_document_statuses` | Pledge status tracking |
| `document_types` | Guard document type definitions |

#### Guard Verification
| Table | Description |
|-------|-------------|
| `guard_verifications` | Verification records |
| `guard_verification_types` | Verification type definitions |
| `guard_verification_statuses` | Verification status tracking |
| `guard_special_branch_check_history` | Police verification history |
| `guard_mental_health_check` | Mental health certification |

#### Guard Attendance
| Table | Description |
|-------|-------------|
| `guard_attendance` | Daily attendance records (70KB model) |
| `guard_attendance_years` | Year-wise attendance summary |
| `guard_attendance_update_history` | Attendance modification log |
| `guard_remaining_leaves` | Leave balance tracking |

#### Guard Payroll & Salary
| Table | Description |
|-------|-------------|
| `guard_salary` | Monthly salary records |
| `guard_salary_categories` | Salary grade definitions |
| `guard_salary_history_stat` | Salary history statistics |
| `guard_salary_new_table` | New salary structure |
| `guard_salary_posted` | Posted/finalized salaries |
| `guards_basic_salary` | Base salary configuration |
| `guard_extra_hours` | Overtime tracking |
| `guards_paid_salary` | Paid salary records |
| `guard_unpaid_salaries` | Unpaid salary tracking ⚠️ DUPLICATE |
| `guard_unpaid_salary` | Unpaid salary tracking ⚠️ DUPLICATE |

#### Guard Loans
| Table | Description |
|-------|-------------|
| `guard_loans` | Loan records |
| `user_finalize_loan_history` | Loan finalization log |
| `users_finalize_loans` | User loan finalization status |

#### Guard Clearance
| Table | Description |
|-------|-------------|
| `guard_clearance` | Clearance records |
| `guard_clearance_history_stat` | Clearance statistics |
| `guard_default_clearance` | Default clearance rules |

#### Payroll Configuration
| Table | Description |
|-------|-------------|
| `payroll_defaults` | Default payroll settings (35KB model) |
| `payroll_defaults_history` | Configuration change history |
| `payroll_salary_rules` | Salary calculation rules |
| `payroll_salary_rule_details` | Rule details |
| `payroll_salary_rule_categories` | Rule categories |
| `payroll_salary_rule_amount_types` | Amount type definitions |
| `payroll_clearance_rule_details` | Clearance calculation rules |
| `payroll_salary_month` | Payroll month tracking |
| `payroll_post_indicator` | Payroll posting status |
| `payroll_deduction` | Deduction records |
| `payroll_loan_demand` | Loan demand tracking |
| `payroll_other_deductions` | Miscellaneous deductions |
| `payroll_special_duty` | Special duty allowances |

#### Allowances & Deductions
| Table | Description |
|-------|-------------|
| `allowance_types` | Allowance type definitions |
| `allowance_type_additions` | Allowance additions |
| `deduction_types` | Deduction type definitions |
| `apsaa_deductions` | APSAA-specific deductions |
| `cwf_deductions` | CWF-specific deductions |
| `special_branch_deductions` | Special branch deductions |
| `eid_allowances` | Eid bonus records |

#### Guard Location & Assignment
| Table | Description |
|-------|-------------|
| `regional_offices` | Office locations |
| `regional_offices_contact_numbers` | Office phone numbers |
| `regional_offices_extension_numbers` | Extension numbers |
| `regions` | Geographic regions |
| `residences` | Guard housing facilities |
| `guard_residence_history` | Residence assignment history |
| `guards_under_supervisor_history` | Supervisor assignment log |

#### Guard Training & History
| Table | Description |
|-------|-------------|
| `guards_on_training` | Training enrollment |
| `refresher_courses` | Refresher training records |
| `guard_history` | Guard change history |
| `guard_update_history` | Profile update log |
| `guard_status_by_col` | Status tracking by column |

#### Blacklist
| Table | Description |
|-------|-------------|
| `black_listed_guards` | Blacklisted guard records |

---

### 2.3 Clients Module (19 Tables)

| Table | Description |
|-------|-------------|
| `clients` | Client company records (40KB model) |
| `client_branches` | Physical locations/sites (52KB model) |
| `client_guard_association` | Guard deployment to branches (213KB model - very complex) |
| `client_branch_guard_capacity_history` | Capacity change log |
| `client_branch_update_history` | Branch modification log |
| `client_branch_wise_guard_salary` | Branch-specific salary config |
| `client_branches_extra_guard_demands` | Extra guard requests |
| `client_contracts` | Service contracts |
| `client_contracts_rates` | Contract pricing per guard type |
| `client_contact_info` | Client contact persons |
| `client_types` | Client categorization |
| `client_provinces` | Provincial mapping |
| `client_documents` | Client document uploads |
| `client_update_history` | Client modification log |
| `contract_rates` | Rate definitions |
| `invoice_payment_history` | Payment tracking |
| `invoice_statuses` | Invoice workflow states |
| `tax_rates` | Tax configuration |
| `black_listed_clients` | Blacklisted client records |

---

### 2.4 Users & Permissions Module (15 Tables)

| Table | Description |
|-------|-------------|
| `users` | System users (staff) |
| `user_personal_information` | Extended user profiles |
| `user_status_history` | User status changes |
| `users_logged_in_history` | Login audit trail |
| `wrong_login_user_attempts` | Failed login tracking |
| `mail_queues_by_users` | Email queue per user |

#### Role & Permission Tables
| Table | Description |
|-------|-------------|
| `custom_guard_roles` | Role definitions (named roles like Supervisor, Manager) |
| `custom_modules` | System modules |
| `custom_sub_modules` | Sub-module definitions |
| `custom_permissions` | Permission types (Create, Read, Update, Delete, etc.) |
| `custom_permissions_on_sub_modules` | Permission-SubModule junction |
| `custom_role_permissions` | Role-Permission assignments |
| `custom_user_permissions` | User-specific permission overrides |

#### User Associations
| Table | Description |
|-------|-------------|
| `manager_supervisor_association` | Manager-Supervisor hierarchy |
| `branch_manager_association` | Branch-Manager assignments |
| `client_user_association` | Client portal user links |

---

### 2.5 Inventory Module (11 Tables)

| Table | Description |
|-------|-------------|
| `inventory_products` | Physical items (141KB model - very complex) |
| `inventory_categories` | Category definitions (Weapons, Uniforms, Equipment) |
| `inventory_products_names` | Product type names |
| `inventory_item_conditions` | Condition statuses (New, Good, Condemned) |
| `inventory_products_status` | Product status tracking |
| `inventory_assign_history` | Assignment/checkout log |
| `inventory_demands_from_regional_offices` | Regional office requests |
| `inventory_issued_to_guards` | Guard-specific issuance |
| `inventory_vendors` | Supplier records |
| `inventory_non_reuseable_products` | Consumable items |
| `inventory_warranty_types` | Warranty period definitions |

---

### 2.6 Ticketation Module (11 Tables)

| Table | Description |
|-------|-------------|
| `tickets` | Support/complaint tickets |
| `ticket_categories` | Category definitions |
| `ticket_priorities` | Priority levels |
| `ticket_statuses` | Workflow states |
| `ticket_comments` | Thread/conversation |
| `ticket_attachments` | File attachments |
| `ticket_users` | Ticket-user assignments |
| `ticket_modules` | Related system modules |
| `ticket_permissions` | Ticket-specific permissions |

---

### 2.7 Invoice Module (3 Tables)

| Table | Description |
|-------|-------------|
| `client_invoices` | Invoice header records |
| `client_invoices_details` | Invoice line items |
| `invoices_errors` | Invoice generation error log |

---

### 2.8 Scheduled Reports Module (5 Tables)

| Table | Description |
|-------|-------------|
| `scheduled_reports` | Report configuration |
| `scheduled_managers` | Manager recipients |
| `scheduled_priority` | Report priority settings |
| `scheduled_recipients` | Email recipients |
| `scheduled_types` | Report type definitions |

---

### 2.9 Mix (Reference Data) Module (4 Tables)

| Table | Description |
|-------|-------------|
| `blood_groups` | Blood group lookup |
| `cities` | City lookup |
| `religions` | Religion lookup |
| `sects` | Religious sect lookup |

---

### 2.10 Documents Module (2 Tables)

| Table | Description |
|-------|-------------|
| `document_types` | Guard document types |
| `client_document_types` | Client document types |

---

### 2.11 Authorization Module (1 Table)

| Table | Description |
|-------|-------------|
| `reset_password_verification_tokens` | Password reset tokens |

---

### 2.12 Dashboard Configuration (4 Tables)

| Table | Description |
|-------|-------------|
| `dashboard_main_options` | Dashboard widget definitions |
| `dashboard_sub_options` | Sub-widget configurations |
| `dashboard_options_by_user_role` | Role-based dashboard customization |
| `dashboard_options_by_users` | User-specific dashboard settings |

---

### 2.13 Spatie Permission Tables (Used but not customized)

| Table | Description |
|-------|-------------|
| `roles` | Spatie role definitions |
| `permissions` | Spatie permission definitions |
| `model_has_permissions` | Model-permission assignments |
| `model_has_roles` | Model-role assignments |
| `role_has_permissions` | Role-permission junction |

---

### 2.14 Audit Table

| Table | Description |
|-------|-------------|
| `audits` | Owen-IT audit log for all changes |

---

## 3. User Roles & Permission System

### 3.1 Role Hierarchy

```
                    ┌─────────────────────────────────────────────┐
                    │             SUPER ADMIN / ADMIN              │
                    │          (Full System Access)                │
                    └─────────────────────────────────────────────┘
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
          ▼                              ▼                              ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│      MANAGER        │      │     ACCOUNTANT      │      │       HR/ADMIN      │
│    (role_id = 5)    │      │                     │      │                     │
│  Operations Head    │      │  Financial Access   │      │  Personnel Mgmt     │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
          │
          ▼
┌─────────────────────┐
│     SUPERVISOR      │
│    (role_id = 3)    │
│   Field Operations  │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   GUARD (optional)  │
│  As System User     │
│  (Limited Access)   │
└─────────────────────┘

┌─────────────────────┐
│   CLIENT PORTAL     │
│      USER           │
│  (External Access)  │
└─────────────────────┘
```

### 3.2 Permission System Architecture

The system uses a **3-tier permission model**:

```
custom_modules (e.g., "Guards", "Clients")
    └── custom_sub_modules (e.g., "Guard Basic Info", "Guard Documents")
            └── custom_permissions (e.g., "Create", "Read", "Update", "Delete")
                    └── custom_permissions_on_sub_modules (junction)
                            └── custom_role_permissions (role-based assignment)
```

### 3.3 Identified Modules & Permission IDs

Based on route middleware analysis (`checkIsUserHavePermission:subModuleId,permissionId`):

| Module ID | Module Name | Sub-Modules |
|-----------|-------------|-------------|
| 1 | Guards | Basic CRUD (1,2,3,4), Attendance, Documents |
| 3 | Clients | Basic CRUD, Branches (19), Contracts |
| 5 | Users | Basic CRUD (1,2,3), Permissions |
| 8 | Settings | Manager Assignment (6), Logos, Age Limits (18), User Types (14) |
| 9 | Ticketation | Viewing (2) |
| 11 | Inventory | Product Create (1), Assign (15) |
| 12 | Bulk Imports | Users (20), Guards (21), Clients (22), Inventory (23) |
| 13 | Reports | Scheduled Reports (24) |
| 14 | Audit | Audit Search (25) |
| 16 | Invoice | View/Manage (2) |

### 3.4 Middleware Components

| Middleware | Purpose |
|------------|---------|
| `CheckLogin` | Verify authenticated session |
| `CheckIsUser` | Verify user type (internal staff) |
| `CheckIsClient` | Verify client portal user |
| `CheckIsUserHavePermission` | Permission-based access control |
| `IsAlreadyLoggedIn` | Redirect if already authenticated |
| `VerifyCsrfToken` | CSRF protection |

---

## 4. Screens & Views Inventory

### 4.1 View Directory Summary (480+ Templates)

| Directory | Files | Modules Covered |
|-----------|-------|-----------------|
| `/guards` | 128 | Guard CRUD, Attendance, Salary, Documents, Forms |
| `/clients` | 36 | Client CRUD, Branches, Contracts, Deployment |
| `/ticketation` | 27 | Ticket CRUD, Categories, Priorities, Comments |
| `/users` | 24 | User CRUD, Permissions, Roles, Profile |
| `/inventory` | 20 | Products, Categories, Assignment, Reports |
| `/pdf` | 18 | Form A, Form B, Certificates, Salary Slips |
| `/bulkImports` | 15 | Excel import interfaces for all modules |
| `/reports` | 10 | Guard reports, Client reports, Scheduled |
| `/mail` | 8 | Email templates |
| `/dashboard` | 6 | Dashboard variants by role |
| `/Stats` | 5 | Statistics widgets |
| `/salary` | 5 | Salary processing screens |
| `/documents` | 5 | Document type management |
| `/layouts` | 4 | Master layouts (app layout, PDF layout) |
| `/authentication` | 3 | Login, Forgot Password, Reset Password |
| `/map` | 2 | Geographic visualization |
| `/residences` | 2 | Residence assignment |
| `/roles` | 2 | Role management |
| `/vendor` | 8 | Vendor/third-party templates |

### 4.2 Legacy Directories (To Remove)

| Directory | Files | Note |
|-----------|-------|------|
| `/guards(old)` | 122 | Backup - can be deleted |
| `/users(old)` | 24 | Backup - can be deleted |

---

## 5. API Routes

### 5.1 Main Web Routes (2636 lines in web.php)

| Route Prefix | Namespace | Key Functions |
|--------------|-----------|---------------|
| `/` | - | Login page |
| `/authentication` | Authentication | Login, Logout, Password Reset |
| `/dashboard` | Dashboard | Main dashboard |
| `/user` | Users | User CRUD, Permissions, Role Management |
| `/client` | Clients | Client/Branch CRUD, Guard Deployment, Invoicing |
| `/guard` | Guards | Guard CRUD, Attendance, Payroll, Documents, Loans |
| `/inventory` | Inventory | Product CRUD, Assignment, Demands |
| `/document` | Document | Document type management |
| `/map` | Map | Geographic visualization |
| `/reports` | Reports | Scheduled and ad-hoc reports |
| `/bulkImport` | BulkImports | Excel import interfaces |
| `/audit` | Audit | Audit log search |
| `/branch` | Branches | Branch operations |
| `/role` | Roles | Role management |
| `/clientPortal` | ClientPortal | Client user home, Guard reviews |

### 5.2 Ticketation Routes (ticketation.php)

| Route Prefix | Key Functions |
|--------------|---------------|
| `/ticket` | Ticket CRUD, Comments, Attachments, Email integration |
| `/category` | Ticket category management |
| `/priority` | Priority level management |
| `/status` | Status workflow management |

### 5.3 API Routes (api.php - 3 endpoints)

| Endpoint | Purpose |
|----------|---------|
| `GET /regions` | Get all regions |
| `GET /getGuardByStore` | Get guards by store/branch |
| `GET /getSalaryExportHistoryCron` | Salary export for cron job |

---

## 6. Console Commands (Scheduled Jobs)

### 6.1 Available Commands (14 Total)

| Command | Schedule | Purpose |
|---------|----------|---------|
| `ScheduledReports:sendemails` | Every minute | Send scheduled report emails |
| `UpdateRegionalOfficeRecord` | - | Update regional office data |
| `CronJobContractEnd:contractEnding` | Daily (disabled) | Contract expiry notifications |
| `CronJobWeaponLicenseExpiryNotification` | Daily (disabled) | Weapon license expiry alerts |
| `AddGuardPledgedDocuments` | Daily (disabled) | Process pledged documents |
| `AddGuardVerificationDocuments` | Daily (disabled) | Process verification documents |
| `GuardDocumentImportsInBulk` | Daily (disabled) | Bulk document imports |
| `FetchInboxLatestMessages` | - (disabled) | Email inbox integration |
| `GenerateSalary` | Daily at 00:05 (disabled) | Auto salary generation |
| `identifyOverdueInvoices:Notify` | Daily at 00:05 (disabled) | Invoice overdue notifications |
| `generateMonthlyInvoices:generate` | Monthly on 1st (disabled) | Auto invoice generation |
| `MakeUserLogoutOnSessionExpire` | Daily (disabled) | Session cleanup |
| `DemoCron` | - (disabled) | Testing cron |
| `bulkImportGuardsProfilePics` | - (disabled) | Profile photo import |

### 6.2 Active Scheduled Commands

Currently only **2 commands** are active:
1. `ScheduledReports:sendemails` - Runs every minute
2. `UpdateRegionalOfficeRecord` - Manual execution

---

## 7. Email Templates (8 Total)

| Template | Purpose |
|----------|---------|
| `ContractEndingMail` | Client contract expiry notification |
| `ForgetPasswordMail` | Password reset email |
| `NewUserSignupMail` | New user welcome email |
| `ScheduledReportsEmail` | Scheduled report delivery |
| `TicketAssignToUserMail` | Ticket assignment notification |
| `TicketGenerationMail` | New ticket creation notification |
| `TicketReplyMail` | Ticket reply notification |
| `WeaponExpiryNotificationMail` | Weapon license expiry alert |

---

## 8. Key Business Processes

### 8.1 Guard Lifecycle

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  ENROLLMENT │───▶│ VERIFICATION│───▶│  TRAINING   │───▶│ DEPLOYMENT  │
│             │    │             │    │             │    │             │
│ - Basic Info│    │ - Special   │    │ - Training  │    │ - Assign to │
│ - Documents │    │   Branch    │    │   Records   │    │   Branch    │
│ - Bank Acct │    │ - Character │    │ - Refresher │    │ - Inventory │
│ - Family    │    │   Check     │    │   Courses   │    │   Issuance  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  CLEARANCE  │◀───│   PAYROLL   │◀───│ ATTENDANCE  │◀───│  OPERATION  │
│             │    │             │    │             │    │             │
│ - Final Dues│    │ - Monthly   │    │ - Daily     │    │ - Active    │
│ - Inventory │    │   Salary    │    │   Marking   │    │   Duty      │
│   Return    │    │ - Loans     │    │ - Leave     │    │ - Shifts    │
│ - Documents │    │ - Deductions│    │   Tracking  │    │ - Reports   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 8.2 Client Lifecycle

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  ENROLLMENT │───▶│   BRANCH    │───▶│  CONTRACT   │───▶│  GUARD      │
│             │    │   SETUP     │    │   SETUP     │    │  DEPLOYMENT │
│ - Company   │    │ - Locations │    │ - Rates per │    │ - Assign    │
│   Info      │    │ - Capacity  │    │   Guard Type│    │   Guards    │
│ - Contacts  │    │ - Manager   │    │ - Duration  │    │ - Inventory │
│ - Type      │    │ - Supervisor│    │ - Terms     │    │ - Schedules │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  CLOSING    │◀───│   PAYMENT   │◀───│  INVOICING  │◀───│  OPERATIONS │
│             │    │             │    │             │    │             │
│ - End Date  │    │ - Record    │    │ - Monthly   │    │ - Attendance│
│ - Guard     │    │   Payments  │    │   Billing   │    │   Reports   │
│   Removal   │    │ - Track Due │    │ - Tax Calc  │    │ - Reviews   │
│ - Final Bill│    │ - Overdue   │    │ - Generate  │    │ - Tickets   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 8.3 Inventory Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ PROCUREMENT │───▶│    STOCK    │───▶│  ISSUANCE   │───▶│   RETURN    │
│             │    │  MANAGEMENT │    │             │    │             │
│ - Add Items │    │ - By Region │    │ - To Guard  │    │ - Checkout  │
│ - Vendor    │    │ - Track Qty │    │ - To Branch │    │ - Condition │
│ - Condition │    │ - Status    │    │ - License   │    │   Check     │
│ - License # │    │   Updates   │    │   Assign    │    │ - Condemn   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## 9. Data Relationships (ER Diagram)

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     USERS       │─────────│   REGIONAL      │─────────│     GUARDS      │
│                 │ belongs │   OFFICES       │ belongs │                 │
│ - id            │   to    │                 │   to    │ - id            │
│ - name          │         │ - id            │         │ - parwest_id    │
│ - email         │         │ - office_head   │         │ - name          │
│ - role_id       │         │ - Region        │         │ - cnic_no       │
│ - regional_     │◀────────│                 │◀────────│ - contact_no    │
│   office_id     │         │                 │         │ - current_      │
└─────────────────┘         └─────────────────┘         │   status_id     │
         │                                               └─────────────────┘
         │ supervises                                            │
         ▼                                                       │ assigned to
┌─────────────────┐         ┌─────────────────┐                  ▼
│ MANAGER_        │         │   GUARDS_       │         ┌─────────────────┐
│ SUPERVISOR_     │─────────│   UNDER_        │─────────│ CLIENT_GUARD_   │
│ ASSOCIATION     │         │   SUPERVISOR_   │         │ ASSOCIATION     │
│                 │         │   HISTORY       │         │                 │
│ - manager_id    │         │                 │         │ - guard_id      │
│ - supervisor_id │         │ - guard_id      │         │ - branch_id     │
│ - assigned_at   │         │ - supervisor_id │         │ - deployed_at   │
│ - revoked_at    │         │ - update_at     │         │ - revoked_at    │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                                                 │
                                                                 │ deployed to
                                                                 ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    CLIENTS      │─────────│ CLIENT_BRANCHES │─────────│ INVENTORY_      │
│                 │ has     │                 │ has     │ PRODUCTS        │
│ - id            │ many    │ - id            │ many    │                 │
│ - name          │         │ - client_id     │         │ - id            │
│ - client_type_id│         │ - name          │         │ - category_id   │
│ - is_active     │         │ - capacity      │         │ - branch_id     │
└─────────────────┘         │ - manager_id    │         │ - guard_id      │
         │                  │ - supervisor_id │         │ - status_id     │
         │ has              └─────────────────┘         └─────────────────┘
         ▼
┌─────────────────┐
│ CLIENT_CONTRACTS│
│                 │
│ - id            │
│ - client_id     │
│ - start_date    │
│ - end_date      │
│ - rates         │
└─────────────────┘
```

---

## 10. Identified Issues & Cleanup Opportunities

### 10.1 Duplicate Models (Must Consolidate)

| Duplicate Set | Resolution |
|---------------|------------|
| `GuardUnpaidSalariesModel` + `GuardUnpaidSalaryModel` | Merge into single `guard_unpaid_salary` |
| `GuardSalaryModel` + `PayrollSalaryModel` | Evaluate overlap, merge if possible |

### 10.2 Legacy Code (Must Remove)

| Item | Location | Notes |
|------|----------|-------|
| Legacy views directory | `/resources/views/guards(old)` | 122 files - obsolete |
| Legacy views directory | `/resources/views/users(old)` | 24 files - obsolete |
| Hardcoded status update route | `web.php` lines 1878-2570 | Bulk status update with 1000+ hardcoded IDs |
| Data fix routes | `web.php` lines 2573-2626 | One-time migration scripts |

### 10.3 Disabled Features (Review Before Migration)

| Feature | Status | Decision Needed |
|---------|--------|-----------------|
| Contract end notification cron | Disabled | Enable? |
| Weapon license expiry notification | Disabled | Enable? |
| Automatic salary generation | Disabled | Enable? |
| Automatic invoice generation | Disabled | Enable? |
| Overdue invoice notifications | Disabled | Enable? |
| Email inbox integration | Disabled | Enable? |

### 10.4 Large Model Files (Refactoring Candidates)

| Model | Size | Recommendation |
|-------|------|----------------|
| `GuardsController.php` | 960KB | Split into multiple controllers |
| `Guards.php` | 208KB | Extract business logic to services |
| `ClientGuardsAssociation.php` | 213KB | Extract to services |
| `InventoryProductsModel.php` | 141KB | Extract to services |
| `GuardAttendance.php` | 70KB | Extract to services |
| `ClientBranchesModel.php` | 52KB | Extract to services |

---

## 11. Summary Statistics

| Metric | Count |
|--------|-------|
| Total Models/Tables | ~154 |
| Total Views/Templates | 480+ |
| Total Routes (web.php) | 2636 lines |
| Total Controllers | ~38 |
| Console Commands | 14 |
| Email Templates | 8 |
| Middleware | 9 |
| API Endpoints | 3 |
| Legacy files to remove | ~146 |

---

*Document Generated: January 28, 2026*
*Source: Laravel ERP System Analysis*
