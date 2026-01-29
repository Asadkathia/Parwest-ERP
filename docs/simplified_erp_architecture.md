# Simplified ERP Architecture & Migration Plan

## 🎯 Goals

| Goal | How We Achieve It |
|------|-------------------|
| **Less Technical Complexity** | Configuration-driven workflows, no hardcoded business logic |
| **Easy to Maintain** | Clean module separation, TypeScript everywhere, comprehensive docs |
| **Easy to Add Modules** | Plugin-like module architecture with standard patterns |
| **Easy to Change Workflows** | Database-driven workflow engine with UI-based configuration |
| **Scalable** | Supabase + Edge Functions + serverless architecture |

---

## 📦 Recommended Tech Stack

### Core Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | Next.js 14 (App Router) | Server components, API routes, excellent DX |
| **Backend** | Next.js API Routes + Server Actions | Same codebase, no separate server needed |
| **Database** | Supabase (PostgreSQL) | Managed DB, Auth, Storage, Realtime built-in |
| **Authentication** | Supabase Auth | Email/password, magic links, SSO ready |
| **File Storage** | Supabase Storage | S3-compatible, integrated with RLS |
| **Realtime** | Supabase Realtime | Live updates for dashboards, notifications |

### Additional Recommendations

| Need | Technology | Why |
|------|------------|-----|
| **UI Components** | Shadcn/UI + Tailwind CSS | Customizable, accessible, copy-paste components |
| **Forms** | React Hook Form + Zod | Type-safe validation, excellent performance |
| **Tables/DataGrids** | TanStack Table | Powerful, headless, sortable/filterable |
| **State Management** | Zustand | Simple, no boilerplate, TypeScript-first |
| **Email** | Resend | Modern email API, React Email templates |
| **PDF Generation** | @react-pdf/renderer | Generate PDFs on server or client |
| **Excel Export** | SheetJS (xlsx) | Read/write Excel files |
| **Cron Jobs** | Vercel Cron + Supabase Edge Functions | Serverless, no server to maintain |
| **Search** | Supabase Full-Text Search | PostgreSQL native, no extra service |
| **Logging/Monitoring** | Vercel Analytics + Sentry | Built-in with Vercel, error tracking |
| **Type Safety** | TypeScript + Prisma | End-to-end type safety |

### Optional for Scale

| Need | Technology | When |
|------|------------|------|
| **Background Jobs** | Trigger.dev or Inngest | Complex async workflows |
| **Caching** | Upstash Redis | High-traffic read caching |
| **API Rate Limiting** | Upstash | Protect API endpoints |

---

## 🏗️ Simplified Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Dashboard  │  │    Guards   │  │   Clients   │  │  Inventory  │   ...   │
│  │   Module    │  │   Module    │  │   Module    │  │   Module    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                     │                                        │
│  ┌──────────────────────────────────┴────────────────────────────────────┐  │
│  │                    SHARED COMPONENTS & HOOKS                           │  │
│  │  • DataTable  • Forms  • Modals  • Filters  • usePermission  • etc   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Next.js Server)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      SERVER ACTIONS                                  │    │
│  │  • createGuard()  • deployGuard()  • markAttendance()  • etc        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    WORKFLOW ENGINE (Config-Driven)                   │    │
│  │  • Status transitions stored in DB  • Validation rules in DB        │    │
│  │  • Role permissions checked automatically                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE (Backend-as-a-Service)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  PostgreSQL  │  │     Auth     │  │   Storage    │  │   Realtime   │     │
│  │  (Database)  │  │   (Users)    │  │   (Files)    │  │   (Live)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     ROW LEVEL SECURITY (RLS)                          │   │
│  │  • Users see only their data  • Managers see their region only       │   │
│  │  • Permissions enforced at database level                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Key Simplification Strategies

### 1. Configuration-Driven Workflows (No Hardcoded Logic)

Instead of hardcoding status transitions in code, store them in the database:

```sql
-- workflow_transitions table
CREATE TABLE workflow_transitions (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,        -- 'guard', 'invoice', 'ticket'
  from_status TEXT NOT NULL,        -- 'enrolled', 'verified', etc
  to_status TEXT NOT NULL,          -- 'deployed', 'terminated', etc
  required_role TEXT[],             -- ['manager', 'admin']
  required_fields TEXT[],           -- ['deployment_branch_id', 'deployment_date']
  validation_rules JSONB,           -- Custom validations
  is_active BOOLEAN DEFAULT true
);

-- Example data:
INSERT INTO workflow_transitions VALUES
  (1, 'guard', 'enrolled', 'under_verification', ARRAY['hr', 'admin'], ARRAY[], '{}', true),
  (2, 'guard', 'under_verification', 'verified', ARRAY['hr', 'admin'], ARRAY['verification_date'], '{}', true),
  (3, 'guard', 'verified', 'deployed', ARRAY['manager'], ARRAY['branch_id'], '{}', true),
  (4, 'guard', 'deployed', 'terminated', ARRAY['admin'], ARRAY['termination_reason'], '{}', true);
```

**Benefits:**
- ✅ Change workflows from UI without code changes
- ✅ Add new statuses without deployment
- ✅ Audit trail of workflow changes
- ✅ Different workflows for different guard types

### 2. Dynamic Permission System

```sql
-- Simple permission check: module + action
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  module TEXT NOT NULL,      -- 'guards', 'clients', 'inventory'
  action TEXT NOT NULL,      -- 'create', 'read', 'update', 'delete', 'export'
  UNIQUE(module, action)
);

CREATE TABLE role_permissions (
  role_id INTEGER REFERENCES roles(id),
  permission_id INTEGER REFERENCES permissions(id),
  scope TEXT DEFAULT 'all',  -- 'all', 'regional', 'own'
  PRIMARY KEY(role_id, permission_id)
);
```

**Usage in Code:**
```typescript
// lib/permissions.ts - ONE simple function
export async function can(action: string, module: string): Promise<boolean> {
  const { data: user } = await supabase.auth.getUser();
  const { data } = await supabase.rpc('check_permission', {
    user_id: user.id,
    action,
    module
  });
  return data ?? false;
}

// Usage anywhere:
if (await can('create', 'guards')) {
  // show create button
}
```

### 3. Modular Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Auth routes (login, forgot-password)
│   ├── (dashboard)/            # Main app
│   │   ├── layout.tsx          # Shared dashboard layout
│   │   ├── page.tsx            # Dashboard home
│   │   └── [module]/           # Dynamic module routing
│   │       ├── page.tsx        # List view
│   │       ├── [id]/page.tsx   # Detail view
│   │       └── new/page.tsx    # Create form
│   └── api/                    # API routes (if needed)
│
├── modules/                    # 🔑 MODULAR ARCHITECTURE
│   ├── guards/
│   │   ├── components/         # Guard-specific components
│   │   ├── actions/            # Server actions (create, update, delete)
│   │   ├── hooks/              # Guard-specific hooks
│   │   ├── types.ts            # TypeScript types
│   │   └── schema.ts           # Zod validation schemas
│   ├── clients/
│   ├── inventory/
│   ├── tickets/
│   └── reports/
│
├── shared/                     # Shared across modules
│   ├── components/             # DataTable, Forms, Modals
│   ├── hooks/                  # usePermission, useToast
│   ├── lib/                    # Utilities, Supabase client
│   └── types/                  # Global types
│
└── config/                     # Configuration
    ├── modules.ts              # Module registry
    ├── navigation.ts           # Sidebar navigation
    └── constants.ts            # App constants
```

**Adding a New Module:**
```typescript
// config/modules.ts
export const modules = {
  guards: {
    name: 'Guards',
    icon: 'Users',
    basePath: '/guards',
    permissions: ['read', 'create', 'update', 'delete', 'export'],
  },
  clients: {
    name: 'Clients',
    icon: 'Building',
    basePath: '/clients',
    permissions: ['read', 'create', 'update', 'delete'],
  },
  // ADD NEW MODULE HERE - navigation auto-updates!
  newModule: {
    name: 'New Module',
    icon: 'Box',
    basePath: '/new-module',
    permissions: ['read', 'create', 'update', 'delete'],
  },
};
```

### 4. Generic CRUD Operations

Create once, use everywhere:

```typescript
// shared/lib/crud.ts
export async function createRecord<T>(
  table: string,
  data: Partial<T>,
  options?: { auditLog?: boolean }
): Promise<T> {
  const supabase = createServerClient();
  
  const { data: record, error } = await supabase
    .from(table)
    .insert(data)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  
  if (options?.auditLog) {
    await logAudit(table, 'create', record.id, data);
  }
  
  return record;
}

// Usage in module:
export async function createGuard(data: GuardInput) {
  return createRecord('guards', data, { auditLog: true });
}
```

---

## 📊 Simplified Database Schema

### Core Design Principles

1. **Fewer tables, more JSONB** - Flexible fields stored as JSON
2. **Soft deletes everywhere** - Never lose data
3. **Audit columns on every table** - created_at, updated_at, created_by
4. **UUID primary keys** - Better for distributed systems

### Simplified Schema (60-70 tables instead of 154+)

#### Example: Guards (Consolidated)

```sql
-- ONE table instead of 15+ salary tables
CREATE TABLE guards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parwest_id TEXT UNIQUE NOT NULL,
  
  -- Basic Info
  name TEXT NOT NULL,
  cnic TEXT UNIQUE NOT NULL,
  contact TEXT,
  father_name TEXT,
  dob DATE,
  
  -- Status & Assignment
  status TEXT DEFAULT 'enrolled',
  designation TEXT DEFAULT 'guard',
  regional_office_id UUID REFERENCES regional_offices(id),
  current_branch_id UUID REFERENCES client_branches(id),
  
  -- Extended data as JSONB (flexible, no schema changes needed)
  personal_info JSONB DEFAULT '{}',    -- religion, blood_group, education, etc
  family_info JSONB DEFAULT '[]',      -- Array of family members
  employment_history JSONB DEFAULT '[]',
  bank_details JSONB DEFAULT '[]',
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ               -- Soft delete
);

-- Separate tables only for relational/queryable data
CREATE TABLE guard_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID REFERENCES guards(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guard_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID REFERENCES guards(id),
  branch_id UUID REFERENCES client_branches(id),
  date DATE NOT NULL,
  status TEXT NOT NULL,  -- P, A, L, H
  metadata JSONB DEFAULT '{}',
  UNIQUE(guard_id, date)
);

-- Consolidated salary table
CREATE TABLE guard_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID REFERENCES guards(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  
  -- All salary components as JSONB
  earnings JSONB NOT NULL,   -- {basic: 30000, allowances: {food: 1000, transport: 500}}
  deductions JSONB NOT NULL, -- {apsaa: 200, loan: 500, tax: 100}
  
  gross_amount DECIMAL(12,2) GENERATED ALWAYS AS (
    (earnings->>'basic')::DECIMAL + 
    COALESCE((SELECT SUM(value::DECIMAL) FROM jsonb_each_text(earnings->'allowances')), 0)
  ) STORED,
  
  net_amount DECIMAL(12,2),
  status TEXT DEFAULT 'draft',  -- draft, approved, paid
  paid_at TIMESTAMPTZ,
  
  UNIQUE(guard_id, month, year)
);
```

#### Table Reduction Summary

| Original | Simplified | Reduction |
|----------|------------|-----------|
| Guards (79 tables) | ~15 tables + JSONB | 80% |
| Clients (19 tables) | ~8 tables | 58% |
| Users (15 tables) | ~5 tables | 67% |
| Inventory (11 tables) | ~5 tables | 55% |
| **Total: ~154 tables** | **~50-60 tables** | **~60%** |

---

## 🔄 Data Migration Plan

### Phase 1: Preparation (Week 1)

1. **Schema Mapping**
   - Map old tables → new tables
   - Identify JSONB consolidations
   - Document data transformations

2. **Setup Migration Environment**
   ```bash
   # Create Supabase project
   supabase init
   supabase db push  # Apply new schema
   ```

3. **Create ETL Scripts**
   ```typescript
   // scripts/migrate/guards.ts
   export async function migrateGuards() {
     // 1. Read from MySQL
     const guards = await mysql.query('SELECT * FROM guards');
     
     // 2. Transform to new schema
     const transformed = guards.map(g => ({
       parwest_id: g.parwest_id,
       name: g.name,
       cnic: g.cnic_no,
       status: mapStatus(g.current_status_id),
       personal_info: {
         religion: g.religion,
         blood_group: g.blood_group,
         // ... consolidate personal fields
       },
       // ...
     }));
     
     // 3. Insert into Supabase
     await supabase.from('guards').insert(transformed);
   }
   ```

### Phase 2: Migration Execution (Week 2)

**Order of Migration:**
1. Reference data (regions, statuses, roles)
2. Regional offices
3. Users (create in Supabase Auth + profiles)
4. Guards (main records)
5. Clients & Branches
6. Guard deployments & attendance
7. Salary & payroll data
8. Inventory
9. Tickets
10. Documents (files to Supabase Storage)

### Phase 3: Verification (Week 3)

```typescript
// scripts/verify-migration.ts
async function verify() {
  const checks = [
    { name: 'Guards count', old: 'SELECT COUNT(*) FROM guards', new: 'guards' },
    { name: 'Clients count', old: 'SELECT COUNT(*) FROM clients', new: 'clients' },
    // ... more checks
  ];
  
  for (const check of checks) {
    const oldCount = await mysql.query(check.old);
    const newCount = await supabase.from(check.new).select('*', { count: 'exact', head: true });
    
    console.log(`${check.name}: Old=${oldCount} New=${newCount.count} ✓`);
  }
}
```

### Migration Strategy Options

| Strategy | Pros | Cons | Recommended For |
|----------|------|------|-----------------|
| **Big Bang** | Simple, one cutover | Higher risk, longer downtime | Small user base |
| **Phased** | Lower risk, test each module | Complex, longer timeline | Large organizations |
| **Parallel Run** | Zero risk, verify thoroughly | Most complex, double work | Mission-critical systems |

**Recommendation:** Use **Phased Migration** with this order:
1. Users & Auth (Week 1)
2. Guards Module (Week 2-3)
3. Clients Module (Week 4)
4. Inventory (Week 5)
5. Payroll & Invoicing (Week 6)
6. Reports & Tickets (Week 7)

---

## 📅 Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Foundation** | 2 weeks | Supabase setup, auth, permissions, core UI |
| **Phase 2: Guards Module** | 3 weeks | Full guard CRUD, attendance, documents |
| **Phase 3: Clients Module** | 2 weeks | Clients, branches, deployments |
| **Phase 4: Payroll** | 2 weeks | Salary calculation, loans, payments |
| **Phase 5: Inventory** | 1 week | Products, assignments |
| **Phase 6: Tickets** | 1 week | Ticketing system |
| **Phase 7: Reports** | 1 week | Dashboard, exports, scheduled reports |
| **Phase 8: Migration** | 2 weeks | Data migration, testing, cutover |
| **Total** | **14 weeks** | Complete system |

---

## ✅ Checklist for Maintainability

- [ ] TypeScript strict mode enabled
- [ ] All database types auto-generated from Supabase
- [ ] Server Actions for all mutations (type-safe)
- [ ] Zod schemas for all form validation
- [ ] Centralized error handling
- [ ] Automated tests for critical paths
- [ ] Workflow transitions in database (not code)
- [ ] Permissions in database (not code)
- [ ] Module registry for easy additions
- [ ] Comprehensive README and docs

---

## 🚀 Getting Started

```bash
# 1. Create Next.js app
npx create-next-app@latest erp-system --typescript --tailwind --app

# 2. Install dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install react-hook-form zod @hookform/resolvers
npm install @tanstack/react-table
npm install zustand
npm install lucide-react

# 3. Setup Shadcn UI
npx shadcn@latest init

# 4. Link Supabase
supabase login
supabase link --project-ref your-project-ref

# 5. Generate types
supabase gen types typescript --project-id your-project > src/types/database.types.ts
```

---

## Summary: Why This Approach is Simpler

| Old System | New System | Benefit |
|------------|------------|---------|
| 154+ tables | 50-60 tables | Less to maintain |
| Hardcoded workflows | Database-driven | Change without deploy |
| PHP + Blade | TypeScript everywhere | Better tooling, catch errors early |
| Custom permission code | RLS at database | Security by default |
| Manual file management | Supabase Storage | Built-in CDN, easy uploads |
| Cron server needed | Vercel Cron | No server to manage |
| 960KB controller file | Small, focused modules | Easy to understand |

---

*Document Created: January 28, 2026*
