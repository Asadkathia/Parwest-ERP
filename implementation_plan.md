# Migration Implementation Plan

## Laravel to Next.js + Supabase

---

## Executive Summary

This plan outlines the complete migration of the Security Services ERP from Laravel PHP to **Next.js 14** with **Supabase** (PostgreSQL + Auth + Storage). The migration will:
- Maintain 100% feature parity
- Eliminate identified duplications
- Modernize the technology stack
- Improve performance and maintainability

---

## Current State Summary

| Metric | Count |
|--------|-------|
| Database Tables | ~154 |
| View Templates | 480+ |
| API Routes | ~600+ |
| Console Commands | 14 |
| Email Templates | 8 |
| User Roles | 5+ custom roles |
| Active Modules | 8 |

---

## Target Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | Next.js API Routes + Server Actions |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Email | Resend or Supabase Edge Functions |
| Cron Jobs | Vercel Cron + Supabase Edge Functions |
| Hosting | Vercel |

---

## Phase 1: Database Schema Design (Weeks 1-3)

### 1.1 Core Schema Migrations

#### Users & Authentication
```sql
-- supabase/migrations/001_auth_and_users.sql

-- Extend Supabase Auth with profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  regional_office_id INTEGER,
  contact_no TEXT,
  profile_image TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modules
CREATE TABLE modules (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sub-modules
CREATE TABLE sub_modules (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES modules(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL -- Create, Read, Update, Delete, Export, etc.
);

-- Role permissions (junction)
CREATE TABLE role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  sub_module_id INTEGER REFERENCES sub_modules(id),
  permission_id INTEGER REFERENCES permissions(id),
  UNIQUE(role_id, sub_module_id, permission_id)
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() AND p.role_id = 1
    )
  );
```

#### Regional Offices & Locations
```sql
-- supabase/migrations/002_regional_offices.sql

CREATE TABLE regions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE regional_offices (
  id SERIAL PRIMARY KEY,
  region_id INTEGER REFERENCES regions(id),
  office_head TEXT NOT NULL,
  short_name TEXT UNIQUE,
  address TEXT,
  is_head_office BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE regional_office_contacts (
  id SERIAL PRIMARY KEY,
  regional_office_id INTEGER REFERENCES regional_offices(id),
  contact_type TEXT, -- phone, extension
  contact_value TEXT
);
```

#### Guards Module
```sql
-- supabase/migrations/003_guards.sql

-- Guard statuses (lookup)
CREATE TABLE guard_statuses (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Guard designations (lookup)
CREATE TABLE guard_designations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- Main guards table
CREATE TABLE guards (
  id SERIAL PRIMARY KEY,
  parwest_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  cnic_no TEXT UNIQUE NOT NULL,
  contact_no TEXT,
  father_name TEXT,
  dob DATE,
  gender TEXT,
  marital_status TEXT,
  religion_id INTEGER,
  blood_group_id INTEGER,
  education_id INTEGER,
  ex_service_id INTEGER, -- Military/police background
  current_status_id INTEGER REFERENCES guard_statuses(id),
  designation_id INTEGER REFERENCES guard_designations(id),
  regional_office_id INTEGER REFERENCES regional_offices(id),
  residence_id INTEGER,
  profile_image TEXT,
  joining_date DATE,
  termination_date DATE,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Guard documents
CREATE TABLE guard_documents (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id) ON DELETE CASCADE,
  document_type_id INTEGER,
  file_path TEXT NOT NULL,
  file_name TEXT,
  uploaded_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guard bank details
CREATE TABLE guard_bank_details (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id) ON DELETE CASCADE,
  bank_name TEXT,
  account_title TEXT,
  account_number TEXT,
  branch_code TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guard family (JSONB for flexibility)
CREATE TABLE guard_family_members (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  name TEXT NOT NULL,
  cnic TEXT,
  contact TEXT,
  occupation TEXT,
  details JSONB -- Additional fields
);

-- Guard employment history
CREATE TABLE guard_employment_history (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id) ON DELETE CASCADE,
  company_name TEXT,
  designation TEXT,
  from_date DATE,
  to_date DATE,
  leaving_reason TEXT
);

-- Guard verifications
CREATE TABLE guard_verifications (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id) ON DELETE CASCADE,
  verification_type_id INTEGER,
  status_id INTEGER,
  verified_date DATE,
  document_path TEXT,
  remarks TEXT,
  verified_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guard attendance (partitioned by month for performance)
CREATE TABLE guard_attendance (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id),
  branch_id INTEGER,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL, -- P, A, L, H
  shift TEXT,
  marked_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guard_id, attendance_date)
);

-- Guard salary (CONSOLIDATED - replaces multiple salary tables)
CREATE TABLE guard_salary (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id),
  salary_month INTEGER NOT NULL, -- 1-12
  salary_year INTEGER NOT NULL,
  basic_salary DECIMAL(12,2),
  allowances JSONB, -- {food: 1000, transport: 500, etc}
  deductions JSONB, -- {apsaa: 200, cwf: 100, loan: 500, etc}
  gross_salary DECIMAL(12,2),
  net_salary DECIMAL(12,2),
  payment_status TEXT DEFAULT 'pending', -- pending, paid, unpaid
  payment_date DATE,
  payment_method TEXT,
  bank_detail_id INTEGER,
  posted_by INTEGER,
  posted_at TIMESTAMPTZ,
  UNIQUE(guard_id, salary_month, salary_year)
);

-- Guard loans
CREATE TABLE guard_loans (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id),
  loan_amount DECIMAL(12,2) NOT NULL,
  installment_amount DECIMAL(12,2),
  remaining_amount DECIMAL(12,2),
  loan_date DATE,
  purpose TEXT,
  status TEXT DEFAULT 'active', -- active, completed, waived
  approved_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guard clearance
CREATE TABLE guard_clearance (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id),
  clearance_date DATE,
  final_salary DECIMAL(12,2),
  pending_loans DECIMAL(12,2),
  inventory_returned BOOLEAN DEFAULT false,
  documents_returned BOOLEAN DEFAULT false,
  remarks TEXT,
  processed_by INTEGER,
  status TEXT DEFAULT 'pending'
);
```

#### Clients Module
```sql
-- supabase/migrations/004_clients.sql

CREATE TABLE client_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  client_type_id INTEGER REFERENCES client_types(id),
  is_active BOOLEAN DEFAULT true,
  enrollment_date DATE,
  enrolled_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_branches (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  guard_capacity INTEGER DEFAULT 0,
  day_cpo_capacity INTEGER DEFAULT 0,
  night_cpo_capacity INTEGER DEFAULT 0,
  so_capacity INTEGER DEFAULT 0,
  aso_capacity INTEGER DEFAULT 0,
  supervisor_id INTEGER,
  manager_id INTEGER,
  regional_office_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  enrollment_date DATE,
  closing_date DATE,
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_contracts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contract_rates (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES client_contracts(id),
  guard_type TEXT NOT NULL, -- guard, supervisor, cpo, etc
  rate DECIMAL(12,2) NOT NULL,
  overtime_rate DECIMAL(12,2)
);

-- Guard deployments (replaces client_guard_association)
CREATE TABLE guard_deployments (
  id SERIAL PRIMARY KEY,
  guard_id INTEGER REFERENCES guards(id),
  branch_id INTEGER REFERENCES client_branches(id),
  deployed_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  deployed_by INTEGER,
  revoked_by INTEGER,
  shift_type TEXT,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT active_deployment UNIQUE(guard_id, branch_id, is_active)
);

-- Invoices
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_month INTEGER,
  invoice_year INTEGER,
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  status TEXT DEFAULT 'draft', -- draft, sent, paid, overdue
  due_date DATE,
  generated_at TIMESTAMPTZ,
  generated_by INTEGER
);

CREATE TABLE invoice_line_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id),
  branch_id INTEGER,
  description TEXT,
  guard_type TEXT,
  quantity INTEGER,
  rate DECIMAL(12,2),
  amount DECIMAL(12,2)
);

CREATE TABLE invoice_payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id),
  amount DECIMAL(12,2),
  payment_date DATE,
  payment_method TEXT,
  reference_no TEXT,
  recorded_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Inventory Module
```sql
-- supabase/migrations/005_inventory.sql

CREATE TABLE inventory_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL -- Weapons, Uniforms, Equipment
);

CREATE TABLE inventory_product_types (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES inventory_categories(id),
  name TEXT NOT NULL
);

CREATE TABLE inventory_products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES inventory_categories(id),
  product_type_id INTEGER REFERENCES inventory_product_types(id),
  serial_number TEXT UNIQUE,
  license_number TEXT,
  license_expiry DATE,
  condition TEXT DEFAULT 'good', -- new, good, fair, condemned
  status TEXT DEFAULT 'in_stock', -- in_stock, assigned, returned, condemned
  regional_office_id INTEGER,
  vendor_id INTEGER,
  purchase_date DATE,
  purchase_price DECIMAL(12,2),
  metadata JSONB, -- Flexible for bullets, size, etc
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_assignments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES inventory_products(id),
  guard_id INTEGER,
  branch_id INTEGER,
  assigned_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  assigned_by INTEGER,
  returned_by INTEGER,
  condition_on_return TEXT
);
```

#### Ticketing Module
```sql
-- supabase/migrations/006_ticketation.sql

CREATE TABLE ticket_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE ticket_priorities (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT
);

CREATE TABLE ticket_statuses (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES ticket_categories(id),
  priority_id INTEGER REFERENCES ticket_priorities(id),
  status_id INTEGER REFERENCES ticket_statuses(id),
  created_by INTEGER,
  assigned_to INTEGER,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by INTEGER,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id),
  file_path TEXT NOT NULL,
  file_name TEXT,
  uploaded_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 2: Next.js Application Structure (Weeks 4-6)

### 2.1 Project Structure

```
erp-nextjs/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── reset-password/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Dashboard shell
│   │   ├── page.tsx                # Dashboard home
│   │   ├── guards/
│   │   │   ├── page.tsx            # List
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx        # Detail
│   │   │   │   ├── edit/page.tsx   # Edit
│   │   │   │   ├── documents/page.tsx
│   │   │   │   ├── attendance/page.tsx
│   │   │   │   └── salary/page.tsx
│   │   │   ├── new/page.tsx        # Create
│   │   │   └── attendance/page.tsx # Bulk attendance
│   │   ├── clients/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── branches/page.tsx
│   │   │   │   ├── contracts/page.tsx
│   │   │   │   └── invoices/page.tsx
│   │   │   └── new/page.tsx
│   │   ├── inventory/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   ├── assign/page.tsx
│   │   │   └── categories/page.tsx
│   │   ├── users/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── roles/page.tsx
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   ├── guards/page.tsx
│   │   │   ├── clients/page.tsx
│   │   │   └── payroll/page.tsx
│   │   ├── tickets/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── new/page.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── regional-offices/page.tsx
│   │       └── system/page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/route.ts   # Supabase Auth callback
│   │   ├── cron/
│   │   │   ├── scheduled-reports/route.ts
│   │   │   ├── invoice-reminders/route.ts
│   │   │   └── license-expiry/route.ts
│   │   └── webhooks/
│   │       └── supabase/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                          # Shadcn/UI components
│   ├── guards/
│   ├── clients/
│   ├── inventory/
│   ├── reports/
│   └── shared/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── permissions.ts
│   ├── utils.ts
│   └── validations/
├── hooks/
├── types/
├── emails/                          # React Email templates
└── supabase/
    ├── migrations/
    ├── seed.sql
    └── functions/                   # Edge Functions
```

---

## Phase 3: Feature Implementation (Weeks 7-12)

### 3.1 Authentication & Authorization

**Files to Create:**
- `lib/supabase/client.ts` - Browser client
- `lib/supabase/server.ts` - Server client
- `middleware.ts` - Auth middleware
- `lib/permissions.ts` - Permission utilities

**Permission Check Flow:**
```typescript
// lib/permissions.ts
export async function hasPermission(
  userId: string,
  subModuleId: number,
  permissionId: number
): Promise<boolean> {
  const supabase = createServerClient();
  
  const { data } = await supabase
    .from('role_permissions')
    .select('id')
    .eq('role_id', userRoleId)
    .eq('sub_module_id', subModuleId)
    .eq('permission_id', permissionId)
    .single();
    
  return !!data;
}
```

### 3.2 Console Commands → Next.js API Routes + Cron

| Laravel Command | Next.js Implementation |
|-----------------|------------------------|
| `ScheduledReports:sendemails` | `/api/cron/scheduled-reports` |
| `CronJobContractEnd` | `/api/cron/contract-expiry` |
| `identifyOverdueInvoices` | `/api/cron/invoice-reminders` |
| `CronJobWeaponLicenseExpiry` | `/api/cron/license-expiry` |
| `GenerateSalary` | `/api/cron/generate-salary` |
| `generateMonthlyInvoices` | `/api/cron/generate-invoices` |

**Vercel Cron Configuration (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/scheduled-reports",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/invoice-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/license-expiry",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 3.3 Email Templates Migration

**From Laravel Blade to React Email:**

| Laravel Template | React Email Component |
|------------------|----------------------|
| `ContractEndingMail` | `emails/contract-ending.tsx` |
| `ForgetPasswordMail` | Supabase Auth handles this |
| `TicketGenerationMail` | `emails/ticket-created.tsx` |
| `ScheduledReportsEmail` | `emails/scheduled-report.tsx` |

---

## Phase 4: Data Migration (Weeks 10-11)

### 4.1 Migration Scripts

```typescript
// scripts/migrate-data.ts

import { createClient } from '@supabase/supabase-js';
import mysql from 'mysql2/promise';

async function migrateData() {
  // 1. Connect to MySQL
  const mysqlConnection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  // 2. Connect to Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 3. Migrate in order (respecting foreign keys)
  await migrateRegions(mysqlConnection, supabase);
  await migrateRegionalOffices(mysqlConnection, supabase);
  await migrateRoles(mysqlConnection, supabase);
  await migrateUsers(mysqlConnection, supabase);
  await migrateGuards(mysqlConnection, supabase);
  await migrateClients(mysqlConnection, supabase);
  await migrateInventory(mysqlConnection, supabase);
  await migrateTickets(mysqlConnection, supabase);
  
  // 4. Verify counts
  await verifyMigration(mysqlConnection, supabase);
}
```

### 4.2 User Migration with Auth

```typescript
// scripts/migrate-users.ts

async function migrateUsers(mysql: Connection, supabase: SupabaseClient) {
  const [users] = await mysql.query('SELECT * FROM users');
  
  for (const user of users) {
    // Create Supabase Auth user
    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: generateTempPassword(), // Or send reset email
      email_confirm: true
    });
    
    if (authUser) {
      // Create profile
      await supabase.from('profiles').insert({
        id: authUser.user.id,
        name: user.name,
        role_id: user.role_id,
        regional_office_id: user.regional_office_id,
        is_active: user.is_active === 1
      });
    }
  }
}
```

---

## Phase 5: Cleanup & Optimization (Week 12-13)

### 5.1 Duplications to Eliminate

| Current State | Target State |
|---------------|--------------|
| `guard_unpaid_salaries` + `guard_unpaid_salary` | Single `guard_salary` with status |
| `guards(old)` view directory | DELETE |
| `users(old)` view directory | DELETE |
| Hardcoded bulk update routes | DELETE |

### 5.2 Large Files to Refactor

| Laravel File | Next.js Approach |
|--------------|------------------|
| `GuardsController.php` (960KB) | Split into 10+ smaller API routes |
| `Guards.php` model (208KB) | Database queries in lib/guards |
| `ClientGuardsAssociation.php` (213KB) | Service layer + API routes |

---

## Verification Plan

### Automated Testing

```bash
# Unit tests
pnpm test

# E2E tests with Playwright
pnpm test:e2e

# Database migration verification
pnpm run verify:migration
```

### Manual Verification Checklist

- [ ] Login with each role type
- [ ] Create/Edit/Delete guard
- [ ] Mark attendance for 1 week
- [ ] Generate monthly salary
- [ ] Create and pay invoice
- [ ] Deploy guard to branch
- [ ] Issue inventory to guard
- [ ] Create and resolve ticket
- [ ] Generate scheduled report
- [ ] Export data to Excel

---

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1-3 | Database Schema | All migrations, RLS policies |
| 4-6 | App Structure | Next.js skeleton, auth, layout |
| 7-9 | Core Features | Guards, Clients, Users |
| 10-11 | Remaining Features | Inventory, Tickets, Reports |
| 10-11 | Data Migration | Scripts, verification |
| 12-13 | Testing & Cleanup | E2E tests, optimization |
| **Total** | **13 weeks** | - |

---

## Required User Decisions

1. **Prioritization**: Which module should be completed first?
2. **Database Access**: Do you have MySQL credentials for migration?
3. **User Accounts**: Reset all passwords or migrate existing?
4. **File Storage**: Move to Supabase Storage or keep existing?
5. **Deployment**: Vercel recommended - confirm target platform
6. **Disabled Features**: Which cron jobs should be enabled?

---

*Plan Generated: January 28, 2026*
