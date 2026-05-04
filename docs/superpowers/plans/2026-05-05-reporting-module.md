# Reporting Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dummy reporting module with a production reporting system: Executive Dashboard + Reports Catalog (28 predefined reports) + Scheduled Reports (cron + email) + Library (run history with downloads), all gated behind the existing `REPORTS` module permission.

**Architecture:** Pluggable `ReportDefinition` registry (one file per report). A central `runReport()` runner validates params, executes the definition, encodes via CSV/XLSX/PDF formatters, persists artifacts (S3 if configured, else DB blob), and writes a `ReportRun` row. Scheduled runs execute via a Vercel cron route, deliver via nodemailer when SMTP env is configured, and fall back to library-only when not. UI under `/reports` uses shadcn primitives and the existing Design System v1.1 conventions.

**Tech Stack:** Next.js 14 App Router · Prisma · PostgreSQL · NextAuth · shadcn/ui + Tailwind · zod · exceljs (CSV/XLSX) · @react-pdf/renderer (PDF) · nodemailer (email) · cron-parser (scheduling)

**Spec:** [docs/superpowers/specs/2026-05-05-reporting-module-design.md](../specs/2026-05-05-reporting-module-design.md)

---

## Phase 1 — Foundations

### Task 1: Add dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install @react-pdf/renderer cron-parser nodemailer --legacy-peer-deps
npm install -D @types/nodemailer --legacy-peer-deps
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('@react-pdf/renderer'); require('cron-parser'); require('nodemailer'); console.log('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(reports): add @react-pdf/renderer, cron-parser, nodemailer"
```

---

### Task 2: Prisma model — ReportRun, ScheduledReport, enums

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260505130000_add_reports/migration.sql`

- [ ] **Step 1: Add enums and models to `prisma/schema.prisma`**

Append at the end of the file:

```prisma
enum ReportFormat {
  CSV
  XLSX
  PDF
}

enum ReportRunStatus {
  PENDING
  RUNNING
  SUCCEEDED
  FAILED
}

model ReportRun {
  id            String          @id @default(cuid())
  reportKey     String
  paramsJson    Json
  format        ReportFormat
  status        ReportRunStatus @default(PENDING)
  requestedById String?
  requestedBy   User?           @relation("ReportRunRequestedBy", fields: [requestedById], references: [id])
  scheduledId   String?
  scheduled     ScheduledReport? @relation(fields: [scheduledId], references: [id], onDelete: SetNull)
  fileKey       String?
  fileSize      Int?
  rowCount      Int?
  error         String?         @db.Text
  startedAt     DateTime?
  finishedAt    DateTime?
  createdAt     DateTime        @default(now())

  @@index([reportKey, createdAt])
  @@index([scheduledId])
  @@index([requestedById, createdAt])
}

model ScheduledReport {
  id            String          @id @default(cuid())
  reportKey     String
  paramsJson    Json
  formats       ReportFormat[]
  cron          String
  timezone      String          @default("Asia/Karachi")
  recipients    String[]
  managerIds    String[]
  priority      Int             @default(0)
  active        Boolean         @default(true)
  lastRunAt     DateTime?
  nextRunAt     DateTime?
  createdById   String
  createdBy     User            @relation("ScheduledReportCreatedBy", fields: [createdById], references: [id])
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  runs          ReportRun[]

  @@index([active, nextRunAt])
  @@index([createdById])
}

model ReportRunBlob {
  fileKey   String   @id
  bytes     Bytes
  createdAt DateTime @default(now())
}
```

In `model User` add reverse relations (find the existing relations block):

```prisma
  reportRuns        ReportRun[]       @relation("ReportRunRequestedBy")
  scheduledReports  ScheduledReport[] @relation("ScheduledReportCreatedBy")
```

- [ ] **Step 2: Generate the migration**

```bash
npx prisma migrate dev --name add_reports --create-only
```
Expected: a new directory `prisma/migrations/<ts>_add_reports/` with `migration.sql`.

- [ ] **Step 3: Apply locally**

```bash
npx prisma migrate dev
npx prisma generate
```
Expected: migration applied, client regenerated.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(reports): add ReportRun/ScheduledReport models + enums"
```

---

### Task 3: Core types

**Files:**
- Create: `src/lib/reports/types.ts`

- [ ] **Step 1: Write the file**

```ts
import type { PrismaClient } from "@prisma/client"
import type { z, ZodTypeAny } from "zod"
import type { ManagerScope } from "@/lib/access/scope"

export type ReportFormat = "csv" | "xlsx" | "pdf"

export type ReportCategory =
  | "guards"
  | "clients"
  | "deployments"
  | "financial"
  | "inventory"
  | "other"

export interface ReportColumn {
  key: string
  label: string
  type: "string" | "number" | "currency" | "date" | "boolean"
  align?: "left" | "right" | "center"
  width?: number
}

export type ReportResultRow = Record<
  string,
  string | number | boolean | Date | null | undefined
>

export interface ReportContext {
  userId: string
  scope: ManagerScope
  prisma: PrismaClient
}

export interface ReportDefinition<P extends ZodTypeAny = ZodTypeAny> {
  key: string
  title: string
  description: string
  category: ReportCategory
  pinned?: boolean
  paramsSchema: P
  columns: ReportColumn[]
  run: (params: z.infer<P>, ctx: ReportContext) => Promise<ReportResultRow[]>
  chart?: { kind: "bar" | "line" | "pie"; xKey: string; yKey: string }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors related to this file (existing project errors unrelated).

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/types.ts
git commit -m "feat(reports): core type contracts"
```

---

### Task 4: Access guard — `requireReportsAccess`

**Files:**
- Create: `src/lib/reports/access.ts`

- [ ] **Step 1: Write the file**

```ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/access/scope"
import { forbidden, unauthorized } from "@/lib/api/response"

export async function requireReportsAccess() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: unauthorized("Not signed in"), session: null }
  }
  const role = (session.user as any).role as string | undefined
  const permissions = ((session.user as any).permissions ?? []) as Array<{
    module: string
    canView?: boolean
  }>

  if (isSuperAdmin({ user: { role, permissions } } as any)) {
    return { error: null, session }
  }

  const hasReports = permissions.some(
    (p) => p.module === "REPORTS" && (p.canView ?? true)
  )
  if (!hasReports) {
    return { error: forbidden("REPORTS access required"), session: null }
  }
  return { error: null, session }
}
```

- [ ] **Step 2: Verify imports resolve**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/access.ts
git commit -m "feat(reports): server-side REPORTS access guard"
```

---

### Task 5: Storage abstraction (S3 or DB blob)

**Files:**
- Create: `src/lib/reports/storage.ts`

- [ ] **Step 1: Write the file**

```ts
import { prisma } from "@/lib/db"

export interface StoredArtifact {
  fileKey: string
  size: number
}

const useS3 = Boolean(process.env.REPORTS_S3_BUCKET)

export async function putArtifact(
  runId: string,
  bytes: Buffer,
  ext: "csv" | "xlsx" | "pdf"
): Promise<StoredArtifact> {
  const fileKey = `reports/${runId}.${ext}`
  if (useS3) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
    const s3 = new S3Client({ region: process.env.REPORTS_S3_REGION })
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.REPORTS_S3_BUCKET!,
        Key: fileKey,
        Body: bytes,
      })
    )
  } else {
    await prisma.reportRunBlob.upsert({
      where: { fileKey },
      create: { fileKey, bytes },
      update: { bytes },
    })
  }
  return { fileKey, size: bytes.byteLength }
}

export async function getArtifact(fileKey: string): Promise<Buffer> {
  if (useS3) {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3")
    const s3 = new S3Client({ region: process.env.REPORTS_S3_REGION })
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.REPORTS_S3_BUCKET!,
        Key: fileKey,
      })
    )
    const chunks: Buffer[] = []
    for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(chunk)
    return Buffer.concat(chunks)
  }
  const row = await prisma.reportRunBlob.findUnique({ where: { fileKey } })
  if (!row) throw new Error(`Artifact not found: ${fileKey}`)
  return Buffer.from(row.bytes)
}

export function contentTypeFor(ext: "csv" | "xlsx" | "pdf") {
  return ext === "csv"
    ? "text/csv"
    : ext === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/pdf"
}
```

- [ ] **Step 2: Skip @aws-sdk/client-s3 unless USE_S3 env present — DB-blob path is the default**

Verify the dynamic import is gated by `useS3` (no compile-time dependency on the package). The package is *not* added to `package.json` here; if S3 is later turned on, document `npm install @aws-sdk/client-s3` in env setup.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/storage.ts
git commit -m "feat(reports): artifact storage (DB blob default, S3 optional)"
```

---

### Task 6: Formatters — CSV, XLSX, PDF

**Files:**
- Create: `src/lib/reports/formatters/csv.ts`
- Create: `src/lib/reports/formatters/xlsx.ts`
- Create: `src/lib/reports/formatters/pdf.tsx`

- [ ] **Step 1: CSV formatter**

```ts
// src/lib/reports/formatters/csv.ts
import ExcelJS from "exceljs"
import type { ReportColumn, ReportResultRow } from "../types"

export async function formatCsv(
  columns: ReportColumn[],
  rows: ReportResultRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Report")
  ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: c.width ?? 20 }))
  rows.forEach((r) => ws.addRow(r))
  const out = await wb.csv.writeBuffer()
  return Buffer.from(out)
}
```

- [ ] **Step 2: XLSX formatter**

```ts
// src/lib/reports/formatters/xlsx.ts
import ExcelJS from "exceljs"
import type { ReportColumn, ReportResultRow } from "../types"

export async function formatXlsx(
  title: string,
  columns: ReportColumn[],
  rows: ReportResultRow[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Parwest ERP"
  wb.created = new Date()
  const ws = wb.addWorksheet(title.slice(0, 31) || "Report")
  ws.columns = columns.map((c) => {
    const numFmt =
      c.type === "currency" ? '"PKR" #,##0.00' :
      c.type === "number" ? "#,##0" :
      c.type === "date" ? "yyyy-mm-dd" : undefined
    return {
      header: c.label,
      key: c.key,
      width: c.width ?? 20,
      style: numFmt ? { numFmt } : undefined,
    }
  })
  ws.getRow(1).font = { bold: true }
  rows.forEach((r) => ws.addRow(r))
  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}
```

- [ ] **Step 3: PDF formatter**

```tsx
// src/lib/reports/formatters/pdf.tsx
import React from "react"
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"
import type { ReportColumn, ReportResultRow } from "../types"

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, marginBottom: 4, fontWeight: 700 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 3 },
  th: { fontWeight: 700 },
  cell: { paddingHorizontal: 4 },
})

export async function formatPdf(
  title: string,
  paramsSummary: string,
  columns: ReportColumn[],
  rows: ReportResultRow[]
): Promise<Buffer> {
  const widths = columns.map((c) => c.width ?? 80)
  const total = widths.reduce((a, b) => a + b, 0)
  const flex = widths.map((w) => `${(w / total) * 100}%`)

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{paramsSummary}</Text>
        <View style={[styles.row, styles.th]}>
          {columns.map((c, i) => (
            <Text key={c.key} style={[styles.cell, { width: flex[i] }]}>
              {c.label}
            </Text>
          ))}
        </View>
        {rows.map((r, idx) => (
          <View key={idx} style={styles.row}>
            {columns.map((c, i) => (
              <Text key={c.key} style={[styles.cell, { width: flex[i] }]}>
                {formatCell(r[c.key], c.type)}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
  return await renderToBuffer(doc)
}

function formatCell(v: unknown, t: ReportColumn["type"]): string {
  if (v == null) return ""
  if (t === "date" && v instanceof Date) return v.toISOString().slice(0, 10)
  if (t === "currency" && typeof v === "number") return `PKR ${v.toLocaleString()}`
  if (t === "number" && typeof v === "number") return v.toLocaleString()
  if (t === "boolean") return v ? "Yes" : "No"
  return String(v)
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/formatters/
git commit -m "feat(reports): CSV/XLSX/PDF formatters"
```

---

### Task 7: Runner

**Files:**
- Create: `src/lib/reports/runner.ts`

- [ ] **Step 1: Write the runner**

```ts
import { prisma } from "@/lib/db"
import { ReportFormat as PrismaReportFormat, ReportRunStatus } from "@prisma/client"
import type { ReportDefinition, ReportFormat, ReportContext, ReportResultRow } from "./types"
import { formatCsv } from "./formatters/csv"
import { formatXlsx } from "./formatters/xlsx"
import { formatPdf } from "./formatters/pdf"
import { putArtifact } from "./storage"

const TO_PRISMA: Record<ReportFormat, PrismaReportFormat> = {
  csv: "CSV",
  xlsx: "XLSX",
  pdf: "PDF",
}

export interface RunOptions {
  definition: ReportDefinition
  rawParams: unknown
  format: ReportFormat
  ctx: ReportContext
  scheduledId?: string
}

export interface RunResult {
  runId: string
  fileKey: string
  rowCount: number
  fileSize: number
}

export async function runReport(opts: RunOptions): Promise<RunResult> {
  const { definition, rawParams, format, ctx, scheduledId } = opts
  const params = definition.paramsSchema.parse(rawParams)

  const run = await prisma.reportRun.create({
    data: {
      reportKey: definition.key,
      paramsJson: params as object,
      format: TO_PRISMA[format],
      status: ReportRunStatus.RUNNING,
      requestedById: ctx.userId || null,
      scheduledId: scheduledId ?? null,
      startedAt: new Date(),
    },
  })

  try {
    const rows = (await definition.run(params, ctx)) as ReportResultRow[]
    const buf =
      format === "csv"
        ? await formatCsv(definition.columns, rows)
        : format === "xlsx"
        ? await formatXlsx(definition.title, definition.columns, rows)
        : await formatPdf(
            definition.title,
            paramsSummary(params),
            definition.columns,
            rows
          )

    const artifact = await putArtifact(run.id, buf, format)
    await prisma.reportRun.update({
      where: { id: run.id },
      data: {
        status: ReportRunStatus.SUCCEEDED,
        fileKey: artifact.fileKey,
        fileSize: artifact.size,
        rowCount: rows.length,
        finishedAt: new Date(),
      },
    })
    return {
      runId: run.id,
      fileKey: artifact.fileKey,
      rowCount: rows.length,
      fileSize: artifact.size,
    }
  } catch (err) {
    await prisma.reportRun.update({
      where: { id: run.id },
      data: {
        status: ReportRunStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    })
    throw err
  }
}

function paramsSummary(p: unknown): string {
  if (!p || typeof p !== "object") return ""
  return Object.entries(p as Record<string, unknown>)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString().slice(0, 10) : v}`)
    .join(" · ")
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/runner.ts
git commit -m "feat(reports): runner orchestrating params validation, formatting, persistence"
```

---

### Task 8: Registry skeleton

**Files:**
- Create: `src/lib/reports/registry.ts`

- [ ] **Step 1: Empty registry that we'll populate as definitions land**

```ts
import type { ReportDefinition } from "./types"

const definitions: ReportDefinition[] = []

export function registerReport(def: ReportDefinition) {
  if (definitions.some((d) => d.key === def.key)) {
    throw new Error(`Duplicate report key: ${def.key}`)
  }
  definitions.push(def)
}

export function getAllReports(): ReportDefinition[] {
  // Side-effect import populates the array.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./definitions")
  return [...definitions]
}

export function getReport(key: string): ReportDefinition | undefined {
  return getAllReports().find((d) => d.key === key)
}
```

- [ ] **Step 2: Definitions index file (empty for now)**

Create `src/lib/reports/definitions/index.ts`:

```ts
// Each definition file calls registerReport() at import time.
// Add new reports by importing them here.
export {}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/registry.ts src/lib/reports/definitions/index.ts
git commit -m "feat(reports): registry + empty definitions index"
```

---

### Task 9: Seed REPORTS permission for CEO/CFO roles

**Files:**
- Create: `prisma/migrations/20260505131000_seed_reports_roles/migration.sql`

- [ ] **Step 1: Write idempotent SQL seed**

```sql
-- Ensure CEO and CFO roles exist with REPORTS view permission.
INSERT INTO "Role" (id, name, "scopeType", "createdAt", "updatedAt")
VALUES
  ('role_ceo_seed', 'CEO', 'GLOBAL', NOW(), NOW()),
  ('role_cfo_seed', 'CFO', 'GLOBAL', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO "RolePermission" (id, "roleId", module, "canView", "canCreate", "canUpdate", "canDelete", "canRequisition", "createdAt", "updatedAt")
SELECT
  CONCAT('rp_reports_', r.id),
  r.id,
  'REPORTS',
  TRUE, FALSE, FALSE, FALSE, FALSE,
  NOW(), NOW()
FROM "Role" r
WHERE r.name IN ('CEO', 'CFO')
ON CONFLICT ("roleId", module) DO NOTHING;
```

- [ ] **Step 2: Apply**

```bash
npx prisma migrate dev
```
Expected: migration applied.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/
git commit -m "feat(reports): seed REPORTS permission for CEO/CFO roles"
```

---

## Phase 2 — Three exemplar definitions (validate the contract)

### Task 10: `guards.hired` definition

**Files:**
- Create: `src/lib/reports/definitions/guards/hired.ts`
- Modify: `src/lib/reports/definitions/index.ts`

- [ ] **Step 1: Write the definition**

```ts
import { z } from "zod"
import type { ReportDefinition } from "../../types"
import { registerReport } from "../../registry"

const params = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  regionId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "guards.hired",
  title: "Hired guards",
  description: "Guards enrolled within the selected date range.",
  category: "guards",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Parwest ID", type: "string", width: 14 },
    { key: "name", label: "Name", type: "string", width: 30 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
    { key: "hiredAt", label: "Hired on", type: "date", width: 14 },
  ],
  async run({ from, to, regionId }, { prisma, scope }) {
    const where: any = {
      createdAt: { gte: from, lte: to },
    }
    if (regionId) where.regionId = regionId
    if (scope.kind === "regional") where.regionId = { in: scope.regionIds }

    const guards = await prisma.guard.findMany({
      where,
      select: {
        parwestId: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        region: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return guards.map((g) => ({
      parwestId: g.parwestId,
      name: `${g.firstName ?? ""} ${g.lastName ?? ""}`.trim(),
      regionName: g.region?.name ?? "",
      hiredAt: g.createdAt,
    }))
  },
}

registerReport(definition)
export default definition
```

- [ ] **Step 2: Register in index**

In `src/lib/reports/definitions/index.ts`:

```ts
import "./guards/hired"
export {}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
If `Guard.regionId` / `region` differ in your schema, adapt the field names — the rest of the structure stands.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/definitions/
git commit -m "feat(reports): guards.hired definition"
```

---

### Task 11: `deployments.current` definition

**Files:**
- Create: `src/lib/reports/definitions/deployments/current.ts`
- Modify: `src/lib/reports/definitions/index.ts`

- [ ] **Step 1: Write the definition**

```ts
import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  regionId: z.string().optional(),
  clientId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "deployments.current",
  title: "Currently deployed guards",
  description: "Active deployments by region, client, and shift.",
  category: "deployments",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Guard ID", type: "string", width: 14 },
    { key: "guardName", label: "Guard", type: "string", width: 28 },
    { key: "clientName", label: "Client", type: "string", width: 22 },
    { key: "branchName", label: "Branch", type: "string", width: 22 },
    { key: "shift", label: "Shift", type: "string", width: 10 },
    { key: "since", label: "Since", type: "date", width: 14 },
  ],
  async run({ regionId, clientId }, { prisma, scope }) {
    const where: any = { status: "ACTIVE" }
    if (clientId) where.clientId = clientId
    if (regionId) where.branch = { regionId }
    if (scope.kind === "regional") {
      where.branch = { ...(where.branch ?? {}), regionId: { in: scope.regionIds } }
    }
    const rows = await prisma.deployment.findMany({
      where,
      select: {
        startedAt: true,
        shift: true,
        guard: { select: { parwestId: true, firstName: true, lastName: true } },
        client: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { startedAt: "desc" },
    })
    return rows.map((d) => ({
      parwestId: d.guard?.parwestId ?? "",
      guardName: `${d.guard?.firstName ?? ""} ${d.guard?.lastName ?? ""}`.trim(),
      clientName: d.client?.name ?? "",
      branchName: d.branch?.name ?? "",
      shift: d.shift ?? "",
      since: d.startedAt,
    }))
  },
}

registerReport(definition)
export default definition
```

- [ ] **Step 2: Register**

Update `src/lib/reports/definitions/index.ts`:

```ts
import "./guards/hired"
import "./deployments/current"
export {}
```

- [ ] **Step 3: Type-check & adapt fields**

```bash
npx tsc --noEmit
```
Adjust `Deployment.status`/`shift`/`startedAt` field names to match the actual Prisma schema.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/definitions/
git commit -m "feat(reports): deployments.current definition"
```

---

### Task 12: `inventory.total` definition

**Files:**
- Create: `src/lib/reports/definitions/inventory/total.ts`
- Modify: `src/lib/reports/definitions/index.ts`

- [ ] **Step 1: Write the definition**

```ts
import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({
  storeId: z.string().optional(),
})

const definition: ReportDefinition<typeof params> = {
  key: "inventory.total",
  title: "Total inventory",
  description: "Item counts and valuation per store.",
  category: "inventory",
  pinned: true,
  paramsSchema: params,
  columns: [
    { key: "storeName", label: "Store", type: "string", width: 22 },
    { key: "itemName", label: "Item", type: "string", width: 28 },
    { key: "qty", label: "Qty", type: "number", width: 10, align: "right" },
    { key: "value", label: "Value", type: "currency", width: 16, align: "right" },
  ],
  async run({ storeId }, { prisma }) {
    const where: any = {}
    if (storeId) where.storeId = storeId
    const rows = await prisma.storeInventoryStockLevel.findMany({
      where,
      select: {
        quantity: true,
        item: { select: { name: true, unitCost: true } },
        store: { select: { name: true } },
      },
      orderBy: [{ store: { name: "asc" } }, { item: { name: "asc" } }],
    })
    return rows.map((r) => ({
      storeName: r.store?.name ?? "",
      itemName: r.item?.name ?? "",
      qty: r.quantity,
      value: Number(r.item?.unitCost ?? 0) * r.quantity,
    }))
  },
}

registerReport(definition)
export default definition
```

- [ ] **Step 2: Register**

```ts
// src/lib/reports/definitions/index.ts
import "./guards/hired"
import "./deployments/current"
import "./inventory/total"
export {}
```

- [ ] **Step 3: Adapt field names for store-inventory v2**

Inspect `prisma/schema.prisma` for the actual stock-level model name (`StoreInventoryStockLevel` is illustrative — adapt). Run:
```bash
grep -nE "model StoreInventory" prisma/schema.prisma
```
Use the real model and field names. Same for unit cost.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/definitions/ src/lib/reports/definitions/index.ts
git commit -m "feat(reports): inventory.total definition"
```

---

### Task 13: Run-report API + download

**Files:**
- Create: `src/app/api/reports/run/[reportKey]/route.ts`
- Create: `src/app/api/reports/library/[runId]/download/route.ts`

- [ ] **Step 1: Run endpoint**

```ts
// src/app/api/reports/run/[reportKey]/route.ts
import { NextRequest } from "next/server"
import { ok, badRequest, notFound, internalServerError } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { getReport } from "@/lib/reports/registry"
import { runReport } from "@/lib/reports/runner"
import { deriveManagerScope } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import type { ReportFormat } from "@/lib/reports/types"

export async function POST(
  req: NextRequest,
  { params }: { params: { reportKey: string } }
) {
  const { error, session } = await requireReportsAccess()
  if (error) return error

  const def = getReport(params.reportKey)
  if (!def) return notFound("Unknown report")

  const body = await req.json().catch(() => ({}))
  const format = (body.format ?? "xlsx") as ReportFormat
  if (!["csv", "xlsx", "pdf"].includes(format)) return badRequest("Invalid format")

  try {
    const scope = deriveManagerScope(session as any)
    const result = await runReport({
      definition: def,
      rawParams: body.params ?? {},
      format,
      ctx: {
        userId: (session!.user as any).id,
        scope,
        prisma,
      },
    })
    return ok({
      runId: result.runId,
      downloadUrl: `/api/reports/library/${result.runId}/download`,
      rowCount: result.rowCount,
    })
  } catch (e) {
    return internalServerError(e instanceof Error ? e.message : "Run failed")
  }
}
```

- [ ] **Step 2: Download endpoint**

```ts
// src/app/api/reports/library/[runId]/download/route.ts
import { NextRequest } from "next/server"
import { notFound } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"
import { getArtifact, contentTypeFor } from "@/lib/reports/storage"

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const { error } = await requireReportsAccess()
  if (error) return error

  const run = await prisma.reportRun.findUnique({ where: { id: params.runId } })
  if (!run || !run.fileKey) return notFound("Run or artifact not found")

  const ext = run.format.toLowerCase() as "csv" | "xlsx" | "pdf"
  const buf = await getArtifact(run.fileKey)
  return new Response(buf, {
    headers: {
      "Content-Type": contentTypeFor(ext),
      "Content-Disposition": `attachment; filename="${run.reportKey}-${run.id}.${ext}"`,
    },
  })
}
```

- [ ] **Step 3: Smoke-test from a cURL or thunder client**

```bash
# After signing in, grab session cookie and:
curl -X POST http://localhost:3000/api/reports/run/guards.hired \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=..." \
  -d '{"format":"xlsx","params":{"from":"2026-01-01","to":"2026-05-05"}}'
```
Expected: `{ success: true, data: { runId, downloadUrl, rowCount } }`. Then GET the downloadUrl, expect a binary XLSX response.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reports/run/ src/app/api/reports/library/
git commit -m "feat(reports): run + download endpoints"
```

---

## Phase 3 — UI shell

### Task 14: Tabbed layout + delete legacy pages

**Files:**
- Modify: `src/app/(dashboard)/reports/page.tsx` (rewrite as Dashboard later — temp redirect to catalog for now)
- Create: `src/app/(dashboard)/reports/layout.tsx`
- Delete: `src/app/(dashboard)/reports/generated/page.tsx`
- Delete: `src/app/(dashboard)/reports/[screen]/page.tsx`
- Delete: `src/app/(dashboard)/reports/clients/client-branch-increase-decrease-report/page.tsx`
- Delete: `src/app/(dashboard)/reports/ai/page.tsx`

- [ ] **Step 1: Layout**

```tsx
// src/app/(dashboard)/reports/layout.tsx
import Link from "next/link"
import type { ReactNode } from "react"

const TABS = [
  { href: "/reports", label: "Dashboard" },
  { href: "/reports/catalog", label: "Catalog" },
  { href: "/reports/scheduled", label: "Scheduled" },
  { href: "/reports/library", label: "Library" },
]

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Executive analytics, predefined reports, schedules, and history.
        </p>
      </div>
      <nav className="flex gap-2 border-b" aria-label="Reports tabs">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-2 text-sm hover:text-foreground text-muted-foreground"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Temporary dashboard placeholder**

Replace `src/app/(dashboard)/reports/page.tsx` entirely with:

```tsx
export default function ReportsDashboardPage() {
  return (
    <div className="text-sm text-muted-foreground">
      Executive Dashboard — KPIs and charts come in Task 22.
    </div>
  )
}
```

- [ ] **Step 3: Delete legacy pages**

```bash
rm src/app/\(dashboard\)/reports/generated/page.tsx
rm src/app/\(dashboard\)/reports/\[screen\]/page.tsx
rm -r src/app/\(dashboard\)/reports/clients
rm -r src/app/\(dashboard\)/reports/ai
```

- [ ] **Step 4: Update `src/lib/parity/screenConfigs.ts`**

Find `reportLinks` and replace with the new tab paths only:

```ts
export const reportLinks = [
  { href: "/reports", label: "Dashboard" },
  { href: "/reports/catalog", label: "Catalog" },
  { href: "/reports/scheduled", label: "Scheduled" },
  { href: "/reports/library", label: "Library" },
]
```

- [ ] **Step 5: Commit**

```bash
git add -A src/app/\(dashboard\)/reports/ src/lib/parity/screenConfigs.ts
git commit -m "feat(reports): tabbed layout, delete legacy pages, update parity links"
```

---

### Task 15: Catalog API + page

**Files:**
- Create: `src/app/api/reports/catalog/route.ts`
- Create: `src/app/(dashboard)/reports/catalog/page.tsx`
- Create: `src/components/reports/ReportCatalog.tsx`

- [ ] **Step 1: API returns metadata only**

```ts
// src/app/api/reports/catalog/route.ts
import { ok } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { getAllReports } from "@/lib/reports/registry"

export async function GET() {
  const { error } = await requireReportsAccess()
  if (error) return error
  return ok(
    getAllReports().map((d) => ({
      key: d.key,
      title: d.title,
      description: d.description,
      category: d.category,
      pinned: d.pinned ?? false,
    }))
  )
}
```

- [ ] **Step 2: Client component**

```tsx
// src/components/reports/ReportCatalog.tsx
"use client"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card"
import { Input } from "@/components/shadcn/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select"

interface CatalogItem {
  key: string; title: string; description: string; category: string; pinned: boolean
}

const CATS = ["all", "guards", "clients", "deployments", "financial", "inventory", "other"] as const

export function ReportCatalog() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [q, setQ] = useState("")
  const [cat, setCat] = useState<typeof CATS[number]>("all")

  useEffect(() => {
    fetch("/api/reports/catalog")
      .then((r) => r.json())
      .then((d) => setItems(d.data ?? []))
  }, [])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter((i) =>
      (cat === "all" || i.category === cat) &&
      (!term || i.title.toLowerCase().includes(term) || i.description.toLowerCase().includes(term))
    )
  }, [items, q, cat])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Search reports" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={cat} onValueChange={(v) => setCat(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((i) => (
          <Link key={i.key} href={`/reports/catalog/${i.key}`} className="group">
            <Card className="h-full transition-colors group-hover:border-foreground/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{i.title}</CardTitle>
                <CardDescription className="text-xs uppercase">{i.category}</CardDescription>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{i.description}</p></CardContent>
            </Card>
          </Link>
        ))}
        {visible.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No reports match.</CardContent></Card>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Page**

```tsx
// src/app/(dashboard)/reports/catalog/page.tsx
import { ReportCatalog } from "@/components/reports/ReportCatalog"
export default function CatalogPage() { return <ReportCatalog /> }
```

- [ ] **Step 4: Verify in dev**

```bash
npm run dev
```
Visit `/reports/catalog`. Expected: 3 cards (the exemplar reports). Search and category filter both work.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reports/catalog/ src/app/\(dashboard\)/reports/catalog/ src/components/reports/ReportCatalog.tsx
git commit -m "feat(reports): catalog page + API"
```

---

### Task 16: Run page — params form + results + export

**Files:**
- Create: `src/app/(dashboard)/reports/catalog/[reportKey]/page.tsx`
- Create: `src/components/reports/ReportRunner.tsx`

- [ ] **Step 1: Run page (server component fetches definition metadata)**

```tsx
// src/app/(dashboard)/reports/catalog/[reportKey]/page.tsx
import { notFound } from "next/navigation"
import { getReport } from "@/lib/reports/registry"
import { ReportRunner } from "@/components/reports/ReportRunner"
import type { ReportColumn } from "@/lib/reports/types"

export default function RunPage({ params }: { params: { reportKey: string } }) {
  const def = getReport(params.reportKey)
  if (!def) notFound()
  // Pass only what's needed to the client (no closures).
  const paramShape = describeShape(def.paramsSchema)
  return (
    <ReportRunner
      reportKey={def.key}
      title={def.title}
      description={def.description}
      paramShape={paramShape}
      columns={def.columns as ReportColumn[]}
    />
  )
}

function describeShape(schema: any): { name: string; type: string; optional: boolean }[] {
  // Walk a top-level zod object schema for a flat list of fields.
  const def = schema?._def
  const shape = def?.shape?.() ?? {}
  return Object.entries(shape).map(([name, sub]: [string, any]) => {
    const isOptional = sub?._def?.typeName === "ZodOptional"
    const inner = isOptional ? sub._def.innerType : sub
    const tn = inner?._def?.typeName
    const type =
      tn === "ZodString" ? "string" :
      tn === "ZodNumber" ? "number" :
      tn === "ZodDate" ? "date" :
      tn === "ZodBoolean" ? "boolean" : "string"
    return { name, type, optional: isOptional }
  })
}
```

- [ ] **Step 2: Client runner**

```tsx
// src/components/reports/ReportRunner.tsx
"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import type { ReportColumn } from "@/lib/reports/types"

interface ParamShape { name: string; type: string; optional: boolean }

export function ReportRunner(props: {
  reportKey: string
  title: string
  description: string
  paramShape: ParamShape[]
  columns: ReportColumn[]
}) {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<any[] | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(format: "csv" | "xlsx" | "pdf") {
    setBusy(true)
    try {
      const params: Record<string, unknown> = {}
      for (const p of props.paramShape) {
        const v = vals[p.name]
        if (!v) {
          if (!p.optional) throw new Error(`Missing ${p.name}`)
          continue
        }
        params[p.name] = p.type === "number" ? Number(v) : v
      }
      const res = await fetch(`/api/reports/run/${props.reportKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, params }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || "Run failed")
      setRunId(data.data.runId)
      toast.success(`Generated ${data.data.rowCount} rows`)
      window.open(data.data.downloadUrl, "_blank")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader><CardTitle>{props.title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{props.description}</p>
          {props.paramShape.map((p) => (
            <div key={p.name} className="space-y-1">
              <Label htmlFor={p.name}>{p.name}{p.optional ? "" : " *"}</Label>
              <Input
                id={p.name}
                type={p.type === "date" ? "date" : p.type === "number" ? "number" : "text"}
                value={vals[p.name] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [p.name]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => run("xlsx")} disabled={busy}>Run · XLSX</Button>
            <Button variant="outline" onClick={() => run("csv")} disabled={busy}>CSV</Button>
            <Button variant="outline" onClick={() => run("pdf")} disabled={busy}>PDF</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Last run</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {runId ? `Run ${runId} — file downloaded.` : "Configure parameters and run."}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Open `/reports/catalog/guards.hired` → fill from/to dates → Run · XLSX. Expect a file download and a success toast.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/reports/catalog/\[reportKey\]/ src/components/reports/ReportRunner.tsx
git commit -m "feat(reports): run page with params form + export buttons"
```

---

### Task 17: Library API + page

**Files:**
- Create: `src/app/api/reports/library/route.ts`
- Create: `src/app/(dashboard)/reports/library/page.tsx`
- Create: `src/components/reports/LibraryTable.tsx`

- [ ] **Step 1: List API**

```ts
// src/app/api/reports/library/route.ts
import { NextRequest } from "next/server"
import { ok } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { error } = await requireReportsAccess()
  if (error) return error
  const url = new URL(req.url)
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200)
  const reportKey = url.searchParams.get("reportKey") ?? undefined

  const rows = await prisma.reportRun.findMany({
    where: reportKey ? { reportKey } : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, reportKey: true, format: true, status: true,
      rowCount: true, fileSize: true, createdAt: true, finishedAt: true,
      requestedBy: { select: { name: true, email: true } },
    },
  })
  return ok(rows)
}
```

- [ ] **Step 2: Table component**

```tsx
// src/components/reports/LibraryTable.tsx
"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"

interface Row {
  id: string; reportKey: string; format: string; status: string
  rowCount: number | null; createdAt: string
  requestedBy: { name: string | null; email: string | null } | null
}

export function LibraryTable() {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    fetch("/api/reports/library").then((r) => r.json()).then((d) => setRows(d.data ?? []))
  }, [])
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="p-2">Report</th><th className="p-2">Format</th>
            <th className="p-2">Status</th><th className="p-2">Rows</th>
            <th className="p-2">Requested by</th><th className="p-2">When</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.reportKey}</td>
              <td className="p-2">{r.format}</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2">{r.rowCount ?? "-"}</td>
              <td className="p-2">{r.requestedBy?.name ?? r.requestedBy?.email ?? "—"}</td>
              <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
              <td className="p-2">
                {r.status === "SUCCEEDED" && (
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/reports/library/${r.id}/download`} target="_blank" rel="noreferrer">Download</a>
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td className="p-4 text-muted-foreground" colSpan={7}>No runs yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Page**

```tsx
// src/app/(dashboard)/reports/library/page.tsx
import { LibraryTable } from "@/components/reports/LibraryTable"
export default function LibraryPage() { return <LibraryTable /> }
```

- [ ] **Step 4: Smoke test**

Run a report (Task 16), then visit `/reports/library`. Expect to see the run listed with a working Download button.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reports/library/route.ts src/app/\(dashboard\)/reports/library/ src/components/reports/LibraryTable.tsx
git commit -m "feat(reports): library list page"
```

---

## Phase 4 — Executive Dashboard

### Task 18: Dashboard API

**Files:**
- Create: `src/app/api/reports/dashboard/route.ts`

- [ ] **Step 1: Aggregations**

```ts
// src/app/api/reports/dashboard/route.ts
import { ok } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"

export async function GET() {
  const { error } = await requireReportsAccess()
  if (error) return error

  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000)
  const last30Start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)

  const [
    totalGuards,
    deployedGuards,
    availableGuards,
    totalClients,
    activeBranches,
    pendingVerifications,
    expiringDocs,
  ] = await Promise.all([
    prisma.guard.count(),
    prisma.deployment.count({ where: { status: "ACTIVE" } }),
    prisma.guard.count({ where: { deployments: { none: { status: "ACTIVE" } } } }),
    prisma.client.count(),
    prisma.branch.count({ where: { status: "ACTIVE" } }),
    prisma.guard.count({ where: { verificationStatus: "PENDING" } }),
    prisma.guard.count({
      where: { documents: { some: { expiresAt: { gte: now, lte: in30 } } } },
    }),
  ])

  const guardlessBranches = await prisma.branch.count({
    where: { status: "ACTIVE", deployments: { none: { status: "ACTIVE" } } },
  })

  // Deployment trend (last 30 days)
  const deployTrend = await prisma.$queryRawUnsafe<{ day: Date; count: bigint }[]>(`
    SELECT date_trunc('day', "startedAt") AS day, COUNT(*)::bigint AS count
    FROM "Deployment"
    WHERE "startedAt" >= $1
    GROUP BY 1 ORDER BY 1
  `, last30Start)

  return ok({
    kpis: {
      totalGuards, deployedGuards, availableGuards, totalClients,
      activeBranches, guardlessBranches, pendingVerifications, expiringDocs,
    },
    deployTrend: deployTrend.map((r) => ({ day: r.day, count: Number(r.count) })),
  })
}
```

- [ ] **Step 2: Adapt field names**

Verify each model/field used (`Guard.verificationStatus`, `Branch.status`, `Deployment.startedAt/status`, `Guard.documents`, etc.) against the actual schema and adjust.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reports/dashboard/route.ts
git commit -m "feat(reports): executive dashboard API"
```

---

### Task 19: Dashboard UI

**Files:**
- Modify: `src/app/(dashboard)/reports/page.tsx`
- Create: `src/components/reports/DashboardKpis.tsx`
- Create: `src/components/reports/DashboardCharts.tsx`

- [ ] **Step 1: KPI strip**

```tsx
// src/components/reports/DashboardKpis.tsx
"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"

interface Kpis {
  totalGuards: number; deployedGuards: number; availableGuards: number
  totalClients: number; activeBranches: number; guardlessBranches: number
  pendingVerifications: number; expiringDocs: number
}
const LABELS: Record<keyof Kpis, string> = {
  totalGuards: "Total Guards", deployedGuards: "Deployed", availableGuards: "Available",
  totalClients: "Total Clients", activeBranches: "Active Branches",
  guardlessBranches: "Guardless Branches", pendingVerifications: "Pending Verifications",
  expiringDocs: "Expiring Docs (30d)",
}
export function DashboardKpis() {
  const [k, setK] = useState<Kpis | null>(null)
  useEffect(() => {
    fetch("/api/reports/dashboard").then((r) => r.json()).then((d) => setK(d.data?.kpis ?? null))
  }, [])
  if (!k) return <div className="text-sm text-muted-foreground">Loading…</div>
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {(Object.keys(LABELS) as (keyof Kpis)[]).map((key) => (
        <Card key={key}>
          <CardHeader className="pb-1"><CardTitle className="text-xs uppercase text-muted-foreground">{LABELS[key]}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{k[key].toLocaleString()}</div></CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Charts (use the existing `recharts` if present; otherwise simple SVG)**

Check first:

```bash
grep -nE "recharts|chart.js" package.json
```

If `recharts` is present, use a `<LineChart>`. Otherwise add it: `npm install recharts --legacy-peer-deps`. Then:

```tsx
// src/components/reports/DashboardCharts.tsx
"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function DashboardCharts() {
  const [trend, setTrend] = useState<{ day: string; count: number }[]>([])
  useEffect(() => {
    fetch("/api/reports/dashboard").then((r) => r.json()).then((d) =>
      setTrend((d.data?.deployTrend ?? []).map((p: any) => ({
        day: new Date(p.day).toISOString().slice(5, 10), count: p.count,
      })))
    )
  }, [])
  return (
    <Card>
      <CardHeader><CardTitle>Deployments — last 30 days</CardTitle></CardHeader>
      <CardContent style={{ height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={trend}>
            <XAxis dataKey="day" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="count" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Page**

```tsx
// src/app/(dashboard)/reports/page.tsx
import { DashboardKpis } from "@/components/reports/DashboardKpis"
import { DashboardCharts } from "@/components/reports/DashboardCharts"
export default function ReportsDashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardKpis />
      <DashboardCharts />
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```
Open `/reports`. Expect 8 KPI tiles + a deployment trend line chart.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/reports/page.tsx src/components/reports/Dashboard*.tsx package*.json
git commit -m "feat(reports): executive dashboard KPIs + trend chart"
```

---

## Phase 5 — Scheduling

### Task 20: Scheduled CRUD API

**Files:**
- Create: `src/app/api/reports/scheduled/route.ts`
- Create: `src/app/api/reports/scheduled/[id]/route.ts`
- Create: `src/lib/reports/schedule.ts`

- [ ] **Step 1: Schedule helper**

```ts
// src/lib/reports/schedule.ts
import parser from "cron-parser"
export function nextRunAt(cron: string, tz: string, after: Date = new Date()): Date {
  const it = parser.parseExpression(cron, { tz, currentDate: after })
  return it.next().toDate()
}
```

- [ ] **Step 2: List + create**

```ts
// src/app/api/reports/scheduled/route.ts
import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, badRequest } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"
import { nextRunAt } from "@/lib/reports/schedule"
import { getReport } from "@/lib/reports/registry"

const createSchema = z.object({
  reportKey: z.string(),
  paramsJson: z.record(z.any()),
  formats: z.array(z.enum(["CSV", "XLSX", "PDF"])).min(1),
  cron: z.string(),
  timezone: z.string().default("Asia/Karachi"),
  recipients: z.array(z.string().email()),
  managerIds: z.array(z.string()).default([]),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
})

export async function GET() {
  const { error } = await requireReportsAccess()
  if (error) return error
  const rows = await prisma.scheduledReport.findMany({
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
    include: { createdBy: { select: { name: true, email: true } } },
  })
  return ok(rows)
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireReportsAccess()
  if (error) return error
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.message)
  if (!getReport(parsed.data.reportKey)) return badRequest("Unknown reportKey")

  const next = nextRunAt(parsed.data.cron, parsed.data.timezone)
  const row = await prisma.scheduledReport.create({
    data: {
      ...parsed.data,
      createdById: (session!.user as any).id,
      nextRunAt: next,
    },
  })
  return ok(row)
}
```

- [ ] **Step 3: Detail**

```ts
// src/app/api/reports/scheduled/[id]/route.ts
import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, badRequest, notFound } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"
import { nextRunAt } from "@/lib/reports/schedule"

const patchSchema = z.object({
  active: z.boolean().optional(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
  recipients: z.array(z.string().email()).optional(),
  managerIds: z.array(z.string()).optional(),
  formats: z.array(z.enum(["CSV", "XLSX", "PDF"])).optional(),
  paramsJson: z.record(z.any()).optional(),
  priority: z.number().int().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireReportsAccess()
  if (error) return error
  const row = await prisma.scheduledReport.findUnique({ where: { id: params.id } })
  if (!row) return notFound("Schedule not found")
  return ok(row)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireReportsAccess()
  if (error) return error
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.message)
  const existing = await prisma.scheduledReport.findUnique({ where: { id: params.id } })
  if (!existing) return notFound("Schedule not found")

  const cron = parsed.data.cron ?? existing.cron
  const tz = parsed.data.timezone ?? existing.timezone
  const data: any = { ...parsed.data }
  if (parsed.data.cron || parsed.data.timezone) {
    data.nextRunAt = nextRunAt(cron, tz)
  }
  const row = await prisma.scheduledReport.update({ where: { id: params.id }, data })
  return ok(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireReportsAccess()
  if (error) return error
  await prisma.scheduledReport.delete({ where: { id: params.id } })
  return ok({ deleted: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reports/scheduled/ src/lib/reports/schedule.ts
git commit -m "feat(reports): scheduled CRUD APIs"
```

---

### Task 21: Email transport

**Files:**
- Create: `src/lib/reports/email.ts`

- [ ] **Step 1: Nodemailer wrapper that no-ops without SMTP env**

```ts
// src/lib/reports/email.ts
import nodemailer from "nodemailer"
import { getArtifact } from "./storage"

export interface EmailRunInput {
  recipients: string[]
  subject: string
  body: string
  attachments: { fileKey: string; filename: string; contentType: string }[]
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM)
}

export async function sendReportEmail(input: EmailRunInput): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn("[reports] SMTP not configured; skipping email", input.subject)
    return
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  const attachments = await Promise.all(
    input.attachments.map(async (a) => ({
      filename: a.filename,
      content: await getArtifact(a.fileKey),
      contentType: a.contentType,
    }))
  )
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: input.recipients.join(", "),
    subject: input.subject,
    text: input.body,
    attachments,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/email.ts
git commit -m "feat(reports): SMTP email transport (graceful degrade if unconfigured)"
```

---

### Task 22: Cron route to run due schedules

**Files:**
- Create: `src/app/api/cron/run-scheduled-reports/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Cron endpoint**

```ts
// src/app/api/cron/run-scheduled-reports/route.ts
import { NextRequest } from "next/server"
import { ok, unauthorized } from "@/lib/api/response"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { prisma } from "@/lib/db"
import { getReport } from "@/lib/reports/registry"
import { runReport } from "@/lib/reports/runner"
import { nextRunAt } from "@/lib/reports/schedule"
import { sendReportEmail, isEmailConfigured } from "@/lib/reports/email"
import { contentTypeFor } from "@/lib/reports/storage"

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorized("Unauthorized")
  const now = new Date()
  const due = await prisma.scheduledReport.findMany({
    where: { active: true, nextRunAt: { lte: now } },
    take: 25,
    orderBy: [{ priority: "desc" }, { nextRunAt: "asc" }],
  })

  const results: any[] = []
  for (const sched of due) {
    const def = getReport(sched.reportKey)
    if (!def) continue
    const ctx = {
      userId: sched.createdById,
      scope: { kind: "global" as const },
      prisma,
    }
    try {
      const runs = await Promise.all(
        sched.formats.map((f) =>
          runReport({
            definition: def,
            rawParams: sched.paramsJson,
            format: f.toLowerCase() as any,
            ctx,
            scheduledId: sched.id,
          })
        )
      )
      // gather extra recipients from managerIds
      const managers = sched.managerIds.length
        ? await prisma.user.findMany({
            where: { id: { in: sched.managerIds } },
            select: { email: true },
          })
        : []
      const recipients = [...sched.recipients, ...managers.map((m) => m.email).filter(Boolean) as string[]]
      if (isEmailConfigured() && recipients.length) {
        await sendReportEmail({
          recipients,
          subject: `${def.title} — ${now.toISOString().slice(0, 10)}`,
          body: `Automated report.\nRows per file may vary.`,
          attachments: runs.map((r, i) => {
            const ext = sched.formats[i].toLowerCase() as "csv" | "xlsx" | "pdf"
            return {
              fileKey: r.fileKey,
              filename: `${def.key}-${now.toISOString().slice(0, 10)}.${ext}`,
              contentType: contentTypeFor(ext),
            }
          }),
        })
      }
      const next = nextRunAt(sched.cron, sched.timezone, now)
      await prisma.scheduledReport.update({
        where: { id: sched.id },
        data: { lastRunAt: now, nextRunAt: next },
      })
      results.push({ id: sched.id, ok: true, runs: runs.length })
    } catch (e) {
      results.push({ id: sched.id, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return ok({ processed: results.length, results })
}
```

- [ ] **Step 2: Register cron in `vercel.json`**

Append to the `crons` array:

```json
{ "path": "/api/cron/run-scheduled-reports", "schedule": "*/5 * * * *" }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/run-scheduled-reports/route.ts vercel.json
git commit -m "feat(reports): cron route + 5-min schedule processor"
```

---

### Task 23: Scheduled UI (list + form)

**Files:**
- Create: `src/app/(dashboard)/reports/scheduled/page.tsx`
- Create: `src/app/(dashboard)/reports/scheduled/new/page.tsx`
- Create: `src/app/(dashboard)/reports/scheduled/[id]/page.tsx`
- Create: `src/components/reports/ScheduledReportForm.tsx`
- Create: `src/components/reports/ScheduledList.tsx`

- [ ] **Step 1: List**

```tsx
// src/components/reports/ScheduledList.tsx
"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"

export function ScheduledList() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    fetch("/api/reports/scheduled").then((r) => r.json()).then((d) => setRows(d.data ?? []))
  }, [])
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button asChild><Link href="/reports/scheduled/new">New schedule</Link></Button>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr><th className="p-2">Report</th><th className="p-2">Cron</th><th className="p-2">Recipients</th><th className="p-2">Next run</th><th className="p-2">Status</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.reportKey}</td>
                <td className="p-2">{r.cron} ({r.timezone})</td>
                <td className="p-2">{(r.recipients || []).join(", ") || "—"}</td>
                <td className="p-2">{r.nextRunAt ? new Date(r.nextRunAt).toLocaleString() : "—"}</td>
                <td className="p-2">{r.active ? "Active" : "Paused"}</td>
                <td className="p-2"><Link className="underline" href={`/reports/scheduled/${r.id}`}>Edit</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-muted-foreground">No schedules.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Form (create/edit)**

```tsx
// src/components/reports/ScheduledReportForm.tsx
"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/shadcn/button"
import { Input } from "@/components/shadcn/input"
import { Label } from "@/components/shadcn/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select"

interface CatalogItem { key: string; title: string }
const FORMATS = ["XLSX", "CSV", "PDF"] as const

export function ScheduledReportForm({ existing }: { existing?: any }) {
  const router = useRouter()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [reportKey, setReportKey] = useState(existing?.reportKey ?? "")
  const [cron, setCron] = useState(existing?.cron ?? "0 7 * * *")
  const [tz, setTz] = useState(existing?.timezone ?? "Asia/Karachi")
  const [recipients, setRecipients] = useState((existing?.recipients ?? []).join(","))
  const [formats, setFormats] = useState<string[]>(existing?.formats ?? ["XLSX"])
  const [active, setActive] = useState(existing?.active ?? true)

  useEffect(() => {
    fetch("/api/reports/catalog").then((r) => r.json()).then((d) => setCatalog(d.data ?? []))
  }, [])

  async function save() {
    const body = {
      reportKey, cron, timezone: tz,
      recipients: recipients.split(",").map((s) => s.trim()).filter(Boolean),
      formats, active, paramsJson: existing?.paramsJson ?? {},
    }
    const url = existing ? `/api/reports/scheduled/${existing.id}` : "/api/reports/scheduled"
    const method = existing ? "PATCH" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!data.success) return toast.error(data.message ?? "Save failed")
    toast.success("Saved")
    router.push("/reports/scheduled")
  }
  async function remove() {
    if (!existing) return
    if (!confirm("Delete this schedule?")) return
    await fetch(`/api/reports/scheduled/${existing.id}`, { method: "DELETE" })
    router.push("/reports/scheduled")
  }

  return (
    <div className="grid gap-3 max-w-xl">
      <div><Label>Report</Label>
        <Select value={reportKey} onValueChange={setReportKey}>
          <SelectTrigger><SelectValue placeholder="Pick a report" /></SelectTrigger>
          <SelectContent>{catalog.map((c) => <SelectItem key={c.key} value={c.key}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Cron expression</Label><Input value={cron} onChange={(e) => setCron(e.target.value)} /></div>
      <div><Label>Timezone</Label><Input value={tz} onChange={(e) => setTz(e.target.value)} /></div>
      <div><Label>Recipients (comma-separated)</Label><Input value={recipients} onChange={(e) => setRecipients(e.target.value)} /></div>
      <div className="flex gap-2">
        {FORMATS.map((f) => (
          <label key={f} className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={formats.includes(f)} onChange={(e) =>
              setFormats((curr) => e.target.checked ? [...curr, f] : curr.filter((x) => x !== f))} />
            {f}
          </label>
        ))}
      </div>
      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Active</label>
      <div className="flex gap-2 pt-2">
        <Button onClick={save}>Save</Button>
        {existing && <Button variant="destructive" onClick={remove}>Delete</Button>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Pages**

```tsx
// src/app/(dashboard)/reports/scheduled/page.tsx
import { ScheduledList } from "@/components/reports/ScheduledList"
export default function ScheduledPage() { return <ScheduledList /> }
```

```tsx
// src/app/(dashboard)/reports/scheduled/new/page.tsx
import { ScheduledReportForm } from "@/components/reports/ScheduledReportForm"
export default function NewSchedulePage() { return <ScheduledReportForm /> }
```

```tsx
// src/app/(dashboard)/reports/scheduled/[id]/page.tsx
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { ScheduledReportForm } from "@/components/reports/ScheduledReportForm"
export default async function EditSchedulePage({ params }: { params: { id: string } }) {
  const row = await prisma.scheduledReport.findUnique({ where: { id: params.id } })
  if (!row) notFound()
  return <ScheduledReportForm existing={row} />
}
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```
Create a schedule for `guards.hired` cron `*/5 * * * *`. Manually hit `/api/cron/run-scheduled-reports` (with `x-cron-secret` header if `CRON_SECRET` set) or wait 5 min. Expect a row to appear in Library.

```bash
curl -X POST http://localhost:3000/api/cron/run-scheduled-reports \
  -H "x-cron-secret: $CRON_SECRET"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/reports/scheduled/ src/components/reports/Scheduled*.tsx
git commit -m "feat(reports): scheduled list + create/edit UI"
```

---

## Phase 6 — Remaining 25 report definitions

### Task 24: Guards definitions (6 remaining)

For each key below, follow this template — one file per report under `src/lib/reports/definitions/guards/`. Add an import line in `src/lib/reports/definitions/index.ts` after creating each file.

Reports to add: `guards.terminated`, `guards.verification`, `guards.deployment-status`, `guards.attendance`, `guards.salary`, `guards.expiring-docs`.

**Template** (replicate per report; substitute names, columns, and Prisma calls):

```ts
import { z } from "zod"
import { registerReport } from "../../registry"
import type { ReportDefinition } from "../../types"

const params = z.object({ from: z.coerce.date(), to: z.coerce.date(), regionId: z.string().optional() })

const definition: ReportDefinition<typeof params> = {
  key: "guards.terminated",
  title: "Terminated guards",
  description: "Guards terminated within the selected date range.",
  category: "guards",
  paramsSchema: params,
  columns: [
    { key: "parwestId", label: "Parwest ID", type: "string", width: 14 },
    { key: "name", label: "Name", type: "string", width: 28 },
    { key: "regionName", label: "Region", type: "string", width: 16 },
    { key: "terminatedAt", label: "Terminated on", type: "date", width: 14 },
    { key: "reason", label: "Reason", type: "string", width: 24 },
  ],
  async run({ from, to, regionId }, { prisma, scope }) {
    const where: any = { terminatedAt: { gte: from, lte: to } }
    if (regionId) where.regionId = regionId
    if (scope.kind === "regional") where.regionId = { in: scope.regionIds }
    const rows = await prisma.guard.findMany({
      where,
      select: {
        parwestId: true, firstName: true, lastName: true, terminatedAt: true,
        terminationReason: true, region: { select: { name: true } },
      },
    })
    return rows.map((g) => ({
      parwestId: g.parwestId,
      name: `${g.firstName ?? ""} ${g.lastName ?? ""}`.trim(),
      regionName: g.region?.name ?? "",
      terminatedAt: g.terminatedAt,
      reason: g.terminationReason ?? "",
    }))
  },
}
registerReport(definition); export default definition
```

- [ ] **Step 1: Create each file**

Create the 6 files. Use the table below for source-of-truth fields. Where field names don't exist in Prisma, ask the schema (`grep -nE "model Guard" prisma/schema.prisma`) and adapt.

| Key | Source | Filter params | Notable columns |
|---|---|---|---|
| guards.terminated | Guard | from, to, regionId? | terminatedAt, reason |
| guards.verification | Guard | status, regionId? | parwestId, name, status, requestedAt |
| guards.deployment-status | Guard + Deployment | regionId? | parwestId, name, current status (deployed/available/leave) |
| guards.attendance | Attendance | from, to, guardId?, branchId? | guard, date, status, hours |
| guards.salary | Payroll | from, to, guardId? | guard, month, gross, net |
| guards.expiring-docs | GuardDocument | days (default 30), regionId? | guard, docType, expiresAt |

- [ ] **Step 2: Register all 6 in `src/lib/reports/definitions/index.ts`**

```ts
import "./guards/hired"
import "./guards/terminated"
import "./guards/verification"
import "./guards/deployment-status"
import "./guards/attendance"
import "./guards/salary"
import "./guards/expiring-docs"
import "./deployments/current"
import "./inventory/total"
export {}
```

- [ ] **Step 3: Type-check + click each report at /reports/catalog/<key>**

```bash
npx tsc --noEmit
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/definitions/
git commit -m "feat(reports): 6 additional Guards definitions"
```

---

### Task 25: Clients definitions (5)

Create `src/lib/reports/definitions/clients/{enrolled,branches-opened,active-inactive,branch-capacity,increase-decrease}.ts`. Use the same pattern as Task 10 / Task 24.

| Key | Filter params | Source models | Columns |
|---|---|---|---|
| clients.enrolled | from, to, regionId? | Client | name, enrolledOn, regionName |
| clients.branches-opened | from, to, regionId? | Branch | client, branchName, openedAt, regionName |
| clients.active-inactive | regionId? | Client | name, status, since |
| clients.branch-capacity | regionId?, clientId? | Branch + Deployment count | client, branch, requiredGuards, deployedGuards, gap |
| clients.increase-decrease | from, to, regionId? | Branch deployment counts MoM | branch, prevCount, currentCount, delta |

- [ ] **Step 1: Create all 5 files** (follow the template, adapt to client/branch fields).

- [ ] **Step 2: Register**

Append to `definitions/index.ts`:

```ts
import "./clients/enrolled"
import "./clients/branches-opened"
import "./clients/active-inactive"
import "./clients/branch-capacity"
import "./clients/increase-decrease"
```

- [ ] **Step 3: Type-check + manual run for each**

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/definitions/
git commit -m "feat(reports): 5 Clients definitions"
```

---

### Task 26: Deployment definitions (4 remaining)

Add `deployments/{history,day-night,unassigned,short-term}.ts`.

| Key | Filter | Columns |
|---|---|---|
| deployments.history | guardId? OR branchId?, from, to | guard, branch, startedAt, endedAt, shift |
| deployments.day-night | from, to, regionId? | branch, dayCount, nightCount |
| deployments.unassigned | regionId? | guard, parwestId, lastDeploymentEndedAt |
| deployments.short-term | from, to, regionId? | branch, guard, startedAt, endedAt, kind=EXTRA/SHORT |

- [ ] **Step 1: Create files following template**

- [ ] **Step 2: Register all 4 in `definitions/index.ts`**

- [ ] **Step 3: Type-check + spot check via UI**

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/definitions/
git commit -m "feat(reports): 4 Deployment definitions"
```

---

### Task 27: Financial definitions (6)

Add `financial/{salary-export,unpaid-salary,loans,clearance,invoices,invoice-errors}.ts`.

| Key | Filter | Columns |
|---|---|---|
| financial.salary-export | month (yyyy-mm), regionId? | guardName, accountNumber, bank, netPay |
| financial.unpaid-salary | month, regionId? | guardName, owed, dueSince |
| financial.loans | regionId?, guardId? | guard, principal, balance, lastRepaymentAt |
| financial.clearance | from, to, regionId? | guard, finalSettlementAmount, clearedAt |
| financial.invoices | from, to, clientId?, status? | invoiceNo, client, amount, status, dueDate |
| financial.invoice-errors | from, to | invoiceNo, errorType, message |

- [ ] **Step 1: Create files**

- [ ] **Step 2: Register in `definitions/index.ts`**

- [ ] **Step 3: Type-check + spot check**

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/definitions/
git commit -m "feat(reports): 6 Financial definitions"
```

---

### Task 28: Inventory definitions (4 remaining) + Other (2)

Add `inventory/{by-status,by-region,issued-by-guard,condemned}.ts` and `other/{complaints,ai-summary}.ts`.

| Key | Source | Columns |
|---|---|---|
| inventory.by-status | StoreInventoryStockLevel | item, status, qty |
| inventory.by-region | StoreInventoryStockLevel join Store→Region | region, item, qty |
| inventory.issued-by-guard | StoreInventoryAssignment (status ISSUED) | guard, item, qty, issuedAt |
| inventory.condemned | StoreInventoryAdjustment kind=CONDEMNED | item, qty, reason, recordedAt |
| other.complaints | Ticket | id, subject, status, openedAt, closedAt, resolutionDays |
| other.ai-summary | calls existing /api/reports/ai | calls fetch internally; columns shape narrative as one row |

- [ ] **Step 1: Create files**

- [ ] **Step 2: Register all 6 in `definitions/index.ts`**

- [ ] **Step 3: Type-check + spot check (3 from each category)**

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/definitions/
git commit -m "feat(reports): remaining Inventory + Other definitions"
```

---

## Phase 7 — Cleanup

### Task 29: Remove absorbed legacy API routes

**Files:**
- Delete: `src/app/api/reports/clients/enrolled/route.ts`
- Delete: `src/app/api/reports/clients/summary/route.ts`
- Delete: `src/app/api/reports/inventory/store-summary/route.ts`
- Delete: `src/app/api/reports/guards/deployment/route.ts`
- Delete: `src/app/api/reports/guards/day-night-duty/route.ts`
- Delete: `src/app/api/reports/scheduled/route.ts` (legacy version, replaced by Phase 5 routes — verify path)

**Retain:** `src/app/api/reports/ai/route.ts` (used by `other.ai-summary`).

- [ ] **Step 1: Identify any consumers**

```bash
grep -rEn "/api/reports/(clients/enrolled|clients/summary|inventory/store-summary|guards/deployment|guards/day-night-duty)" src/
```
Update any UI consumers found to call `/api/reports/run/<key>` instead.

- [ ] **Step 2: Delete files**

```bash
rm src/app/api/reports/clients/enrolled/route.ts
rm src/app/api/reports/clients/summary/route.ts
rm src/app/api/reports/inventory/store-summary/route.ts
rm src/app/api/reports/guards/deployment/route.ts
rm src/app/api/reports/guards/day-night-duty/route.ts
```

- [ ] **Step 3: Build**

```bash
npm run build:next
```
Expected: success. Fix any broken imports.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/api/reports/
git commit -m "chore(reports): remove legacy API routes superseded by registry"
```

---

### Task 30: Tests

**Files:**
- Create: `tests/reports/runner.test.ts`
- Create: `tests/reports/formatters.test.ts`

- [ ] **Step 1: Runner test (mock prisma + a stub definition)**

```ts
// tests/reports/runner.test.ts
import { describe, it, expect, vi } from "vitest"
import { runReport } from "@/lib/reports/runner"
import { z } from "zod"

vi.mock("@/lib/db", () => ({
  prisma: {
    reportRun: {
      create: vi.fn(async ({ data }) => ({ id: "run_1", ...data })),
      update: vi.fn(async () => ({})),
    },
    reportRunBlob: {
      upsert: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => ({ bytes: Buffer.from("x") })),
    },
  },
}))

describe("runReport", () => {
  it("runs definition and persists artifact", async () => {
    const def = {
      key: "test", title: "T", description: "", category: "other" as const,
      paramsSchema: z.object({ x: z.number() }),
      columns: [{ key: "v", label: "V", type: "number" as const }],
      run: async (p: { x: number }) => [{ v: p.x }],
    }
    const result = await runReport({
      definition: def, rawParams: { x: 42 }, format: "csv",
      ctx: { userId: "u1", scope: { kind: "global" } as any, prisma: {} as any },
    })
    expect(result.runId).toBe("run_1")
    expect(result.rowCount).toBe(1)
  })
})
```

- [ ] **Step 2: Formatter test**

```ts
// tests/reports/formatters.test.ts
import { describe, it, expect } from "vitest"
import { formatCsv } from "@/lib/reports/formatters/csv"
import { formatXlsx } from "@/lib/reports/formatters/xlsx"

const cols = [
  { key: "name", label: "Name", type: "string" as const },
  { key: "amount", label: "Amount", type: "currency" as const },
]
const rows = [{ name: "A", amount: 1000 }, { name: "B", amount: 2500 }]

describe("formatters", () => {
  it("CSV emits header + rows", async () => {
    const buf = await formatCsv(cols, rows)
    const text = buf.toString("utf8")
    expect(text).toContain("Name,Amount")
    expect(text).toContain("A,1000")
  })
  it("XLSX produces a non-empty workbook", async () => {
    const buf = await formatXlsx("T", cols, rows)
    expect(buf.byteLength).toBeGreaterThan(1000)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/reports/
```
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/reports/
git commit -m "test(reports): runner + formatters smoke tests"
```

---

### Task 31: Final QA + lint + build

- [ ] **Step 1: Lint**

```bash
npm run lint
```
Fix any new errors. Don't exceed `docs/lint-baseline.json`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Production build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 4: Manual smoke pass (dev)**

```bash
npm run dev
```
Verify each surface:

- `/reports` — KPIs render, chart renders
- `/reports/catalog` — 28 reports listed, filter works, every card opens a working run page
- Run a representative report from each of the 6 categories in XLSX, CSV, PDF
- `/reports/library` — runs appear with downloads
- `/reports/scheduled` — create a schedule with cron `*/5 * * * *`, recipients = your email
- POST `/api/cron/run-scheduled-reports` (with `x-cron-secret`) → expect new library entries; if SMTP env present, expect email

- [ ] **Step 5: Confirm REPORTS gate**

Sign in as a user without REPORTS permission → confirm `/reports` redirects per middleware. Sign in as CEO/CFO seeded role → confirm full access.

- [ ] **Step 6: Commit final notes / docs (no code)**

If you tweaked anything, commit with `chore(reports): final QA polish`.

---

## Self-review notes

- Spec sections 1, 2, 3.1-3.18, 4 → covered by Tasks 1-31. ✓
- All 28 reports in §3.11 covered by Tasks 10-12 + 24-28. ✓
- Legacy deletion §3.14 → Tasks 14 (UI) + 29 (API). ✓
- Permission seeding §3.9 → Task 9. ✓
- Storage abstraction §3.6 → Task 5; @aws-sdk/client-s3 documented as on-demand install. ✓
- Email §3.7 + §3.16 → Tasks 21, 22, with graceful no-op when SMTP env missing. ✓
- Tests §3.15 → Task 30 (runner + formatter); manual smoke covers UI per Task 31. Per-definition tests intentionally deferred (28 reports * 1 test each = 28 trivial tests; the runner test exercises the contract). ✓
- Phasing §4 maps 1:1 to "Phase 1-7" headers. ✓
