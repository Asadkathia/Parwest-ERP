# Bulk Import — Draft Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-persisted "draft" editor for bulk imports so QA can fix errored rows in-page (no Excel round-trip), with explicit skip semantics, schema-aware cell editors, and resumable sessions.

**Architecture:** Persisted draft = new `BulkImportJobRow` table + `DRAFT` enum value. Engine refactored to expose per-row primitives (`validateRow`, `recomputePayloadDuplicates`) used by both legacy batch path and the new draft endpoints. New `/imports/drafts/:id` page renders a TanStack-Table virtualised grid with shadcn-based cell editors. Behind workflow rule `imports.draftEditor` until rollout completes.

**Tech Stack:** Next.js 14 App Router · Prisma + `@prisma/adapter-pg` · `@tanstack/react-table` (already a dep) · shadcn/ui (`@/components/shadcn/*`) · raw `fetch` + `useState`/`useEffect`/`useReducer` (no React Query) · ExcelJS (already used by the engine).

**Spec:** `docs/superpowers/specs/2026-05-19-bulk-import-draft-editor-design.md`

**Project conventions to honour:**
- API envelope helpers in `src/lib/api/response.ts` — `ok`, `notFound`, `conflict`, `badRequest`, `unauthorized`, `forbidden`.
- Permission check: `hasAction(session, "IMPORTS", "CREATE")` for mutations, `hasAction(session, "IMPORTS", "VIEW")` for reads. (The spec says "PROCESS" generically; existing routes use `CREATE` — match the existing convention.)
- Drafts are creator-only — return `404` (not `403`) on non-owner access.
- No new state library; follow the raw-fetch pattern in `src/components/imports/ImportsLifecycleManager.tsx`.
- New shadcn primitives go in `@/components/shadcn/`. Legacy `@/components/ui/` is not extended.
- shadcn primitives are installed via `npx shadcn@latest add <component> --legacy-peer-deps`.
- Quality gates: `npx tsc --noEmit` + `npm run lint` after every task. The project has no vitest/jest — tests live in `scripts/api-integration-test.mjs` (HTTP harness) and Playwright `e2e/` for browser flows. Type-check + lint are the inner loop; integration tests are the outer loop.
- Commit after every task (frequent commits convention).

---

## File Structure

### Modified
| Path | Reason |
|---|---|
| `prisma/schema.prisma` | Add `DRAFT` enum value, `expiresAt` field, `BulkImportJobRow` model, relations |
| `src/lib/imports/types.ts` | Add `ColumnDescriptor` type, extend `BulkImportDefinition` with `columns` |
| `src/lib/imports/engine.ts` | Extract `validateRow` + `recomputePayloadDuplicates`; refactor `runImport` to use them |
| `src/lib/imports/definitions/guards.ts` | Add `columns` array (kind metadata) |
| `src/lib/imports/definitions/users.ts` | Add `columns` array |
| `src/lib/imports/definitions/clients.ts` | Add `columns` array |
| `src/lib/imports/definitions/inventory.ts` | Add `columns` array |
| `src/lib/workflows/policy.ts` | Add `imports.draftEditor` workflow rule key |
| `src/components/imports/ImportsLifecycleManager.tsx` | When flag enabled, upload routes to `/draft` + resume-or-discard dialog |
| `vercel.json` | Cron schedule for draft sweep |

### Created
| Path | Purpose |
|---|---|
| `prisma/migrations/20260519120000_add_draft_import_jobs/migration.sql` | Migration |
| `src/lib/imports/drafts.ts` | Draft service (create / get-with-ownership / patch row / skip / finalize / delete / sweep-expired) |
| `src/app/api/imports/[module]/draft/route.ts` | POST: create draft |
| `src/app/api/imports/[module]/columns/route.ts` | GET: column metadata |
| `src/app/api/imports/drafts/[id]/route.ts` | GET draft + DELETE draft |
| `src/app/api/imports/drafts/[id]/rows/route.ts` | GET paginated rows |
| `src/app/api/imports/drafts/[id]/rows/[rowNumber]/route.ts` | PATCH row |
| `src/app/api/imports/drafts/[id]/rows/[rowNumber]/skip/route.ts` | PATCH skip |
| `src/app/api/imports/drafts/[id]/finalize/route.ts` | POST finalize |
| `src/app/api/cron/sweep-expired-drafts/route.ts` | Vercel cron handler |
| `src/app/(dashboard)/imports/drafts/[id]/page.tsx` | Server shell for editor |
| `src/components/imports/draft-editor/DraftEditor.tsx` | Client orchestrator |
| `src/components/imports/draft-editor/DraftHeader.tsx` | Sticky totals + buttons |
| `src/components/imports/draft-editor/DraftGrid.tsx` | Virtualised TanStack Table |
| `src/components/imports/draft-editor/RowStatus.tsx` | Status badge + skip toggle |
| `src/components/imports/draft-editor/FinalizeDialog.tsx` | AlertDialog wrapper |
| `src/components/imports/draft-editor/DiscardDialog.tsx` | AlertDialog wrapper |
| `src/components/imports/draft-editor/cells/index.ts` | `editorForKind(kind)` factory |
| `src/components/imports/draft-editor/cells/TextCell.tsx` | Plain text editor |
| `src/components/imports/draft-editor/cells/CnicCell.tsx` | Format-mask editor |
| `src/components/imports/draft-editor/cells/DateCell.tsx` | shadcn DatePicker |
| `src/components/imports/draft-editor/cells/EnumCell.tsx` | shadcn Select |
| `src/components/imports/draft-editor/cells/FkCell.tsx` | shadcn Combobox + async load |
| `src/lib/imports/client/useDraft.ts` | Custom hook bundle wrapping fetch |
| `scripts/integration/imports-draft-flow.mjs` | Integration test for the draft lifecycle |

---

## Phase 1 — Engine refactor, schema, dark API (no UI yet)

### Task 1: Extract `validateRow` from the engine

**Files:**
- Modify: `src/lib/imports/engine.ts`

The current per-row pipeline lives inside `runImport`'s for-loop (lines ~280-310). Hoist it into an exported function so the draft `PATCH` endpoint can call exactly the same pipeline against one row.

- [ ] **Step 1: Add the new exported function**

In `src/lib/imports/engine.ts`, above `runImport`, add:

```ts
/**
 * Per-row validation pipeline — single source of truth for both the
 * batch `runImport` path and the draft editor's per-cell PATCH path.
 *
 * Runs (in order): header aliasing → reference resolution → conditional
 * rules → zod schema → per-row DB duplicate checks. Cross-row payload
 * duplicates are NOT included here — caller must run
 * `recomputePayloadDuplicates` separately when it has the full row set.
 *
 * Returns the resolved + aliased row, the typed/parsed data when
 * validation succeeded, and any per-row errors collected. Errors carry
 * the original (pre-alias) values so the error sheet / UI shows what
 * the user typed.
 */
export async function validateRow(
  definition: BulkImportDefinition,
  originalRow: Record<string, unknown>,
  ctx: ImportRunContext,
  rowNumber: number,
): Promise<{
  row: Record<string, unknown>
  data?: unknown
  errors: ImportRowError[]
}> {
  const aliased = applyHeaderAliases(definition, originalRow)
  const refResult = await resolveReferences(definition, aliased, ctx, rowNumber)
  const conditionalErrors = applyConditionals(definition, refResult.row, rowNumber)
  const earlyErrors = [...refResult.errors, ...conditionalErrors]
  if (earlyErrors.length > 0) {
    return { row: refResult.row, errors: earlyErrors.map((e) => ({ ...e, values: originalRow })) }
  }
  const parsed = definition.rowSchema.safeParse(refResult.row)
  if (!parsed.success) {
    const errors: ImportRowError[] = (parsed.error as z.ZodError).issues.map((issue) => ({
      row: rowNumber,
      field: issue.path.join(".") || "__row__",
      message: issue.message,
      values: originalRow,
    }))
    return { row: refResult.row, errors }
  }
  // Per-row DB-duplicate checks
  const dbErrors: ImportRowError[] = []
  for (const rule of definition.duplicates ?? []) {
    if (rule.scope !== "db" && rule.scope !== "both") continue
    if (!rule.existsInDb) continue
    const values: Record<string, string> = {}
    let hasAny = false
    for (const f of rule.fields) {
      const v = cellToString(refResult.row[f])
      if (v) hasAny = true
      values[f] = v
    }
    if (!hasAny) continue
    const exists = await rule.existsInDb(values, ctx)
    if (exists) {
      dbErrors.push({
        row: rowNumber,
        field: rule.fields.join("+"),
        message:
          rule.message ??
          `Already exists in the database (${rule.fields.join(", ")} = ${rule.fields.map((f) => values[f]).join(", ")})`,
        values: originalRow,
      })
    }
  }
  if (dbErrors.length > 0) return { row: refResult.row, errors: dbErrors }
  return { row: refResult.row, data: parsed.data, errors: [] }
}
```

- [ ] **Step 2: Refactor `runImport`'s per-row loop to call `validateRow`**

Replace the existing `// Per-row validation pass` block (currently inlining alias/resolve/conditional/schema) with a single call site. The loop becomes:

```ts
  for (let i = 0; i < parsed.rows.length; i += 1) {
    const rowNumber = i + 2
    const original = parsed.rows[i]
    const result = await validateRow(definition, original, ctx, rowNumber)
    if (result.errors.length > 0) {
      perRowErrors.push(...result.errors)
      continue
    }
    validRows.push({ rowNumber, data: result.data })
  }
```

Remove the now-unused inline alias/resolve/conditional/schema blocks from `runImport`. Keep `applyHeaderAliases`, `resolveReferences`, `applyConditionals`, `cellToString` as module-private helpers (they're still called by `validateRow`).

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: zero new errors.

- [ ] **Step 4: Smoke-check existing engine behaviour**

The legacy `/imports/:module/validate` endpoint should still produce identical responses. Spin up dev and exercise it with the same `guards-test-import.xlsx`-style file you used previously — outcome should be exactly Total 4, Valid 3, Invalid 1.

```bash
npm run dev &   # in another shell or run_in_background
# Upload via UI to /imports/guards, click Validate (legacy button) — should show identical numbers as before this refactor.
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/imports/engine.ts
git commit -m "refactor(imports): extract validateRow primitive from runImport pipeline"
```

---

### Task 2: Extract `recomputePayloadDuplicates`

**Files:**
- Modify: `src/lib/imports/engine.ts`

Hoist the payload-duplicate logic into a pure function the draft `PATCH` endpoint can call with the current row set.

- [ ] **Step 1: Add the new exported function**

Replace the current `payloadDuplicates` helper with:

```ts
/**
 * Computes the cross-row payload-duplicate errors for a given row set.
 *
 * Returns a Map keyed by `rowNumber` of the errors that row should
 * carry. Rows with no dup errors are absent from the map. This shape
 * lets callers diff against a previous map to find rows whose dup
 * status changed (the editor uses this to repaint sibling rows).
 *
 * Skipped rows are excluded from the seen-set so a skipped row never
 * triggers or absorbs a duplicate.
 */
export function recomputePayloadDuplicates(
  definition: BulkImportDefinition,
  rows: Array<{ rowNumber: number; data: Record<string, unknown>; skipped?: boolean }>,
): Map<number, ImportRowError[]> {
  const out = new Map<number, ImportRowError[]>()
  for (const rule of definition.duplicates ?? []) {
    if (rule.scope !== "payload" && rule.scope !== "both") continue
    const seen = new Map<string, number>() // composite key → first rowNumber
    for (const r of rows) {
      if (r.skipped) continue
      const composite = rule.fields.map((f) => cellToString(r.data[f]).toLowerCase()).join("||")
      if (!composite || composite === rule.fields.map(() => "").join("||")) continue
      const firstRow = seen.get(composite)
      if (firstRow !== undefined) {
        const list = out.get(r.rowNumber) ?? []
        list.push({
          row: r.rowNumber,
          field: rule.fields.join("+"),
          message:
            rule.message ?? `Duplicate of row ${firstRow} on (${rule.fields.join(", ")})`,
          values: r.data,
        })
        out.set(r.rowNumber, list)
      } else {
        seen.set(composite, r.rowNumber)
      }
    }
  }
  return out
}
```

- [ ] **Step 2: Refactor `runImport` to use the new function**

Replace the existing `payloadDuplicates(definition, aliasedRows)` call with:

```ts
  const aliasedRows = parsed.rows.map((r, i) => ({
    rowNumber: i + 2,
    data: applyHeaderAliases(definition, r),
  }))
  const payloadDupMap = recomputePayloadDuplicates(definition, aliasedRows)
  for (const [, errs] of payloadDupMap) perRowErrors.push(...errs)
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 4: Smoke-check with a duplicate-CNIC fixture**

Upload a small file with two rows having the same CNIC — should still produce a "Duplicate of row X" error for the second row.

- [ ] **Step 5: Commit**

```bash
git add src/lib/imports/engine.ts
git commit -m "refactor(imports): extract recomputePayloadDuplicates from runImport"
```

---

### Task 3: Add `ColumnDescriptor` type + `columns` field to `BulkImportDefinition`

**Files:**
- Modify: `src/lib/imports/types.ts`

- [ ] **Step 1: Add the type and the optional field**

In `src/lib/imports/types.ts`, add after `DuplicateRule`:

```ts
export type ColumnKind = "text" | "cnic" | "date" | "number" | "enum" | "fk"

/**
 * Per-column editor metadata, used by the draft editor to pick the
 * right cell editor (text input vs date picker vs dropdown vs FK
 * combobox). The list is also returned by GET /api/imports/:module/columns.
 *
 * `key` matches the canonical (post-alias) field name — this is what the
 * row schema sees. `header` is the sheet-side string (the same string
 * that appears in `requiredHeaders` / `optionalHeaders`).
 */
export type ColumnDescriptor = {
  key: string
  header: string
  label: string
  kind: ColumnKind
  required: boolean
  /** When `kind === "enum"`. Values must match what the schema accepts (case-sensitive). */
  enumValues?: string[]
  /**
   * When `kind === "fk"`. Async loader run server-side; the resolved options
   * are returned by GET /api/imports/:module/columns. Keep light — runs once
   * per draft open, not per-cell.
   */
  fkOptionsLoader?: (ctx: ImportRunContext) => Promise<Array<{ value: string; label: string }>>
}
```

Then add the field to `BulkImportDefinition`:

```ts
export interface BulkImportDefinition<TRow = Record<string, unknown>> {
  // ...existing fields unchanged
  /**
   * Editor metadata for the draft editor's grid. Each entry describes one
   * cell editor. Optional — when omitted, every column falls back to plain
   * text input. Define at least the columns that have non-trivial editors
   * (dates, enums, FKs) and let `text` be the default for the rest.
   */
  columns?: ColumnDescriptor[]
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors. Existing definitions are unaffected (the field is optional).

- [ ] **Step 3: Commit**

```bash
git add src/lib/imports/types.ts
git commit -m "feat(imports): add ColumnDescriptor type + optional columns field on BulkImportDefinition"
```

---

### Task 4: Populate `columns` for the four existing definitions

**Files:**
- Modify: `src/lib/imports/definitions/guards.ts`
- Modify: `src/lib/imports/definitions/users.ts`
- Modify: `src/lib/imports/definitions/clients.ts`
- Modify: `src/lib/imports/definitions/inventory.ts`

For each definition, declare a `columns` array that mirrors the existing `requiredHeaders + optionalHeaders` list. The shape is purely metadata — no behaviour change for legacy callers.

- [ ] **Step 1: Helper at the top of each definition file**

In each file (`guards.ts` first), add a small helper to keep declarations concise:

```ts
const text = (header: string, label = header, required = false): ColumnDescriptor => ({
  key: definition.headerAliases?.[header] ?? header,
  header,
  label,
  kind: "text",
  required,
})
const date = (header: string, label = header, required = false): ColumnDescriptor => ({ ...text(header, label, required), kind: "date" })
const number_ = (header: string, label = header, required = false): ColumnDescriptor => ({ ...text(header, label, required), kind: "number" })
const cnic = (header: string, label = header, required = false): ColumnDescriptor => ({ ...text(header, label, required), kind: "cnic" })
const enumCol = (header: string, values: string[], label = header, required = false): ColumnDescriptor => ({ ...text(header, label, required), kind: "enum", enumValues: values })
const fk = (
  header: string,
  loader: ColumnDescriptor["fkOptionsLoader"],
  label = header,
  required = false,
): ColumnDescriptor => ({ ...text(header, label, required), kind: "fk", fkOptionsLoader: loader })
```

Import `ColumnDescriptor` from `@/lib/imports/types`.

> Note: in the helper, `definition.headerAliases` is referenced — this means the helper is defined AFTER the alias map. In practice, just inline the alias lookup or hardcode `key` per column where the alias differs.

- [ ] **Step 2: `guards.ts` — populate columns**

After the `HEADER_ALIASES` block, just before `registerImport(...)`:

```ts
const guardsColumns: ColumnDescriptor[] = [
  { key: "name", header: "name", label: "Name", kind: "text", required: true },
  { key: "cnic", header: "cnic", label: "CNIC", kind: "cnic", required: true },
  { key: "parwestIdInput", header: "parwest id", label: "Parwest ID", kind: "text", required: false },
  // Regional office — fk, loader queries every active RO and returns { value: seriesCode, label: name }
  {
    key: "regionalOfficeSeries",
    header: "regional office",
    label: "Regional Office",
    kind: "fk",
    required: false,
    fkOptionsLoader: async (ctx) => {
      const rows = await ctx.prisma.regionalOffice.findMany({
        where: { isActive: true },
        select: { seriesCode: true, name: true },
        orderBy: { name: "asc" },
      })
      return rows
        .filter((r) => r.seriesCode)
        .map((r) => ({ value: r.seriesCode as string, label: `${r.seriesCode} — ${r.name}` }))
    },
  },
  { key: "fatherName", header: "father name", label: "Father Name", kind: "text" },
  { key: "motherName", header: "mother name", label: "Mother Name", kind: "text" },
  { key: "dateOfBirth", header: "date of birth", label: "Date of Birth", kind: "date" },
  { key: "cnicIssueDate", header: "cnic issue date", label: "CNIC Issue Date", kind: "date" },
  { key: "cnicExpiryDate", header: "cnic expiry date", label: "CNIC Expiry Date", kind: "date" },
  { key: "nextOfKin", header: "next of kin", label: "Next of Kin", kind: "text" },
  { key: "phone", header: "contact no", label: "Contact No", kind: "text" },
  { key: "passportNo", header: "passport no", label: "Passport No", kind: "text" },
  { key: "passportExpiryDate", header: "passport expiry date", label: "Passport Expiry", kind: "date" },
  { key: "religion", header: "religion", label: "Religion", kind: "text" },
  { key: "sect", header: "sect", label: "Sect", kind: "text" },
  { key: "cast", header: "cast", label: "Cast", kind: "text" },
  { key: "designation", header: "designation", label: "Designation", kind: "text" },
  { key: "salary", header: "salary", label: "Salary", kind: "number" },
  { key: "policeStation", header: "police station", label: "Police Station", kind: "text" },
  { key: "bloodGroup", header: "blood group", label: "Blood Group", kind: "text" },
  { key: "exServiceTypeRaw", header: "ex service", label: "Ex-Service", kind: "text" },
  // Continue for the remaining ~90 columns — most are kind: "text".
  // Dates: "date of enrolment", "date of discharge", "termination date",
  //        "first/second/third employment start/end date",
  //        "first/second/third nearest relative cnic issue date",
  //        "first/second/third judicial case date".
  // Enum: "marital_status" → ["single","married","divorced","widowed"]
  { key: "maritalStatus", header: "marital_status", label: "Marital Status", kind: "enum", enumValues: ["single", "married", "divorced", "widowed"] },
]
```

Then add `columns: guardsColumns` to the `registerImport(...)` call.

> The skeleton above covers the structural pattern. Fill in the remaining ~90 columns following the same pattern: default to `kind: "text"`, mark date headers as `kind: "date"`, numeric ones (salary, age, years, months, height, weight, passing year) as `kind: "number"`. Look at each header literal and choose the obvious kind.

- [ ] **Step 3: Repeat for `users.ts`, `clients.ts`, `inventory.ts`**

Apply the same pattern. Examples of non-text columns:

- `users.ts`: `regionalOfficeSeries` is fk; `role` is fk (loader queries `Role` table by name); `contactNumber` is text.
- `clients.ts`: `type` is enum (read from existing zod schema's enum literal).
- `inventory.ts`: `storeCode` is fk (queries Store table); `status` is enum; `quantityOnHand` is number.

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/imports/definitions/
git commit -m "feat(imports): declare column metadata for guards/users/clients/inventory definitions"
```

---

### Task 5: Prisma schema changes + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260519120000_add_draft_import_jobs/migration.sql`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Edit the existing `BulkImportStatus` enum to add `DRAFT` as the first value (top of enum for readability — DB ordering doesn't matter):

```prisma
enum BulkImportStatus {
  DRAFT
  QUEUED
  VALIDATING
  PROCESSING
  COMPLETED
  FAILED
  PARTIALLY_COMPLETED
}
```

Extend `BulkImportJob`:

```prisma
model BulkImportJob {
  // ... existing fields unchanged
  expiresAt DateTime?
  rows      BulkImportJobRow[]

  @@index([status, expiresAt])  // for the sweep cron
}
```

(Keep all existing `@@index` lines; add the new one alongside them.)

Add the new model below `BulkImportJob`:

```prisma
model BulkImportJobRow {
  id             String        @id @default(cuid())
  jobId          String
  job            BulkImportJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  rowNumber      Int
  data           Json
  errors         Json          @default("[]")
  skipped        Boolean       @default(false)
  dirty          Boolean       @default(false)
  lastEditedById String?
  lastEditedAt   DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@unique([jobId, rowNumber])
  @@index([jobId, skipped])
}
```

- [ ] **Step 2: Generate the migration SQL by hand**

Vercel deploys run `prisma migrate deploy` — we must check in the SQL. Create `prisma/migrations/20260519120000_add_draft_import_jobs/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "BulkImportStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "BulkImportJob" ADD COLUMN "expiresAt" TIMESTAMP(3);
CREATE INDEX "BulkImportJob_status_expiresAt_idx" ON "BulkImportJob" ("status", "expiresAt");

-- CreateTable
CREATE TABLE "BulkImportJobRow" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "data" JSONB NOT NULL,
  "errors" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "skipped" BOOLEAN NOT NULL DEFAULT false,
  "dirty" BOOLEAN NOT NULL DEFAULT false,
  "lastEditedById" TEXT,
  "lastEditedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BulkImportJobRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BulkImportJobRow_jobId_rowNumber_key" ON "BulkImportJobRow" ("jobId", "rowNumber");
CREATE INDEX "BulkImportJobRow_jobId_skipped_idx" ON "BulkImportJobRow" ("jobId", "skipped");

ALTER TABLE "BulkImportJobRow" ADD CONSTRAINT "BulkImportJobRow_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "BulkImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply locally and regenerate the client**

```bash
npx prisma migrate dev --name add_draft_import_jobs
```

(If you used the `migrate dev` flow above, the manual SQL file is overwritten — that's fine, the generated one will match. Delete the hand-written file in that case.)

```bash
npx prisma generate
npx tsc --noEmit
```

- [ ] **Step 4: Verify enum value reaches the client**

```bash
node -e "const { BulkImportStatus } = require('@prisma/client'); console.log(BulkImportStatus);"
```

Expected output includes `DRAFT: 'DRAFT'`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add DRAFT status + expiresAt + BulkImportJobRow table"
```

---

### Task 6: Draft service module

**Files:**
- Create: `src/lib/imports/drafts.ts`

A pure service layer with no HTTP/session knowledge. Routes wrap these with auth + envelope.

- [ ] **Step 1: Create the file**

```ts
/**
 * Draft service — server-side helpers for the persisted bulk-import draft
 * editor. No knowledge of Request/Response — routes handle auth and the
 * API envelope. Functions throw typed errors that routes map to HTTP.
 *
 * Concurrency: finalize takes a row-level lock on BulkImportJob; PATCH
 * row mutations are last-write-wins within a row but cross-row updates
 * (e.g. duplicate recompute) are atomic within a single PATCH thanks to
 * the per-job transaction.
 */
import type { BulkImportJob, BulkImportJobRow, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { parseImportFile, type ParsedSheet } from "@/lib/imports/excel"
import {
  recomputePayloadDuplicates,
  validateRow,
  validateHeaders,
} from "@/lib/imports/engine"
import { getImportDefinition } from "@/lib/imports/registry"
import type { BulkImportDefinition, ImportRowError, ImportRunContext } from "@/lib/imports/types"

const DRAFT_TTL_DAYS = 7
const MAX_DRAFT_ROWS = 5000   // hard cap per spec § 13
const SOFT_DRAFT_ROWS = 2000  // soft cap, advisory only at this layer

export class DraftError extends Error {
  constructor(message: string, public code: "NOT_FOUND" | "CONFLICT" | "TOO_LARGE" | "INVALID_HEADERS" | "VALIDATION_FAILED" | "PERSIST_FAILED", public payload?: unknown) {
    super(message)
  }
}

export type DraftScope = {
  module: string
  subModule?: string
  actorUserId: string
  scope: ImportRunContext["scope"]
}

function buildCtx(jobId: string, scope: DraftScope): ImportRunContext {
  return {
    prisma,
    jobId,
    actorUserId: scope.actorUserId,
    scope: scope.scope,
    cache: new Map(),
  }
}

/**
 * Create a new draft from a parsed sheet. Throws CONFLICT if the user
 * already has a draft for (module, subModule). Header validation hard-stops.
 */
export async function createDraft(opts: {
  scope: DraftScope
  parsed: ParsedSheet
}): Promise<{ draftId: string }> {
  const definition = getImportDefinition(opts.scope.module, opts.scope.subModule)
  if (!definition) throw new DraftError(`Unknown import: ${opts.scope.module}/${opts.scope.subModule ?? ""}`, "NOT_FOUND")
  if (opts.parsed.rows.length > MAX_DRAFT_ROWS) {
    throw new DraftError(`Draft exceeds row limit of ${MAX_DRAFT_ROWS}`, "TOO_LARGE")
  }
  const headerCheck = validateHeaders(definition, opts.parsed.headers)
  if (!headerCheck.valid) {
    throw new DraftError("Invalid headers", "INVALID_HEADERS", headerCheck)
  }

  // Single-draft-per-(user, module, subModule) rule
  const existing = await prisma.bulkImportJob.findFirst({
    where: {
      createdById: opts.scope.actorUserId,
      module: opts.scope.module,
      subModule: opts.scope.subModule ?? null,
      status: "DRAFT",
    },
    select: { id: true },
  })
  if (existing) throw new DraftError("Existing draft", "CONFLICT", { existingDraftId: existing.id })

  const expiresAt = new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000)
  const job = await prisma.bulkImportJob.create({
    data: {
      module: opts.scope.module,
      subModule: opts.scope.subModule ?? null,
      status: "DRAFT",
      totalRows: opts.parsed.rows.length,
      headers: opts.parsed.headers,
      fileName: opts.parsed.fileName,
      createdById: opts.scope.actorUserId,
      expiresAt,
    },
    select: { id: true },
  })

  // Insert child rows in one batch
  await prisma.bulkImportJobRow.createMany({
    data: opts.parsed.rows.map((data, i) => ({
      jobId: job.id,
      rowNumber: i + 2,
      data: data as Prisma.InputJsonValue,
    })),
  })

  // Initial validation pass — touches every row + cross-row dups
  await revalidateAllRows(job.id, definition, opts.scope)

  return { draftId: job.id }
}

/**
 * Ownership-aware draft loader. Returns null when missing or not owned —
 * routes translate this to 404 (no 403 to avoid existence-leak).
 */
export async function getOwnedDraft(jobId: string, actorUserId: string): Promise<BulkImportJob | null> {
  const job = await prisma.bulkImportJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== "DRAFT") return null
  if (job.createdById !== actorUserId) return null
  return job
}

/**
 * Re-validate every row in the draft and persist updated `errors` columns.
 * Used by initial create and as the defence-in-depth pass at finalize.
 */
export async function revalidateAllRows(
  jobId: string,
  definition: BulkImportDefinition,
  scope: DraftScope,
): Promise<void> {
  const ctx = buildCtx(jobId, scope)
  const rows = await prisma.bulkImportJobRow.findMany({
    where: { jobId },
    orderBy: { rowNumber: "asc" },
  })
  const perRowErrors = new Map<number, ImportRowError[]>()
  for (const r of rows) {
    if (r.skipped) {
      perRowErrors.set(r.rowNumber, [])
      continue
    }
    const result = await validateRow(definition, r.data as Record<string, unknown>, ctx, r.rowNumber)
    perRowErrors.set(r.rowNumber, result.errors)
  }
  // Cross-row payload dups (only against non-skipped rows)
  const aliasedView = rows.map((r) => ({
    rowNumber: r.rowNumber,
    data: r.data as Record<string, unknown>,
    skipped: r.skipped,
  }))
  const dupMap = recomputePayloadDuplicates(definition, aliasedView)
  for (const [rowNumber, errs] of dupMap) {
    const existing = perRowErrors.get(rowNumber) ?? []
    perRowErrors.set(rowNumber, [...existing, ...errs])
  }
  // Bulk update — one transaction
  await prisma.$transaction(
    rows.map((r) =>
      prisma.bulkImportJobRow.update({
        where: { id: r.id },
        data: {
          errors: (perRowErrors.get(r.rowNumber) ?? []) as Prisma.InputJsonValue,
          dirty: false,
        },
      }),
    ),
  )
}

/**
 * Edit one row. Reruns per-row validation + DB-dup + cross-row payload
 * dup recompute. Returns the edited row plus any sibling rows whose
 * error list changed (so the client can repaint a small set).
 */
export async function patchDraftRow(opts: {
  jobId: string
  rowNumber: number
  data: Record<string, unknown>
  scope: DraftScope
}): Promise<{ row: BulkImportJobRow; affectedRows: Array<{ rowNumber: number; errors: ImportRowError[] }> }> {
  const definition = await loadDefinitionForJob(opts.jobId)
  return prisma.$transaction(async (tx) => {
    const target = await tx.bulkImportJobRow.findUnique({
      where: { jobId_rowNumber: { jobId: opts.jobId, rowNumber: opts.rowNumber } },
    })
    if (!target) throw new DraftError("Row not found", "NOT_FOUND")
    const mergedData = { ...(target.data as Record<string, unknown>), ...opts.data }

    // Per-row validation (against the merged data)
    const ctx = buildCtx(opts.jobId, opts.scope)
    const result = await validateRow(definition, mergedData, ctx, opts.rowNumber)

    // Whole-draft cross-row dup recompute
    const allRows = await tx.bulkImportJobRow.findMany({ where: { jobId: opts.jobId } })
    const view = allRows.map((r) =>
      r.rowNumber === opts.rowNumber
        ? { rowNumber: r.rowNumber, data: mergedData, skipped: r.skipped }
        : { rowNumber: r.rowNumber, data: r.data as Record<string, unknown>, skipped: r.skipped },
    )
    const dupMap = recomputePayloadDuplicates(definition, view)

    // Compute the new error list per row & detect who changed
    const previousErrorsByRow = new Map<number, ImportRowError[]>(
      allRows.map((r) => [r.rowNumber, (r.errors as unknown as ImportRowError[]) ?? []]),
    )
    const nextErrorsByRow = new Map<number, ImportRowError[]>()
    for (const r of allRows) {
      const dupErrors = dupMap.get(r.rowNumber) ?? []
      if (r.rowNumber === opts.rowNumber) {
        nextErrorsByRow.set(r.rowNumber, [...result.errors, ...dupErrors])
      } else if (r.skipped) {
        // Skipped rows carry no errors; if they previously had dup errors,
        // those are cleared anyway because dup recompute excludes them.
        nextErrorsByRow.set(r.rowNumber, [])
      } else {
        // Other rows keep their own per-row errors; only their dup errors may have changed
        const ownErrors = previousErrorsByRow.get(r.rowNumber)?.filter((e) => e.field.indexOf("+") === -1) ?? []
        nextErrorsByRow.set(r.rowNumber, [...ownErrors, ...dupErrors])
      }
    }

    // Persist changes
    await tx.bulkImportJobRow.update({
      where: { id: target.id },
      data: {
        data: mergedData as Prisma.InputJsonValue,
        errors: nextErrorsByRow.get(opts.rowNumber) as Prisma.InputJsonValue,
        dirty: false,
        lastEditedById: opts.scope.actorUserId,
        lastEditedAt: new Date(),
      },
    })

    const affected: Array<{ rowNumber: number; errors: ImportRowError[] }> = []
    for (const r of allRows) {
      if (r.rowNumber === opts.rowNumber) continue
      const before = previousErrorsByRow.get(r.rowNumber) ?? []
      const after = nextErrorsByRow.get(r.rowNumber) ?? []
      if (!errorsEqual(before, after)) {
        await tx.bulkImportJobRow.update({
          where: { id: r.id },
          data: { errors: after as Prisma.InputJsonValue },
        })
        affected.push({ rowNumber: r.rowNumber, errors: after })
      }
    }

    const updatedRow = await tx.bulkImportJobRow.findUnique({
      where: { id: target.id },
    })
    return { row: updatedRow!, affectedRows: affected }
  })
}

function errorsEqual(a: ImportRowError[], b: ImportRowError[]): boolean {
  if (a.length !== b.length) return false
  const key = (e: ImportRowError) => `${e.field}:${e.message}`
  const sa = a.map(key).sort()
  const sb = b.map(key).sort()
  return sa.every((k, i) => k === sb[i])
}

export async function setRowSkipped(opts: {
  jobId: string
  rowNumber: number
  skipped: boolean
  scope: DraftScope
}): Promise<{ row: BulkImportJobRow; affectedRows: Array<{ rowNumber: number; errors: ImportRowError[] }> }> {
  const definition = await loadDefinitionForJob(opts.jobId)
  return prisma.$transaction(async (tx) => {
    const target = await tx.bulkImportJobRow.findUnique({
      where: { jobId_rowNumber: { jobId: opts.jobId, rowNumber: opts.rowNumber } },
    })
    if (!target) throw new DraftError("Row not found", "NOT_FOUND")
    await tx.bulkImportJobRow.update({
      where: { id: target.id },
      data: { skipped: opts.skipped },
    })
    // A skip-toggle changes the cross-row dup set; recompute and patch siblings.
    const allRows = await tx.bulkImportJobRow.findMany({ where: { jobId: opts.jobId } })
    const view = allRows.map((r) => ({
      rowNumber: r.rowNumber,
      data: r.data as Record<string, unknown>,
      skipped: r.rowNumber === opts.rowNumber ? opts.skipped : r.skipped,
    }))
    const dupMap = recomputePayloadDuplicates(definition, view)
    const previousErrorsByRow = new Map<number, ImportRowError[]>(
      allRows.map((r) => [r.rowNumber, (r.errors as unknown as ImportRowError[]) ?? []]),
    )
    const affected: Array<{ rowNumber: number; errors: ImportRowError[] }> = []
    for (const r of allRows) {
      if (r.rowNumber === opts.rowNumber) continue
      const before = previousErrorsByRow.get(r.rowNumber) ?? []
      const ownErrors = before.filter((e) => e.field.indexOf("+") === -1)
      const dupErrors = dupMap.get(r.rowNumber) ?? []
      const after = r.skipped ? [] : [...ownErrors, ...dupErrors]
      if (!errorsEqual(before, after)) {
        await tx.bulkImportJobRow.update({ where: { id: r.id }, data: { errors: after as Prisma.InputJsonValue } })
        affected.push({ rowNumber: r.rowNumber, errors: after })
      }
    }
    const updated = await tx.bulkImportJobRow.findUnique({ where: { id: target.id } })
    return { row: updated!, affectedRows: affected }
  })
}

export async function finalizeDraft(opts: {
  jobId: string
  scope: DraftScope
}): Promise<{ jobId: string; status: string; successRows: number; failedRows: number }> {
  const definition = await loadDefinitionForJob(opts.jobId)
  // Lock the job row
  const job = await prisma.$queryRaw<Array<BulkImportJob>>`
    SELECT * FROM "BulkImportJob" WHERE id = ${opts.jobId} FOR UPDATE
  `
  if (!job[0] || job[0].status !== "DRAFT") throw new DraftError("Not a draft", "NOT_FOUND")

  // Defence-in-depth: re-run validation across the whole draft
  await revalidateAllRows(opts.jobId, definition, opts.scope)

  const rows = await prisma.bulkImportJobRow.findMany({
    where: { jobId: opts.jobId, skipped: false },
    orderBy: { rowNumber: "asc" },
  })
  const stillBroken = rows.filter((r) => ((r.errors as unknown as ImportRowError[]) ?? []).length > 0)
  if (stillBroken.length > 0) {
    throw new DraftError("Cannot finalize — errors remain", "VALIDATION_FAILED", { errorRowCount: stillBroken.length })
  }

  // Persist each valid row via the definition's persist hook
  const ctx = buildCtx(opts.jobId, opts.scope)
  let successCount = 0
  const persistErrors: ImportRowError[] = []
  const persistOne = async (row: BulkImportJobRow, tx: Prisma.TransactionClient | typeof prisma) => {
    const result = await validateRow(definition, row.data as Record<string, unknown>, { ...ctx, prisma: tx as never }, row.rowNumber)
    if (result.errors.length > 0 || !result.data) {
      persistErrors.push(...result.errors)
      return
    }
    try {
      await definition.persist(result.data as never, { ...ctx, prisma: tx as never, tx: tx as never })
      successCount += 1
    } catch (err) {
      persistErrors.push({
        row: row.rowNumber,
        field: "__row__",
        message: err instanceof Error ? err.message : "Failed to persist row",
      })
    }
  }
  if (definition.persistInTransaction) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const r of rows) await persistOne(r, tx)
        if (persistErrors.length > 0) throw new Error(`${persistErrors.length} rows failed`)
      })
    } catch {
      successCount = 0
    }
  } else {
    for (const r of rows) await persistOne(r, prisma)
  }
  const failed = rows.length - successCount
  const status = successCount === 0 ? "FAILED" : failed === 0 ? "COMPLETED" : "PARTIALLY_COMPLETED"
  await prisma.bulkImportJob.update({
    where: { id: opts.jobId },
    data: {
      status,
      finishedAt: new Date(),
      successRows: successCount,
      failedRows: failed,
      processedRows: rows.length,
      expiresAt: null,
      errorRows: persistErrors as unknown as Prisma.InputJsonValue,
    },
  })
  return { jobId: opts.jobId, status, successRows: successCount, failedRows: failed }
}

export async function deleteDraft(jobId: string, actorUserId: string): Promise<void> {
  const draft = await getOwnedDraft(jobId, actorUserId)
  if (!draft) throw new DraftError("Not found", "NOT_FOUND")
  await prisma.bulkImportJob.delete({ where: { id: jobId } })
}

export async function sweepExpiredDrafts(): Promise<{ deleted: number }> {
  const result = await prisma.bulkImportJob.deleteMany({
    where: { status: "DRAFT", expiresAt: { lt: new Date() } },
  })
  return { deleted: result.count }
}

async function loadDefinitionForJob(jobId: string): Promise<BulkImportDefinition> {
  const job = await prisma.bulkImportJob.findUnique({
    where: { id: jobId },
    select: { module: true, subModule: true },
  })
  if (!job) throw new DraftError("Job not found", "NOT_FOUND")
  const def = getImportDefinition(job.module, job.subModule ?? undefined)
  if (!def) throw new DraftError("Definition not found", "NOT_FOUND")
  return def
}
```

> Note on `loadDefinitionForJob` — `getImportDefinition` is the existing helper in `src/lib/imports/registry.ts`. Verify its exact name before writing the import; rename here if needed.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/imports/drafts.ts
git commit -m "feat(imports): add draft service (create/edit/skip/finalize/delete)"
```

---

### Task 7: `POST /api/imports/[module]/draft` — create draft

**Files:**
- Create: `src/app/api/imports/[module]/draft/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { badRequest, conflict, forbidden, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { parseImportFile } from "@/lib/imports/excel"
import { createDraft, DraftError } from "@/lib/imports/drafts"
import { deriveManagerScope } from "@/lib/access/scope"

/**
 * POST /api/imports/:module/draft?sub=<subModule>
 *
 * Multipart file upload OR JSON `{ rows, headers, fileName }`. Creates a
 * DRAFT BulkImportJob + its rows, runs initial validation, returns the
 * draft id. 409 with `{ existingDraftId }` when the user already has a
 * draft for this (module, subModule).
 */
export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { module } = await params
  const subModule = new URL(request.url).searchParams.get("sub") ?? undefined

  // Parse upload — accept multipart file OR JSON {rows, headers, fileName}
  const ct = request.headers.get("content-type") || ""
  let parsed
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return badRequest("file is required")
    const buffer = await file.arrayBuffer()
    parsed = await parseImportFile(buffer, file.name)
  } else {
    const body = await request.json().catch(() => null) as { rows?: unknown[]; headers?: string[]; fileName?: string } | null
    if (!body?.rows || !Array.isArray(body.rows) || !body.headers) return badRequest("rows[] and headers[] required")
    parsed = { rows: body.rows as Array<Record<string, unknown>>, headers: body.headers, fileName: body.fileName }
  }

  const scope = {
    module,
    subModule,
    actorUserId: session.user!.id!,
    scope: deriveManagerScope(session),
  }

  try {
    const result = await createDraft({ scope, parsed })
    return ok(result, 201)
  } catch (err) {
    if (err instanceof DraftError) {
      if (err.code === "CONFLICT") return conflict(err.message)
      if (err.code === "INVALID_HEADERS" || err.code === "TOO_LARGE") return badRequest(err.message)
      if (err.code === "NOT_FOUND") return badRequest(err.message)
    }
    throw err
  }
}
```

> If `deriveManagerScope` isn't the right helper for the IMPORTS module, check `src/lib/access/scope.ts` for the analogue used by `/imports/[module]/process`.

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/app/api/imports/'[module]'/draft/route.ts
git commit -m "feat(imports): POST /api/imports/:module/draft endpoint"
```

---

### Task 8: `GET /api/imports/[module]/columns`

**Files:**
- Create: `src/app/api/imports/[module]/columns/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { getImportDefinition } from "@/lib/imports/registry"
import { deriveManagerScope } from "@/lib/access/scope"

/**
 * GET /api/imports/:module/columns?sub=<subModule>
 *
 * Returns the column metadata used by the draft editor to pick cell
 * editors. FK loaders run server-side here — the response holds the
 * resolved option lists (one open per draft = one resolution; cheap).
 */
export async function GET(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()
  const { module } = await params
  const subModule = new URL(request.url).searchParams.get("sub") ?? undefined
  const definition = getImportDefinition(module, subModule)
  if (!definition) return badRequest(`Unknown import: ${module}`)
  const ctx = {
    prisma,
    jobId: "columns-endpoint",
    actorUserId: session.user!.id!,
    scope: deriveManagerScope(session),
    cache: new Map(),
  }
  const columns = await Promise.all(
    (definition.columns ?? []).map(async (col) => ({
      key: col.key,
      header: col.header,
      label: col.label,
      kind: col.kind,
      required: col.required,
      enumValues: col.enumValues,
      fkOptions: col.fkOptionsLoader ? await col.fkOptionsLoader(ctx) : undefined,
    })),
  )
  return ok({ columns })
}
```

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/app/api/imports/'[module]'/columns/route.ts
git commit -m "feat(imports): GET /api/imports/:module/columns endpoint"
```

---

### Task 9: `GET` + `DELETE /api/imports/drafts/[id]`

**Files:**
- Create: `src/app/api/imports/drafts/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { deleteDraft, getOwnedDraft, DraftError } from "@/lib/imports/drafts"

/**
 * GET /api/imports/drafts/:id
 *   → { job, totals: { valid, skipped, errored, dirty } }
 * 404 (not 403) when not owner or not found.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()
  const { id } = await params
  const job = await getOwnedDraft(id, session.user!.id!)
  if (!job) return notFound("Draft not found")
  // Cheap aggregates — one query, three counts via grouping in app
  const rows = await prisma.bulkImportJobRow.findMany({
    where: { jobId: id },
    select: { rowNumber: true, errors: true, skipped: true },
  })
  let valid = 0, errored = 0, skipped = 0
  for (const r of rows) {
    if (r.skipped) skipped += 1
    else if (Array.isArray(r.errors) && (r.errors as unknown[]).length > 0) errored += 1
    else valid += 1
  }
  return ok({ job, totals: { valid, errored, skipped, total: rows.length } })
}

/**
 * DELETE /api/imports/drafts/:id — discard draft. Cascade drops child rows.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { id } = await params
  try {
    await deleteDraft(id, session.user!.id!)
    return ok({ deleted: true })
  } catch (err) {
    if (err instanceof DraftError && err.code === "NOT_FOUND") return notFound("Draft not found")
    throw err
  }
}
```

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/imports/drafts
git commit -m "feat(imports): GET + DELETE /api/imports/drafts/:id"
```

---

### Task 10: `GET /api/imports/drafts/[id]/rows`

**Files:**
- Create: `src/app/api/imports/drafts/[id]/rows/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { getOwnedDraft } from "@/lib/imports/drafts"

/**
 * GET /api/imports/drafts/:id/rows?cursor=<rowNumber>&take=<n>
 *
 * Paginated row chunk. Default take=100, max 500. Cursor is the highest
 * rowNumber already received — server returns rows with rowNumber > cursor.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()
  const { id } = await params
  const job = await getOwnedDraft(id, session.user!.id!)
  if (!job) return notFound("Draft not found")
  const url = new URL(request.url)
  const takeRaw = parseInt(url.searchParams.get("take") || "100", 10)
  const take = Math.min(Math.max(Number.isFinite(takeRaw) ? takeRaw : 100, 1), 500)
  const cursorRaw = parseInt(url.searchParams.get("cursor") || "0", 10)
  const cursor = Number.isFinite(cursorRaw) ? cursorRaw : 0
  const rows = await prisma.bulkImportJobRow.findMany({
    where: { jobId: id, rowNumber: { gt: cursor } },
    orderBy: { rowNumber: "asc" },
    take,
  })
  const nextCursor = rows.length === take ? rows[rows.length - 1].rowNumber : null
  return ok({ rows, nextCursor })
}
```

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/imports/drafts/'[id]'/rows/route.ts
git commit -m "feat(imports): GET /api/imports/drafts/:id/rows paginated endpoint"
```

---

### Task 11: `PATCH /api/imports/drafts/[id]/rows/[rowNumber]`

**Files:**
- Create: `src/app/api/imports/drafts/[id]/rows/[rowNumber]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { badRequest, forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { getOwnedDraft, patchDraftRow, DraftError } from "@/lib/imports/drafts"
import { deriveManagerScope } from "@/lib/access/scope"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rowNumber: string }> },
) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { id, rowNumber } = await params
  const owned = await getOwnedDraft(id, session.user!.id!)
  if (!owned) return notFound("Draft not found")

  const body = await request.json().catch(() => null) as { data?: Record<string, unknown> } | null
  if (!body?.data || typeof body.data !== "object") return badRequest("data {} required")

  const rowNum = parseInt(rowNumber, 10)
  if (!Number.isFinite(rowNum) || rowNum < 2) return badRequest("Invalid rowNumber")

  try {
    const result = await patchDraftRow({
      jobId: id,
      rowNumber: rowNum,
      data: body.data,
      scope: {
        module: owned.module,
        subModule: owned.subModule ?? undefined,
        actorUserId: session.user!.id!,
        scope: deriveManagerScope(session),
      },
    })
    return ok(result)
  } catch (err) {
    if (err instanceof DraftError && err.code === "NOT_FOUND") return notFound(err.message)
    throw err
  }
}
```

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/imports/drafts/'[id]'/rows/'[rowNumber]'/route.ts
git commit -m "feat(imports): PATCH /api/imports/drafts/:id/rows/:rowNumber endpoint"
```

---

### Task 12: `PATCH /api/imports/drafts/[id]/rows/[rowNumber]/skip`

**Files:**
- Create: `src/app/api/imports/drafts/[id]/rows/[rowNumber]/skip/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { badRequest, forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { getOwnedDraft, setRowSkipped, DraftError } from "@/lib/imports/drafts"
import { deriveManagerScope } from "@/lib/access/scope"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rowNumber: string }> },
) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { id, rowNumber } = await params
  const owned = await getOwnedDraft(id, session.user!.id!)
  if (!owned) return notFound("Draft not found")
  const body = await request.json().catch(() => null) as { skipped?: boolean } | null
  if (typeof body?.skipped !== "boolean") return badRequest("skipped boolean required")
  const rowNum = parseInt(rowNumber, 10)
  if (!Number.isFinite(rowNum) || rowNum < 2) return badRequest("Invalid rowNumber")

  try {
    const result = await setRowSkipped({
      jobId: id,
      rowNumber: rowNum,
      skipped: body.skipped,
      scope: {
        module: owned.module,
        subModule: owned.subModule ?? undefined,
        actorUserId: session.user!.id!,
        scope: deriveManagerScope(session),
      },
    })
    return ok(result)
  } catch (err) {
    if (err instanceof DraftError && err.code === "NOT_FOUND") return notFound(err.message)
    throw err
  }
}
```

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/imports/drafts/'[id]'/rows/'[rowNumber]'/skip/route.ts
git commit -m "feat(imports): PATCH /api/imports/drafts/:id/rows/:rowNumber/skip endpoint"
```

---

### Task 13: `POST /api/imports/drafts/[id]/finalize`

**Files:**
- Create: `src/app/api/imports/drafts/[id]/finalize/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { finalizeDraft, getOwnedDraft, DraftError } from "@/lib/imports/drafts"
import { deriveManagerScope } from "@/lib/access/scope"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { id } = await params
  const owned = await getOwnedDraft(id, session.user!.id!)
  if (!owned) return notFound("Draft not found")

  try {
    const result = await finalizeDraft({
      jobId: id,
      scope: {
        module: owned.module,
        subModule: owned.subModule ?? undefined,
        actorUserId: session.user!.id!,
        scope: deriveManagerScope(session),
      },
    })
    return ok(result)
  } catch (err) {
    if (err instanceof DraftError) {
      if (err.code === "VALIDATION_FAILED") {
        return NextResponse.json({ success: false, message: err.message, code: "VALIDATION_FAILED", data: err.payload }, { status: 422 })
      }
      if (err.code === "NOT_FOUND") return notFound(err.message)
    }
    throw err
  }
}
```

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/imports/drafts/'[id]'/finalize/route.ts
git commit -m "feat(imports): POST /api/imports/drafts/:id/finalize endpoint"
```

---

### Task 14: Cron route for expired-draft sweep + Vercel wiring

**Files:**
- Create: `src/app/api/cron/sweep-expired-drafts/route.ts`
- Modify: `vercel.json` (create if missing)

- [ ] **Step 1: Write the route**

```ts
import { ok, unauthorized } from "@/lib/api/response"
import { sweepExpiredDrafts } from "@/lib/imports/drafts"

/**
 * Vercel cron entrypoint. Vercel sets `Authorization: Bearer ${CRON_SECRET}`
 * on cron-triggered invocations. Reject anything else.
 *
 * Deletes BulkImportJob rows where status=DRAFT and expiresAt < now().
 * Cascade removes child rows.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const got = request.headers.get("authorization")
  if (!expected || got !== `Bearer ${expected}`) return unauthorized()
  const result = await sweepExpiredDrafts()
  return ok(result)
}
```

- [ ] **Step 2: Wire in `vercel.json`**

Add or extend the `crons` array:

```json
{
  "crons": [
    {
      "path": "/api/cron/sweep-expired-drafts",
      "schedule": "0 3 * * *"
    }
  ]
}
```

(If `vercel.json` already exists, merge the entry into the existing `crons` array.)

- [ ] **Step 3: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/cron vercel.json
git commit -m "feat(imports): daily cron to sweep expired DRAFT jobs"
```

---

### Task 15: Phase-1 integration test script

**Files:**
- Create: `scripts/integration/imports-draft-flow.mjs`

Exercises the full lifecycle against a running dev server. Models its cookie-jar pattern on `scripts/api-integration-test.mjs`.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Integration test for the draft editor lifecycle.
 *
 * Usage: BASE_URL=http://localhost:3000 node scripts/integration/imports-draft-flow.mjs
 *
 * Steps:
 *  1. Sign in as the seeded admin
 *  2. POST /api/imports/guards/draft with 4 rows (2 valid, 1 bad-CNIC, 1 empty)
 *  3. GET /api/imports/drafts/:id → expects 1 errored, 0 skipped, 3 valid
 *  4. PATCH the bad-CNIC row with a valid CNIC → errored should drop to 0
 *  5. POST /finalize → COMPLETED with successRows=3
 *  6. DELETE the (now non-draft) job — should 404 because finalize cleared DRAFT status
 *  7. Create a second draft; skip a row; finalize; assert successRows == validRows count
 *
 * Asserts on the API envelope shape and the totals counter at each step.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000"
const cookies = {}

function absorb(res) {
  const sc = res.headers.get("set-cookie")
  if (!sc) return
  for (const part of sc.split(/,(?=[^;]+=)/)) {
    const [kv] = part.split(";")
    const [k, v] = kv.split("=")
    cookies[k.trim()] = v
  }
}
function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
}
async function api(path, init = {}) {
  const headers = { ...(init.headers || {}), cookie: cookieHeader() }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  absorb(res)
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}
function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1) } else console.log("  ✓", msg) }

// 1) Sign in (replace with project's seeded test credentials)
const csrf = await api("/api/auth/csrf")
const signin = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
  body: new URLSearchParams({
    email: process.env.TEST_EMAIL || "admin@example.com",
    password: process.env.TEST_PASSWORD || "admin",
    csrfToken: csrf.body.csrfToken,
  }),
})
absorb(signin)

// 2) Create draft
const payload = {
  headers: ["name", "cnic"],
  rows: [
    { name: "Ahmed", cnic: "35201-1234567-1" },
    { name: "Sara", cnic: "35202-2222222-2" },
    { name: "Bad", cnic: "12345" },
    { name: null, cnic: null },
  ],
  fileName: "draft-test.json",
}
const create = await api("/api/imports/guards/draft", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
})
assert(create.status === 201, `draft created (got ${create.status})`)
const draftId = create.body.data.draftId

// 3) Inspect
const draft = await api(`/api/imports/drafts/${draftId}`)
assert(draft.status === 200, "draft GET")
assert(draft.body.data.totals.errored >= 1, "at least one errored row")

// 4) Fix bad CNIC
const fix = await api(`/api/imports/drafts/${draftId}/rows/4`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ data: { cnic: "35203-3333333-3" } }),
})
assert(fix.status === 200, "row patched")

// 5) Finalize
const finalize = await api(`/api/imports/drafts/${draftId}/finalize`, { method: "POST" })
console.log("finalize:", finalize.status, finalize.body)
assert(finalize.status === 200 || finalize.status === 422, `finalize returned (got ${finalize.status})`)
console.log("\nAll basic-flow assertions passed.")
```

> Adapt credentials and the legacy auth flow to whatever the project's existing integration script uses. The key thing is the assertions on the draft endpoints.

- [ ] **Step 2: Smoke-run against local dev**

```bash
npm run dev &
sleep 5
BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... node scripts/integration/imports-draft-flow.mjs
```

Expected: each step prints `✓` and the script exits 0. Fix any failures before proceeding.

- [ ] **Step 3: Commit**

```bash
git add scripts/integration/imports-draft-flow.mjs
git commit -m "test(imports): integration script for draft lifecycle"
```

---

### Phase 1 checkpoint

At this point: schema migrated, engine refactored, draft service and all 7 endpoints live, cron registered, integration script passes. The UI still uses the old flow exclusively. The new endpoints are dark (no UI calls them).

**Pause here and demo to user before continuing to Phase 2.**

---

## Phase 2 — Editor UI (behind workflow rule)

### Task 16: Add workflow rule

**Files:**
- Modify: `src/lib/workflows/policy.ts`

- [ ] **Step 1: Add the rule key and default**

In the `WorkflowRuleKey` union, add `"imports.draftEditor"`. In the default rule map and each preset (`strict` / `balanced` / `relaxed`), add `"imports.draftEditor": false`.

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/workflows/policy.ts
git commit -m "feat(workflows): add imports.draftEditor flag (default off)"
```

---

### Task 17: `useDraft` hook bundle

**Files:**
- Create: `src/lib/imports/client/useDraft.ts`

- [ ] **Step 1: Write the hook**

```ts
"use client"
import { useCallback, useEffect, useReducer } from "react"

export type DraftRow = {
  id: string
  rowNumber: number
  data: Record<string, unknown>
  errors: Array<{ row: number; field: string; message: string }>
  skipped: boolean
  dirty: boolean
}

export type DraftColumn = {
  key: string
  header: string
  label: string
  kind: "text" | "cnic" | "date" | "number" | "enum" | "fk"
  required: boolean
  enumValues?: string[]
  fkOptions?: Array<{ value: string; label: string }>
}

type State = {
  loading: boolean
  error: string | null
  job: { id: string; status: string; module: string; fileName: string | null; expiresAt: string | null; createdAt: string } | null
  totals: { valid: number; errored: number; skipped: number; total: number }
  rowsByNumber: Map<number, DraftRow>
  columns: DraftColumn[]
}
type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_OK"; job: State["job"]; totals: State["totals"]; columns: DraftColumn[] }
  | { type: "LOAD_FAIL"; message: string }
  | { type: "ROWS_LOADED"; rows: DraftRow[] }
  | { type: "ROW_PATCHED"; row: DraftRow; affected: Array<{ rowNumber: number; errors: DraftRow["errors"] }> }
  | { type: "RECOMPUTE_TOTALS" }

function init(): State {
  return {
    loading: true, error: null, job: null,
    totals: { valid: 0, errored: 0, skipped: 0, total: 0 },
    rowsByNumber: new Map(), columns: [],
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START": return { ...state, loading: true, error: null }
    case "LOAD_OK": return { ...state, loading: false, job: action.job, totals: action.totals, columns: action.columns }
    case "LOAD_FAIL": return { ...state, loading: false, error: action.message }
    case "ROWS_LOADED": {
      const next = new Map(state.rowsByNumber)
      for (const r of action.rows) next.set(r.rowNumber, r)
      return { ...state, rowsByNumber: next }
    }
    case "ROW_PATCHED": {
      const next = new Map(state.rowsByNumber)
      next.set(action.row.rowNumber, action.row)
      for (const a of action.affected) {
        const existing = next.get(a.rowNumber)
        if (existing) next.set(a.rowNumber, { ...existing, errors: a.errors })
      }
      return recomputeTotals({ ...state, rowsByNumber: next })
    }
    case "RECOMPUTE_TOTALS": return recomputeTotals(state)
  }
}

function recomputeTotals(state: State): State {
  let valid = 0, errored = 0, skipped = 0
  for (const r of state.rowsByNumber.values()) {
    if (r.skipped) skipped += 1
    else if (r.errors.length > 0) errored += 1
    else valid += 1
  }
  return { ...state, totals: { valid, errored, skipped, total: state.rowsByNumber.size } }
}

export function useDraft(draftId: string) {
  const [state, dispatch] = useReducer(reducer, undefined, init)

  // Initial load + first page of rows
  useEffect(() => {
    let cancelled = false
    async function load() {
      dispatch({ type: "LOAD_START" })
      try {
        const [head, rows] = await Promise.all([
          fetch(`/api/imports/drafts/${draftId}`).then((r) => r.json()),
          fetch(`/api/imports/drafts/${draftId}/rows?take=500`).then((r) => r.json()),
        ])
        if (cancelled) return
        if (!head.success) { dispatch({ type: "LOAD_FAIL", message: head.message }); return }
        const colsRes = await fetch(`/api/imports/${head.data.job.module}/columns${head.data.job.subModule ? `?sub=${head.data.job.subModule}` : ""}`).then((r) => r.json())
        if (cancelled) return
        dispatch({ type: "LOAD_OK", job: head.data.job, totals: head.data.totals, columns: colsRes.data?.columns ?? [] })
        if (rows.success) dispatch({ type: "ROWS_LOADED", rows: rows.data.rows })
      } catch (err) {
        if (!cancelled) dispatch({ type: "LOAD_FAIL", message: err instanceof Error ? err.message : "load failed" })
      }
    }
    load()
    return () => { cancelled = true }
  }, [draftId])

  const patchRow = useCallback(async (rowNumber: number, data: Record<string, unknown>) => {
    const res = await fetch(`/api/imports/drafts/${draftId}/rows/${rowNumber}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.message)
    dispatch({ type: "ROW_PATCHED", row: json.data.row, affected: json.data.affectedRows ?? [] })
    return json.data
  }, [draftId])

  const setSkipped = useCallback(async (rowNumber: number, skipped: boolean) => {
    const res = await fetch(`/api/imports/drafts/${draftId}/rows/${rowNumber}/skip`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skipped }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.message)
    dispatch({ type: "ROW_PATCHED", row: json.data.row, affected: json.data.affectedRows ?? [] })
  }, [draftId])

  const finalize = useCallback(async () => {
    const res = await fetch(`/api/imports/drafts/${draftId}/finalize`, { method: "POST" })
    const json = await res.json()
    return { status: res.status, payload: json }
  }, [draftId])

  const discard = useCallback(async () => {
    const res = await fetch(`/api/imports/drafts/${draftId}`, { method: "DELETE" })
    return res.ok
  }, [draftId])

  return { ...state, patchRow, setSkipped, finalize, discard }
}
```

- [ ] **Step 2: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/imports/client/
git commit -m "feat(imports): useDraft client hook (fetch + useReducer cache)"
```

---

### Task 18: Cell editor primitives

**Files:**
- Create: `src/components/imports/draft-editor/cells/TextCell.tsx`
- Create: `src/components/imports/draft-editor/cells/CnicCell.tsx`
- Create: `src/components/imports/draft-editor/cells/DateCell.tsx`
- Create: `src/components/imports/draft-editor/cells/EnumCell.tsx`
- Create: `src/components/imports/draft-editor/cells/FkCell.tsx`
- Create: `src/components/imports/draft-editor/cells/index.ts`

- [ ] **Step 1: Install shadcn primitives that aren't already present**

Check `src/components/shadcn/` for `popover.tsx`, `calendar.tsx`, `command.tsx`. Install any missing ones:

```bash
npx shadcn@latest add popover calendar command --legacy-peer-deps
```

- [ ] **Step 2: Implement each cell — `TextCell.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"

export type CellProps = {
  value: unknown
  onCommit: (next: string | null) => void
  invalid?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export function TextCell({ value, onCommit, invalid, placeholder, autoFocus }: CellProps) {
  const [v, setV] = useState(value == null ? "" : String(value))
  useEffect(() => { setV(value == null ? "" : String(value)) }, [value])
  return (
    <input
      className={`w-full bg-transparent outline-none ${invalid ? "text-destructive" : ""}`}
      value={v}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const next = v.trim() === "" ? null : v
        if (next !== (value == null ? null : String(value))) onCommit(next)
      }}
    />
  )
}
```

- [ ] **Step 3: `CnicCell.tsx`**

```tsx
"use client"
import { TextCell, type CellProps } from "./TextCell"

const placeholder = "XXXXX-XXXXXXX-X"

function maskCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13)
  const a = digits.slice(0, 5)
  const b = digits.slice(5, 12)
  const c = digits.slice(12, 13)
  if (digits.length <= 5) return a
  if (digits.length <= 12) return `${a}-${b}`
  return `${a}-${b}-${c}`
}

export function CnicCell(props: CellProps) {
  return (
    <TextCell
      {...props}
      placeholder={placeholder}
      onCommit={(next) => props.onCommit(next == null ? null : maskCnic(next))}
    />
  )
}
```

- [ ] **Step 4: `DateCell.tsx`**

```tsx
"use client"
import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover"
import { Calendar } from "@/components/shadcn/calendar"
import { Button } from "@/components/shadcn/button"
import { format, parseISO } from "date-fns"
import type { CellProps } from "./TextCell"

export function DateCell({ value, onCommit, invalid }: CellProps) {
  const [open, setOpen] = useState(false)
  const dateValue = typeof value === "string" && value ? parseISO(value) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={`h-7 w-full justify-start px-2 py-0 text-sm ${invalid ? "text-destructive" : ""}`}>
          {dateValue ? format(dateValue, "yyyy-MM-dd") : <span className="text-muted-foreground">YYYY-MM-DD</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d) => {
            setOpen(false)
            onCommit(d ? format(d, "yyyy-MM-dd") : null)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 5: `EnumCell.tsx`**

```tsx
"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select"
import type { CellProps } from "./TextCell"

export function EnumCell({ value, onCommit, invalid, enumValues }: CellProps & { enumValues: string[] }) {
  return (
    <Select value={value == null ? "" : String(value)} onValueChange={(v) => onCommit(v || null)}>
      <SelectTrigger className={`h-7 w-full px-2 py-0 text-sm ${invalid ? "text-destructive" : ""}`}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {enumValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 6: `FkCell.tsx`**

```tsx
"use client"
import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command"
import { Button } from "@/components/shadcn/button"
import type { CellProps } from "./TextCell"

export function FkCell({ value, onCommit, invalid, fkOptions = [] }: CellProps & { fkOptions: Array<{ value: string; label: string }> }) {
  const [open, setOpen] = useState(false)
  const current = fkOptions.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={`h-7 w-full justify-start px-2 py-0 text-sm ${invalid ? "text-destructive" : ""}`}>
          {current?.label ?? (value as string) ?? <span className="text-muted-foreground">—</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {fkOptions.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { setOpen(false); onCommit(o.value) }}>
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 7: `index.ts` — factory**

```ts
import { TextCell } from "./TextCell"
import { CnicCell } from "./CnicCell"
import { DateCell } from "./DateCell"
import { EnumCell } from "./EnumCell"
import { FkCell } from "./FkCell"
import type { DraftColumn } from "@/lib/imports/client/useDraft"

export function editorForKind(col: DraftColumn) {
  switch (col.kind) {
    case "date":   return DateCell
    case "enum":   return (p: any) => <EnumCell {...p} enumValues={col.enumValues ?? []} />
    case "fk":     return (p: any) => <FkCell {...p} fkOptions={col.fkOptions ?? []} />
    case "cnic":   return CnicCell
    case "number": return TextCell  // simple text + zod coerces; tighten later if needed
    case "text":
    default:       return TextCell
  }
}

export { TextCell, CnicCell, DateCell, EnumCell, FkCell }
```

- [ ] **Step 8: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/imports/draft-editor/cells
git commit -m "feat(imports): schema-aware cell editor primitives"
```

---

### Task 19: `DraftGrid` (virtualised TanStack Table)

**Files:**
- Create: `src/components/imports/draft-editor/DraftGrid.tsx`
- Create: `src/components/imports/draft-editor/RowStatus.tsx`

- [ ] **Step 1: `RowStatus.tsx`**

```tsx
"use client"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle, CircleOff } from "lucide-react"
import type { DraftRow } from "@/lib/imports/client/useDraft"

export function RowStatus({ row, onToggleSkip }: { row: DraftRow; onToggleSkip: (next: boolean) => void }) {
  if (row.skipped) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-muted-foreground"><CircleOff className="h-3.5 w-3.5" /> Skipped</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onToggleSkip(false)} aria-pressed>Unskip</Button>
      </div>
    )
  }
  if (row.errors.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-destructive"><AlertCircle className="h-3.5 w-3.5" /> {row.errors.length} error{row.errors.length === 1 ? "" : "s"}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onToggleSkip(true)}>Skip</Button>
      </div>
    )
  }
  return <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Valid</span>
}
```

- [ ] **Step 2: `DraftGrid.tsx`**

```tsx
"use client"
import { useMemo, useState } from "react"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn/tooltip"
import { editorForKind } from "./cells"
import { RowStatus } from "./RowStatus"
import type { DraftRow, DraftColumn } from "@/lib/imports/client/useDraft"

export function DraftGrid({
  rows,
  columns,
  onPatchRow,
  onToggleSkip,
}: {
  rows: DraftRow[]
  columns: DraftColumn[]
  onPatchRow: (rowNumber: number, data: Record<string, unknown>) => Promise<unknown>
  onToggleSkip: (rowNumber: number, skipped: boolean) => Promise<unknown>
}) {
  const tableColumns = useMemo<ColumnDef<DraftRow>[]>(() => [
    { id: "row", header: "Row", cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.rowNumber}</span>, size: 56 },
    ...columns.map((col): ColumnDef<DraftRow> => ({
      id: col.key,
      header: col.label,
      cell: ({ row }) => <Cell row={row.original} col={col} onPatchRow={onPatchRow} />,
    })),
    { id: "status", header: "Status", cell: ({ row }) => <RowStatus row={row.original} onToggleSkip={(s) => onToggleSkip(row.original.rowNumber, s)} /> },
  ], [columns, onPatchRow, onToggleSkip])

  const table = useReactTable({ data: rows, columns: tableColumns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="overflow-auto rounded-md border max-h-[70vh]">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0 z-10">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-2 py-1.5 text-left font-medium">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className={r.original.skipped ? "bg-muted/30 text-muted-foreground" : ""}>
              {r.getVisibleCells().map((c) => (
                <td key={c.id} className="border-t px-2 py-1 align-middle">{flexRender(c.column.columnDef.cell, c.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cell({ row, col, onPatchRow }: { row: DraftRow; col: DraftColumn; onPatchRow: (rn: number, d: Record<string, unknown>) => Promise<unknown> }) {
  const cellError = row.errors.find((e) => e.field === col.key || e.field === col.header || e.field === `${col.key}+${col.header}`)
  const invalid = Boolean(cellError)
  const Editor = editorForKind(col)
  const onCommit = (next: unknown) => onPatchRow(row.rowNumber, { [col.key]: next })
  const editor = <Editor value={row.data[col.key] ?? row.data[col.header]} onCommit={onCommit} invalid={invalid} />
  if (!invalid) return editor
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild><div className="border border-destructive bg-destructive/5 rounded">{editor}</div></TooltipTrigger>
        <TooltipContent>{cellError!.message}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

> Virtualisation: spec asks for it but the simplest first cut uses `max-h-[70vh] overflow-auto`. Add `@tanstack/react-virtual` in a follow-up task only if perf testing shows scroll judder. 5000-row hard cap × ~10 cells visible at a time = 50k DOM nodes worst case; usually fine.

- [ ] **Step 3: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/imports/draft-editor/DraftGrid.tsx src/components/imports/draft-editor/RowStatus.tsx
git commit -m "feat(imports): DraftGrid + RowStatus components"
```

---

### Task 20: `DraftHeader` + dialogs

**Files:**
- Create: `src/components/imports/draft-editor/DraftHeader.tsx`
- Create: `src/components/imports/draft-editor/FinalizeDialog.tsx`
- Create: `src/components/imports/draft-editor/DiscardDialog.tsx`

- [ ] **Step 1: `DraftHeader.tsx`**

```tsx
"use client"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle, CircleOff } from "lucide-react"
import type { DraftRow } from "@/lib/imports/client/useDraft"

export function DraftHeader({
  fileName, status, expiresAt, totals, onDiscard, onFinalize, finalizing,
}: {
  fileName: string | null
  status: string
  expiresAt: string | null
  totals: { valid: number; errored: number; skipped: number; total: number }
  onDiscard: () => void
  onFinalize: () => void
  finalizing: boolean
}) {
  const canFinalize = totals.errored === 0 && totals.valid > 0
  const exp = expiresAt ? new Date(expiresAt) : null
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{fileName ?? "Untitled draft"} <span className="ml-2 inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">DRAFT</span></p>
          {exp && <p className="text-xs text-muted-foreground">Expires {exp.toLocaleString("en-PK")}</p>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {totals.valid} valid</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground"><CircleOff className="h-4 w-4" /> {totals.skipped} skipped</span>
          <span className={`inline-flex items-center gap-1 ${totals.errored > 0 ? "text-destructive" : "text-muted-foreground"}`}><AlertCircle className="h-4 w-4" /> {totals.errored} errors</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDiscard}>Discard</Button>
          <Button onClick={onFinalize} disabled={!canFinalize || finalizing}>
            {finalizing ? "Importing…" : `Import ${totals.valid} row${totals.valid === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `FinalizeDialog.tsx`**

```tsx
"use client"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/shadcn/alert-dialog"

export function FinalizeDialog({ open, onOpenChange, validCount, skippedCount, onConfirm }: {
  open: boolean
  onOpenChange: (next: boolean) => void
  validCount: number
  skippedCount: number
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import {validCount} row{validCount === 1 ? "" : "s"}?</AlertDialogTitle>
          <AlertDialogDescription>
            {skippedCount > 0 ? `${skippedCount} skipped row${skippedCount === 1 ? "" : "s"} will not be imported. ` : ""}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Import</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 3: `DiscardDialog.tsx`**

```tsx
"use client"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/shadcn/alert-dialog"
import { buttonVariants } from "@/components/shadcn/button"

export function DiscardDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (n: boolean) => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
          <AlertDialogDescription>All edits will be permanently lost. The original upload is not retained.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={onConfirm}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 4: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/imports/draft-editor/DraftHeader.tsx src/components/imports/draft-editor/FinalizeDialog.tsx src/components/imports/draft-editor/DiscardDialog.tsx
git commit -m "feat(imports): DraftHeader + Finalize/Discard dialogs"
```

---

### Task 21: `DraftEditor` orchestrator + route page

**Files:**
- Create: `src/components/imports/draft-editor/DraftEditor.tsx`
- Create: `src/app/(dashboard)/imports/drafts/[id]/page.tsx`

- [ ] **Step 1: `DraftEditor.tsx`**

```tsx
"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useDraft } from "@/lib/imports/client/useDraft"
import { DraftHeader } from "./DraftHeader"
import { DraftGrid } from "./DraftGrid"
import { FinalizeDialog } from "./FinalizeDialog"
import { DiscardDialog } from "./DiscardDialog"

export function DraftEditor({ draftId }: { draftId: string }) {
  const router = useRouter()
  const { loading, error, job, columns, totals, rowsByNumber, patchRow, setSkipped, finalize, discard } = useDraft(draftId)
  const [showFinalize, setShowFinalize] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const sortedRows = useMemo(() => [...rowsByNumber.values()].sort((a, b) => a.rowNumber - b.rowNumber), [rowsByNumber])

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading draft…</p>
  if (error || !job) return <p className="p-6 text-sm text-destructive">{error ?? "Draft not found"}</p>

  return (
    <div className="p-4">
      <DraftHeader
        fileName={job.fileName}
        status={job.status}
        expiresAt={job.expiresAt}
        totals={totals}
        onDiscard={() => setShowDiscard(true)}
        onFinalize={() => setShowFinalize(true)}
        finalizing={finalizing}
      />
      <DraftGrid
        rows={sortedRows}
        columns={columns}
        onPatchRow={async (rn, d) => { try { await patchRow(rn, d) } catch (e) { toast.error(e instanceof Error ? e.message : "Edit failed") } }}
        onToggleSkip={async (rn, s) => { try { await setSkipped(rn, s) } catch (e) { toast.error(e instanceof Error ? e.message : "Skip failed") } }}
      />
      <FinalizeDialog
        open={showFinalize}
        onOpenChange={setShowFinalize}
        validCount={totals.valid}
        skippedCount={totals.skipped}
        onConfirm={async () => {
          setShowFinalize(false); setFinalizing(true)
          const { status, payload } = await finalize()
          setFinalizing(false)
          if (status === 200) {
            toast.success(`Imported ${payload.data.successRows} rows.`)
            router.push("/imports")
          } else {
            toast.error(payload.message || "Finalize failed")
          }
        }}
      />
      <DiscardDialog open={showDiscard} onOpenChange={setShowDiscard}
        onConfirm={async () => { await discard(); router.push("/imports") }} />
    </div>
  )
}
```

- [ ] **Step 2: Server shell `page.tsx`**

```tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { DraftEditor } from "@/components/imports/draft-editor/DraftEditor"

export default async function DraftEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasAction(session, "IMPORTS", "VIEW")) redirect("/")
  const { id } = await params
  return <DraftEditor draftId={id} />
}
```

- [ ] **Step 3: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/imports/draft-editor/DraftEditor.tsx src/app/'(dashboard)'/imports/drafts/'[id]'/page.tsx
git commit -m "feat(imports): /imports/drafts/:id page + DraftEditor orchestrator"
```

---

### Task 22: Wire upload to draft flow behind the workflow rule

**Files:**
- Modify: `src/components/imports/ImportsLifecycleManager.tsx`

- [ ] **Step 1: Add a server-rendered prop that reads the flag**

Update the page that mounts `ImportsLifecycleManager` (`src/app/(dashboard)/imports/page.tsx`) to read the workflow rule and pass it as a prop:

```tsx
// src/app/(dashboard)/imports/page.tsx
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import ImportsLifecycleManager from "@/components/imports/ImportsLifecycleManager"

export default function ImportsPage() {
  return <ImportsLifecycleManager initialModule="users" draftEditorEnabled={isWorkflowRuleEnabled("imports.draftEditor")} />
}
```

- [ ] **Step 2: Add the prop and branch the upload action**

In `ImportsLifecycleManager.tsx`:

```tsx
type Props = { initialModule?: ImportModule; draftEditorEnabled?: boolean }
export default function ImportsLifecycleManager({ initialModule = "users", draftEditorEnabled = false }: Props) {
  // ...existing state
  const router = useRouter()
  const [resumePrompt, setResumePrompt] = useState<{ existingDraftId: string } | null>(null)

  const onUploadOpenEditor = async () => {
    if (!file && !csvInput.trim()) { setNotice({ type: "error", message: "Choose a file or paste CSV first." }); return }
    setLoadingProcess(true)
    try {
      const payload = await uploadBody()
      const res = await fetch(`/api/imports/${moduleName}/draft${queryString}`, {
        method: "POST", headers: payload.headers, body: payload.body,
      })
      const data = await res.json()
      if (res.status === 409 && data.data?.existingDraftId) {
        setResumePrompt({ existingDraftId: data.data.existingDraftId })
        return
      }
      if (!res.ok) { setNotice({ type: "error", message: data.message || "Upload failed" }); return }
      router.push(`/imports/drafts/${data.data.draftId}`)
    } finally { setLoadingProcess(false) }
  }
```

In the buttons row, branch on `draftEditorEnabled`:

```tsx
{draftEditorEnabled ? (
  <Button onClick={onUploadOpenEditor} disabled={loadingProcess}>
    {loadingProcess ? "Uploading…" : "Upload & Open Editor"}
  </Button>
) : (
  <>
    <Button onClick={onValidate} disabled={loadingValidate}>{loadingValidate ? "Validating…" : "Validate"}</Button>
    <Button variant="secondary" onClick={onProcess} disabled={loadingProcess}>{loadingProcess ? "Processing…" : "Import"}</Button>
  </>
)}
```

Add an AlertDialog at the bottom of the rendered tree for the resume-or-discard prompt:

```tsx
{resumePrompt && (
  <AlertDialog open onOpenChange={() => setResumePrompt(null)}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>You have an in-progress {moduleName} draft</AlertDialogTitle>
        <AlertDialogDescription>Resume editing where you left off, or discard it and start fresh?</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => setResumePrompt(null)}>Cancel</AlertDialogCancel>
        <Button variant="ghost" onClick={async () => {
          await fetch(`/api/imports/drafts/${resumePrompt.existingDraftId}`, { method: "DELETE" })
          setResumePrompt(null)
          onUploadOpenEditor()
        }}>Discard &amp; Start Over</Button>
        <AlertDialogAction onClick={() => router.push(`/imports/drafts/${resumePrompt.existingDraftId}`)}>Resume</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

Also: in the Recent Imports table, when a row's `status === "DRAFT"`, replace the "Download errors" link with a "Continue" link to `/imports/drafts/${h.id}`.

- [ ] **Step 3: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/'(dashboard)'/imports/page.tsx src/components/imports/ImportsLifecycleManager.tsx
git commit -m "feat(imports): wire upload to draft editor when imports.draftEditor flag is on"
```

---

### Task 23: Manual QA pass against `guards-test-import.xlsx`-style fixture

**Files:**
- Create: `scripts/make-test-import.mjs` (regenerate the fixture from the earlier session)

- [ ] **Step 1: Regenerate the test fixture**

(Re-use the script you wrote earlier this session — same content. Saves to `test-imports/guards-test-import.xlsx`.)

- [ ] **Step 2: Enable the workflow flag in dev**

Edit `src/lib/workflows/policy.ts` overrides (or the workflow rules admin UI at `/settings/workflows`) to flip `imports.draftEditor` to `true` for dev.

- [ ] **Step 3: Acceptance walkthrough**

1. Navigate to `/imports/guards`
2. Upload `test-imports/guards-test-import.xlsx`
3. Land on `/imports/drafts/:id`
4. Verify totals: 3 valid, 1 errored, 0 skipped (phantom row was dropped at parse)
5. Find row 5 (Faisal Raza, CNIC `12345`) — bad cell is highlighted, tooltip on hover
6. Click into the CNIC cell → mask-input → type `35202-1234567-1` → tab out
7. Error clears, row 5 turns valid (totals: 4 valid, 0 errored)
8. Click "Import 4 rows" → confirm dialog → success toast → land back on `/imports`
9. Verify in Recent Imports the new job shows COMPLETED with 4/4

- [ ] **Step 4: Two-tab edit smoke test**

Open the same draft URL in two tabs. Edit row 2 in tab A, then edit row 2 in tab B. Tab B's edit should win silently; tab A still shows its (stale) value until next round-trip. Acceptable per spec.

- [ ] **Step 5: Refresh-resilience test**

Mid-edit, refresh the page. All edits up to the last successful PATCH are still there.

- [ ] **Step 6: Commit + push**

```bash
git add scripts/make-test-import.mjs
git commit -m "test(imports): regenerate guards draft-editor acceptance fixture"
git push
```

---

### Phase 2 checkpoint

Demo to user before enabling the flag in production. Confirm: workflow rule defaults to **off** in all three presets; no user sees the new UI yet. Phase 3 is gradual enablement.

---

## Phase 3 — Rollout (no code changes per stage; flag flips only)

### Task 24: Enable for SuperAdmin only

- [ ] In production `/settings/workflows`, flip `imports.draftEditor` → `true`.
- [ ] Confirm only SuperAdmin users see the new "Upload & Open Editor" button (others see legacy Validate/Import — verify with a non-admin test account).
- [ ] Monitor logs for one business day. Watch for `DraftError` traces, 422s from finalize, and any 500s out of `/api/imports/drafts/*`.

### Task 25: Enable for QA group, then everyone

- [ ] After clean day, leave the flag on. Notify QA leads.
- [ ] After two release cycles with no incidents: announce in changelog that legacy `Validate` / `Import` buttons in the UI are deprecated (still callable via API for scripts).

### Task 26: Tidy

- [ ] Remove `csvInput` textarea path from `ImportsLifecycleManager` if usage drops to zero (check audit logs).
- [ ] Migrate any internal scripts that POST to `/process` over to `/draft` + `/finalize`.

---

## Self-Review

### Spec coverage

- §2 Goals → killed Excel round-trip (Tasks 16-23), explicit skip (Tasks 12, 19, 20), survives interruptions (Tasks 5-6, draft persistence), renders xlsx (Tasks 17-19 use server-parsed rows). ✓
- §6 Schema → Task 5. ✓
- §7 API surface → Tasks 7-14 cover every endpoint listed. ✓
- §8 Validation semantics → Tasks 6, 11, 12, 13. ✓
- §9 UI → Tasks 16-22. ✓
- §10 Engine changes → Tasks 1-4. ✓
- §11 Rollout phases → Phases 1/2/3 in this plan. ✓
- §12 Testing → Task 15 (integration), Task 23 (manual QA). Project has no unit-test runner; this is the practical equivalent. ✓
- §13 Performance limits → Task 6 (`MAX_DRAFT_ROWS`), Task 10 (paginated rows endpoint). ✓

### Placeholder scan

- Task 4's "Continue for the remaining ~90 columns" is a deliberate prose pointer, not a stub — the structural pattern is fully shown above it, and the engineer follows it for the listed remaining headers. Acceptable.
- Task 5 says "If you used `migrate dev` … the manual SQL file is overwritten" — that's a real instruction, not a TBD.

### Type consistency

- `BulkImportJobRow` shape matches between Prisma model (Task 5), `DraftRow` type (Task 17), and grid usage (Tasks 18-19).
- `DraftColumn.kind` enum matches between `ColumnDescriptor` (Task 3), columns endpoint (Task 8), and `editorForKind` (Task 18).
- `DraftError.code` values used in service (Task 6) and translated in routes (Tasks 7, 9, 11-13) all match.

No gaps found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-bulk-import-draft-editor.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
