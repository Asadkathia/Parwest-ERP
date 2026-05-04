# Reporting Module — Design Spec

**Date:** 2026-05-05
**Owner:** Asad
**Status:** Approved (auto-mode), implementation pending
**Replaces:** `src/app/(dashboard)/reports/**` and `src/app/api/reports/**` (current dummy / partial)

---

## 1. Goal

Replace the existing frontend-only/dummy reporting screens with a production reporting module that delivers four surfaces:

1. **Executive Dashboard** — KPI tiles + charts for CEO/CFO/Admin.
2. **Reports Catalog** — browse and run predefined reports across Guards, Clients, Deployments, Financial, Inventory, Other.
3. **Scheduled Reports** — recurring runs with email delivery.
4. **Library** — history of generated reports, downloadable.

All four are gated behind the existing `REPORTS` module permission. CEO/CFO roles get the permission seeded; Admin (regional) and Super Admin already bypass per the existing rules.

---

## 2. Non-goals (v1)

- **Self-serve report builder** (custom column/filter UI). Future v2.
- **Map view** — explicitly out of reporting scope (per spec doc 3.9.5; can live elsewhere).
- **Multiple role-tuned dashboards** — one Executive dashboard for v1; per-role variants in v2.
- **Drill-down navigation across modules** — links out to existing module pages, no nested OLAP.
- **Custom dashboard widget configuration per user** (legacy `dashboard_options_by_users`) — defer.

---

## 3. Architecture

### 3.1 IA / routes

```
/reports                    → Executive Dashboard (default landing)
/reports/catalog            → Catalog of all predefined reports (filter, search)
/reports/catalog/[reportKey] → Run a specific report (params form → results → export)
/reports/scheduled          → List + manage scheduled reports (CRUD)
/reports/scheduled/new      → Create scheduled report
/reports/scheduled/[id]     → Edit / pause / delete
/reports/library            → Past runs (manual + scheduled), download artifacts
/reports/library/[runId]    → Run details (params, status, artifact links)
```

`middleware.ts` already maps `/reports` → `REPORTS` module permission. No middleware change needed.

### 3.2 Layered structure

```
src/
  app/(dashboard)/reports/
    layout.tsx                     # tab nav: Dashboard | Catalog | Scheduled | Library
    page.tsx                       # Executive Dashboard (replaces current page)
    catalog/page.tsx               # catalog grid
    catalog/[reportKey]/page.tsx   # run a report
    scheduled/page.tsx             # list
    scheduled/new/page.tsx         # form
    scheduled/[id]/page.tsx        # edit
    library/page.tsx               # runs list
    library/[runId]/page.tsx       # run detail
  app/api/reports/
    dashboard/route.ts             # GET: KPIs + chart series
    catalog/route.ts               # GET: list of report definitions (metadata only)
    run/[reportKey]/route.ts       # POST: run a report (sync), GET: stream/download
    scheduled/route.ts             # GET list, POST create
    scheduled/[id]/route.ts        # GET/PATCH/DELETE
    library/route.ts               # GET list of runs
    library/[runId]/route.ts       # GET run detail
    library/[runId]/download/route.ts # GET artifact bytes
    cron/run-scheduled/route.ts    # POST (cron-protected): execute due schedules
  lib/reports/
    registry.ts                    # ReportDefinition[] - source of truth for all reports
    runner.ts                      # runReport(definition, params, format) -> RunResult
    formatters/csv.ts              # exceljs csv mode
    formatters/xlsx.ts             # exceljs xlsx
    formatters/pdf.ts              # @react-pdf/renderer
    storage.ts                     # putArtifact(runId, bytes, ext) -> fileKey, getArtifact(fileKey)
    email.ts                       # sendScheduledReport(run, recipients) - nodemailer SMTP
    schedule.ts                    # cron parsing + due-window calc
    types.ts                       # RunResult, ReportDefinition, ReportRunStatus
    definitions/                   # one file per report
      guards/hired.ts
      guards/terminated.ts
      ...
      clients/enrolled.ts
      ...
  components/reports/
    DashboardKpis.tsx
    DashboardCharts.tsx
    ReportCatalog.tsx
    ReportParamsForm.tsx           # built from definition.params zod schema
    ReportResultsTable.tsx
    ReportExportMenu.tsx           # CSV / XLSX / PDF
    ScheduledReportForm.tsx
    LibraryTable.tsx
```

### 3.3 Report definition contract

`src/lib/reports/types.ts`:

```ts
export type ReportFormat = "csv" | "xlsx" | "pdf"
export type ReportCategory = "guards" | "clients" | "deployments" | "financial" | "inventory" | "other"

export interface ReportColumn {
  key: string
  label: string
  type: "string" | "number" | "currency" | "date" | "boolean"
  align?: "left" | "right" | "center"
  width?: number    // PDF / XLSX hint
}

export interface ReportDefinition<P extends z.ZodTypeAny = z.ZodTypeAny> {
  key: string                       // "guards.hired"
  title: string
  description: string
  category: ReportCategory
  permissions?: { module: string; action: "VIEW" }[]   // additional gates beyond REPORTS
  paramsSchema: P                                       // zod, drives ParamsForm
  columns: ReportColumn[]
  run: (params: z.infer<P>, ctx: ReportContext) => Promise<ReportResultRow[]>
  // chart hints for dashboard preview (optional)
  chart?: { kind: "bar" | "line" | "pie"; xKey: string; yKey: string }
}

export interface ReportContext {
  userId: string
  scope: ReturnType<typeof deriveManagerScope>   // regional scoping
  prisma: PrismaClient
}

export type ReportResultRow = Record<string, string | number | boolean | Date | null>
```

A report is fully defined by one file in `definitions/<category>/<name>.ts`. The registry imports and re-exports all of them as a flat list — adding a new report = one new file + one line in `registry.ts`.

### 3.4 Data model (Prisma additions)

```prisma
model ReportRun {
  id            String          @id @default(cuid())
  reportKey     String
  paramsJson    Json
  format        ReportFormat
  status        ReportRunStatus @default(PENDING)
  requestedById String?
  requestedBy   User?           @relation(fields: [requestedById], references: [id])
  scheduledId   String?
  scheduled     ScheduledReport? @relation(fields: [scheduledId], references: [id])
  fileKey       String?         // path/key in storage.ts
  fileSize      Int?
  rowCount      Int?
  error         String?
  startedAt     DateTime?
  finishedAt    DateTime?
  createdAt     DateTime        @default(now())

  @@index([reportKey, createdAt])
  @@index([scheduledId])
  @@index([requestedById, createdAt])
}

model ScheduledReport {
  id            String       @id @default(cuid())
  reportKey     String
  paramsJson    Json
  formats       ReportFormat[]   // run multiple formats per delivery
  cron          String           // standard 5-field cron expr
  timezone      String           @default("Asia/Karachi")
  recipients    String[]         // email addresses
  managerIds    String[]         // user ids whose email is also pulled in
  priority      Int              @default(0)
  active        Boolean          @default(true)
  lastRunAt     DateTime?
  nextRunAt     DateTime?
  createdById   String
  createdBy     User             @relation(fields: [createdById], references: [id])
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  runs          ReportRun[]

  @@index([active, nextRunAt])
  @@index([createdById])
}

enum ReportFormat { CSV XLSX PDF }
enum ReportRunStatus { PENDING RUNNING SUCCEEDED FAILED }
```

`User` gets `reportRuns` and `scheduledReports` reverse relations.

Migration: `prisma/migrations/<ts>_add_reports/`.

### 3.5 Runner

`runner.ts::runReport(reportKey, params, format, ctx)`:

1. Validate `params` via `definition.paramsSchema`. Reject 400 on failure.
2. Create `ReportRun` row with status `RUNNING`.
3. Call `definition.run(params, ctx)` → rows.
4. Pipe rows into the chosen formatter → `Buffer`.
5. `storage.putArtifact(runId, buffer, ext)` → `fileKey`.
6. Update run with `fileKey`, `fileSize`, `rowCount`, `finishedAt`, status `SUCCEEDED`. On throw: status `FAILED`, `error: e.message`.
7. Return run id; client polls library or downloads via `library/[runId]/download`.

For sync / on-demand runs from the catalog, `POST /api/reports/run/[reportKey]` returns `{ runId, downloadUrl }` after completion.

### 3.6 Storage

Two-mode interface in `storage.ts`:

- **Local dev**: write to `./.reports-artifacts/<runId>.<ext>`. Gitignored.
- **Production**: write to S3-compatible (env-detected via `REPORTS_S3_BUCKET`). If S3 env not set, fall back to a `ReportRunBlob` Prisma model (BYTEA up to 25 MB). Pragmatic for v1; cheaper than mandatory S3 for a low-volume reporting feature.

`getArtifact(fileKey)` returns a stream + content-type for download.

### 3.7 Scheduling

- `nextRunAt` computed from `cron + timezone` using `cron-parser` (already a small dep we'll add).
- A new Vercel cron route `/api/cron/run-scheduled-reports` (added to `vercel.json` + the existing `src/lib/cron/` infra) fires every 5 min. It:
  - Selects all `ScheduledReport` where `active=true AND nextRunAt <= now()`.
  - For each: run report in each requested format → email artifacts via `email.ts` → record `ReportRun`s linked via `scheduledId` → recompute `nextRunAt`.
- Email: `nodemailer` + `SMTP_HOST/PORT/USER/PASS/FROM` env. If env missing, runs still produce artifacts in Library; no email sent; we log and surface "email not configured" in the schedule UI.

### 3.8 Exports

- **CSV**: streamed via `exceljs` workbook → CSV writer.
- **XLSX**: `exceljs` workbook with columns from `definition.columns`. Number/currency/date formats applied.
- **PDF**: `@react-pdf/renderer`. Generic `<ReportPdf definition={d} rows={rows} params={p}/>` template (header with brand, params summary, columnized table with page-break). Add `@react-pdf/renderer` + `react-pdf` peer to `package.json`.

### 3.9 Permissions / role seeding

- `REPORTS` already exists as a module string in `MODULE_ROUTES`.
- Seed migration: ensure `RolePermission` rows exist for roles named `CEO` and `CFO` with `module="REPORTS"` and `canView=true`. Create the roles if missing (idempotent upsert).
- Admin (regional) keeps existing behavior — sees only if explicitly granted REPORTS. SuperAdmin bypass continues.
- All `/api/reports/**` routes use `requireReportsAccess(req)` helper that checks session + REPORTS module via `useCanAccess`-equivalent server check.
- Regional admins (Admin role with explicit perms): when REPORTS is granted, queries are scoped via `deriveManagerScope(session)` and `buildManagerScopeWhere` per-report. CEO/CFO/SuperAdmin = global scope.

### 3.10 Dashboard composition (v1)

Executive Dashboard at `/reports`:

- **KPI strip** (8 tiles): Total Guards, Deployed, Available, Total Clients, Active Branches, Guard-less Branches, Pending Verifications, Expiring Documents (≤30d). Source: `dashboard/route.ts` aggregates.
- **Charts (3)**:
  - Deployment trend last 30d (line)
  - Salary cost MoM last 6 months (bar)
  - Inventory by status (pie)
- **Recent reports** (last 5 runs by current user)
- **Pinned reports** — definition flag `pinned: true`; v1 = top-used six.

### 3.11 Catalog v1 — full report inventory

All 28 reports below ship in v1. Existing query logic where present is folded into the new `definitions/`:

| Category | Key | Title |
|---|---|---|
| guards | guards.hired | Hired guards |
| guards | guards.terminated | Terminated guards |
| guards | guards.verification | Verification status |
| guards | guards.deployment-status | Deployment status |
| guards | guards.attendance | Attendance |
| guards | guards.salary | Salary history |
| guards | guards.expiring-docs | Expiring documents |
| clients | clients.enrolled | Enrolled clients |
| clients | clients.branches-opened | Branches opened |
| clients | clients.active-inactive | Active / inactive clients |
| clients | clients.branch-capacity | Branch guard capacity |
| clients | clients.increase-decrease | Branch increase/decrease |
| deployments | deployments.current | Currently deployed |
| deployments | deployments.history | Deployment history |
| deployments | deployments.day-night | Day / night duty |
| deployments | deployments.unassigned | Unassigned guards |
| deployments | deployments.short-term | Short-term / EXTRA |
| financial | financial.salary-export | Salary export (bank-ready) |
| financial | financial.unpaid-salary | Unpaid salary |
| financial | financial.loans | Loans |
| financial | financial.clearance | Clearance |
| financial | financial.invoices | Invoices |
| financial | financial.invoice-errors | Invoice errors |
| inventory | inventory.total | Total inventory |
| inventory | inventory.by-status | Items by status |
| inventory | inventory.by-region | Items by region |
| inventory | inventory.issued-by-guard | Issued by guard |
| inventory | inventory.condemned | Condemned items |
| other | other.complaints | Complaints / tickets |
| other | other.ai-summary | AI report (existing endpoint, wrapped) |

Each definition: <100 lines, paramsSchema (date range + region/client/branch as relevant), columns, run() that calls Prisma. Two reports (`other.ai-summary`, complaints) wrap existing endpoints rather than re-implement.

### 3.12 UI/UX conventions

- Follow Design System v1.1: shadcn primitives, tokens, `<ParwestCurrency>`, sonner toasts (`data.message`), `PermissionGate`, region picker drives `?regionId`.
- Tabs in `/reports` layout: Dashboard · Catalog · Scheduled · Library.
- Catalog: search + category filter + grid of report cards. Card click → `catalog/[reportKey]`.
- Run page: left = ParamsForm (auto-built from `paramsSchema`), right = results table with virtualized rows (>1k) and ExportMenu.
- Scheduled: list with active toggle, recipient chips, cron preview + next-run time. AlertDialog for delete.
- Library: paginated table; filters by report, requester, date range, status. Download buttons per row.

### 3.13 Performance / scale

- Most reports cap at <50k rows; we stream rows into formatters, not collect-then-encode (XLSX exceljs streaming writer; CSV streamed; PDF row pages).
- Long-running runs (>10s) run server-side in same request for v1; if a report exceeds 30s, the API returns `{ runId, status: "RUNNING" }` and client polls `library/[runId]`. (Vercel timeout handled.)
- Index hints: rely on existing indexes; add `@@index([reportKey, createdAt])` etc. as in 3.4.

### 3.14 Deletion of legacy

Remove:

- `src/app/(dashboard)/reports/page.tsx` (rewritten)
- `src/app/(dashboard)/reports/generated/page.tsx`
- `src/app/(dashboard)/reports/[screen]/page.tsx`
- `src/app/(dashboard)/reports/clients/client-branch-increase-decrease-report/page.tsx`
- `src/app/(dashboard)/reports/ai/page.tsx` (folded into catalog as `other.ai-summary`; existing API `src/app/api/reports/ai/route.ts` retained, called by definition)

Retain (folded into definitions):

- `src/app/api/reports/scheduled/route.ts` — replaced by new scheduled API
- `src/app/api/reports/clients/enrolled/route.ts` — logic absorbed by `clients.enrolled` definition; route deleted
- `src/app/api/reports/clients/summary/route.ts` — absorbed by `clients.active-inactive` (and others); deleted
- `src/app/api/reports/inventory/store-summary/route.ts` — absorbed by `inventory.total`/`by-region`; deleted
- `src/app/api/reports/guards/deployment/route.ts` — absorbed by `deployments.current`
- `src/app/api/reports/guards/day-night-duty/route.ts` — absorbed by `deployments.day-night`
- `src/app/api/reports/ai/route.ts` — kept; called by `other.ai-summary`

Anywhere else in app linking to old paths gets updated to new paths. `src/lib/parity/screenConfigs.ts::reportLinks` updated to point at the new catalog entries (or deleted if no other consumers).

### 3.15 Testing

- Unit: each `definition.run` against a small fixture set (mock Prisma) returning deterministic rows.
- Snapshot: CSV/XLSX/PDF formatter output for one fixture report.
- API: smoke-test each `run/[reportKey]` returns 200 with file and 401/403 when REPORTS missing.
- Manual: dev server, run 3 reports per category, schedule one, verify library entry + email (if SMTP env present).

### 3.16 Env & config additions

| Variable | Purpose | Required |
|---|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Scheduled email | Optional (degrade) |
| `REPORTS_S3_BUCKET` / `REPORTS_S3_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Artifact storage | Optional (falls back to DB blob) |
| `REPORTS_CRON_SECRET` | Protect `/api/cron/run-scheduled-reports` | Required in prod |

### 3.17 Package additions

- `@react-pdf/renderer` (PDF)
- `cron-parser` (next-run computation)
- `nodemailer` (email; degrade if env missing)
- (`exceljs` already present)

### 3.18 Open questions deferred to v2

- Per-user dashboard widget customization (legacy `dashboard_options_by_users`).
- Self-serve builder.
- Map view (out of scope for this module).
- Drilldown navigation.

---

## 4. Phasing of implementation

1. **Foundations** — Prisma model + migration, registry/types, runner skeleton, storage abstraction, REPORTS access helper, role seed.
2. **Three exemplar definitions** — `guards.hired`, `deployments.current`, `inventory.total` — to validate the contract end-to-end with all three formatters.
3. **UI shell** — layout, tabs, Catalog (cards from registry), Run page (ParamsForm + Results + ExportMenu), Library list.
4. **Executive Dashboard** — KPI strip + 3 charts.
5. **Scheduling** — model, CRUD UI, cron route, email transport.
6. **Remaining 25 definitions** — ported in batches by category; old routes deleted as they're absorbed.
7. **Cleanup & links** — delete legacy report pages/APIs, update `parity/screenConfigs`, add tests.
