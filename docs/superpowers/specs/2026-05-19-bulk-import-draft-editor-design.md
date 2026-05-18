# Bulk Import — Draft Editor

**Status:** Design accepted, awaiting implementation plan
**Date:** 2026-05-19
**Owner:** —
**Related code:** `src/lib/imports/`, `src/components/imports/`, `src/app/api/imports/`, `src/app/(dashboard)/imports/`

---

## 1. Problem

The current Bulk Import flow forces QA into a round-trip with Excel for every fix:

1. Upload → server validates → response lists errors as `{ row, field, message }` with no row-data context in the page.
2. To see *which value* needs correcting, the user downloads a separate errors xlsx.
3. To fix anything, the user edits the source file in Excel and re-uploads.
4. The Preview Rows section parses CSV but ignores xlsx, so uploaded `.xlsx` files have no in-page preview at all.

For a 200-row guards import with 12 typos, this means ~12 round-trips between browser and Excel. Recently filed tickets (e.g. #50 "downloading the errors does not show the incorrect data") expose this pain. Earlier fixes patched the worst symptoms (phantom-row bug, `[object Object]` strings, missing row data in error downloads) but the round-trip itself remained.

## 2. Goals

- **Kill the Excel round-trip for fixable errors.** A user should be able to upload, see exactly which cell is wrong, fix it in place, and import — without ever opening Excel again.
- **Make import outcomes intentional.** Every row that doesn't end up in the database must be the result of a visible human decision (skip), not a silent drop.
- **Survive interruptions.** A 30-minute fix session must survive an accidental tab close, browser crash, or laptop reboot.
- **Render every row the engine sees**, including xlsx — eliminate the gap between what's previewed and what's validated.

## 3. Non-goals

- A full spreadsheet replacement (no add-row, delete-row, copy-paste-from-Excel, undo stack, multi-cell selection).
- Real-time live cross-field validation on every keystroke. Per-row revalidation runs on blur; that is sufficient.
- Multi-user collaboration on a single draft. One draft is owned by one user.
- Re-using the upload file blob (no "download original" feature; not in scope).
- Migrating legacy non-draft jobs to the new editor. They remain readable in history but are not editable.

## 4. Key decisions

| # | Decision | Alternatives rejected | Why |
|---|---|---|---|
| 1 | **Inline-fix-and-revalidate** UX (between read-only-preview and full spreadsheet editor) | Read-only preview leaves Excel round-trip intact; full spreadsheet editor is a separate product. | Kills the actual workflow pain without committing the team to maintaining a spreadsheet replacement. |
| 2 | **Persisted draft** (server-side state) | Browser-only state. | A 30-minute fix session must not be wiped by an accidental refresh. Also gives an audit trail. |
| 3 | **Explicit skip** to import partial batches | Strict (must fix all); permissive (silently drop broken rows = today's behaviour). | Strict is too rigid for large batches; permissive is what produced the "silently dropped data" surprise. Explicit skip makes every excluded row a visible, audited decision. |
| 4 | **Schema-aware cell editors** (text / cnic-mask / date picker / enum dropdown / fk-search) | Plain text everywhere; B + live cross-field validation. | Plain text just moves the typo loop in-page. Live cross-field is engineering overhead the engine already covers at blur. |
| 5 | **One draft per (user × module)**; 7-day auto-expire | Multiple coexisting drafts; team-shared drafts. | Parwest QA pattern is "one person fixes one batch end-to-end" — multi-draft and handoff are theoretical conveniences. Keep simple; layer on later if real demand. |
| 6 | **Cross-row dup recompute on every edit** | Defer to finalize. | O(rows × dup_fields) is trivial for ≤5000 rows in memory; users must always know if their fix introduced a duplicate elsewhere. |
| 7 | **Single summary audit entry** at finalize | Per-cell edit history table. | Cell-level history is N×M×T storage explosion; the value-per-byte is poor. Row `lastEditedAt/By` is enough granularity for incident review. |

## 5. Architecture

```
┌──────────────────────┐    upload xlsx/csv     ┌──────────────────────────────┐
│   /imports/:module   │ ────────────────────►  │  POST /api/imports/:mod/draft│
│   (upload entry)     │                        │   • parseImportFile          │
│                      │                        │   • create BulkImportJob     │
│                      │ ◄──── { draftId } ──── │     status=DRAFT, expires +7d│
└──────────────────────┘                        │   • upsert BulkImportJobRow  │
            │                                   │     per data row             │
            │ redirect                          │   • initial validation pass  │
            ▼                                   └──────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────┐
│  /imports/drafts/:id   ←  the new editor page                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ sticky header:  name · DRAFT (4h ago)                               │   │
│  │   ✓ 197 valid   ⊘ 3 skipped   ✗ 0 errors    [Discard] [Import 197]  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ virtualised grid (TanStack Table) — schema-aware editors per cell   │   │
│  │ row 5 │ Faisal │ ⚠ 12345 │ 1995-07-15 │ ... │ ✗ 1 error  [skip]     │   │
│  │ row 6 │ Sara   │ 35202-… │ 1992-02-28 │ ... │ ✓                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           ▲ click cell → editor opens; blur → PATCH row                    │
│           ▲ click [skip] → PATCH skip toggle                               │
└────────────────────────────────────────────────────────────────────────────┘
            │  click Import
            ▼
┌──────────────────────────────────────┐
│  POST /api/imports/drafts/:id/finalize│
│   • lock job row                      │
│   • re-run engine on non-skipped rows │
│   • reject 422 if any errors          │
│   • definition.persist per row        │
│   • flip DRAFT → COMPLETED            │
└──────────────────────────────────────┘
```

**Source-of-truth invariant:** the server-persisted `BulkImportJobRow.data` is canonical. The client grid is a mirror; every edit is a round-trip; the client never holds unsynced state.

## 6. Database schema

### Modify `BulkImportJob`

```prisma
enum BulkImportStatus {
  DRAFT                  // ← new
  VALIDATING
  PROCESSING
  COMPLETED
  PARTIALLY_COMPLETED
  FAILED
}

model BulkImportJob {
  // existing fields unchanged
  expiresAt   DateTime?   // populated for DRAFT (createdAt + 7d); null otherwise
  rows        BulkImportJobRow[]
}
```

### New `BulkImportJobRow`

```prisma
model BulkImportJobRow {
  id              String        @id @default(cuid())
  jobId           String
  job             BulkImportJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  rowNumber       Int           // 1-based file row; header=1, first data row=2
  data            Json          // canonical normalised cells (post-parse, pre-alias)
  errors          Json          // [{ field, message }] from last validation
  skipped         Boolean       @default(false)
  dirty           Boolean       @default(false)  // true between edit and revalidate
  lastEditedById  String?
  lastEditedAt    DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([jobId, rowNumber])
  @@index([jobId, skipped])
}
```

### Migration

A single Prisma migration:

1. Add `DRAFT` to the `BulkImportStatus` enum.
2. Add `expiresAt` column to `BulkImportJob` (nullable).
3. Create the `BulkImportJobRow` table with the schema above.

Existing `BulkImportJob` rows are unaffected — they have no children in `BulkImportJobRow`, so the UI treats them as legacy (read-only history) and shows the existing "download errors" controls. No backfill needed.

### Cleanup cron

A daily cron (added under `src/lib/cron/` or invoked via Vercel Cron) sweeps `BulkImportJob WHERE status = 'DRAFT' AND expiresAt < now()` and deletes them. Cascade removes the child rows.

### What we are explicitly **not** adding

- **Per-cell edit history table.** Too much volume; low value-per-byte. Row-level `lastEditedAt/By` suffices for incident review.
- **`BulkImportJobIssue` cross-row issue table.** Cross-row duplicate errors are written onto each colliding row's `errors` array (`"Duplicate of row 12 on (cnic)"`). Same UI rendering, no extra table.
- **Original file blob storage.** Not in scope.

## 7. API surface

All endpoints are under `/api/imports/`. Permission gates:

- All draft routes require `IMPORTS.PROCESS` for mutations and `IMPORTS.VIEW` for reads.
- Drafts are **creator-only**. Requests by non-owners return `404`, never `403`, to avoid existence-leak.
- Regional / role scoping rules from `src/lib/access/scope.ts` are unchanged — they apply at finalize when the engine's `persist` runs.

### New endpoints

| Method | Path | Body / Query | Response (200) | Errors |
|---|---|---|---|---|
| `POST` | `/imports/:module/draft?sub=` | multipart `file` or JSON `{ rows }` | `{ draftId }` | `409 { existingDraftId }` if user already has a draft for this `(module, subModule)` |
| `GET` | `/imports/drafts/:id` | — | `{ job, columns, totals: { valid, skipped, errored } }` | `404` (not found / not owner) |
| `GET` | `/imports/drafts/:id/rows?cursor=&take=` | `take` default 100, max 500 | `{ rows: BulkImportJobRow[], nextCursor }` | `404` |
| `PATCH` | `/imports/drafts/:id/rows/:rowNumber` | `{ data: Partial<RowData> }` | `{ row, affectedRows: [{ rowNumber, errors }] }` | `404`, `409` (status changed) |
| `PATCH` | `/imports/drafts/:id/rows/:rowNumber/skip` | `{ skipped: boolean }` | `{ row }` | `404`, `409` |
| `POST` | `/imports/drafts/:id/finalize` | — | `{ jobId, status, successRows, failedRows }` | `404`, `422` (errors remain) |
| `DELETE` | `/imports/drafts/:id` | — | `{ deleted: true }` | `404` |
| `GET` | `/imports/:module/columns?sub=` | — | `[{ key, label, kind, enumValues?, fkOptions?, required, headerAlias? }]` | `400`, `403` |

`kind` enum: `"text"` `"cnic"` `"date"` `"number"` `"enum"` `"fk"`.

### Existing endpoints kept

- `/imports/:module/template` — unchanged
- `/imports/:module/validate` — kept; legacy non-draft dry-run path
- `/imports/:module/process` — kept; legacy direct-import path (for callers that don't want the editor)
- `/imports/jobs` — unchanged; lists both DRAFT and legacy jobs
- `/imports/jobs/:id`, `/imports/jobs/:id/errors` — unchanged for legacy jobs

## 8. Validation semantics

### On every `PATCH /imports/drafts/:id/rows/:rowNumber`

1. **Apply edit.** Merge `body.data` into `BulkImportJobRow.data`. Set `dirty = true`, `lastEditedAt`, `lastEditedBy`.
2. **Per-row validation.** Reuse engine internals (`applyHeaderAliases`, `resolveReferences`, `applyConditionals`, `rowSchema.safeParse`) against the single row.
3. **Per-row DB-duplicate check.** For each definition `duplicates` rule scoped `db` or `both`, call `existsInDb` for this row.
4. **Whole-draft payload-duplicate recompute.** Re-run cross-row payload-dup check across all non-skipped rows. Compute `affectedRows = rows whose dup-error state changed`.
5. **Persist.** Write this row's new `errors` and any affected siblings' new `errors`. Clear `dirty`.
6. **Respond.** `{ row, affectedRows }`. Client patches its local grid for these row numbers only.

### On `POST /imports/drafts/:id/finalize`

1. **Lock.** `SELECT … FOR UPDATE` on the `BulkImportJob` row to serialise concurrent finalize attempts.
2. **Refresh validation.** Re-run the full engine against `BulkImportJobRow.data` where `skipped = false`. Defence in depth — guards against drift between optimistic per-row state and the engine's authoritative view.
3. **Gate.** If any row has errors → `422 { errors }`; client refreshes the editor and shows the new state.
4. **Persist.** For each row, call `definition.persist` inside the configured transaction mode.
5. **Audit + status.** Update `BulkImportJob.status` to `COMPLETED` (all succeeded), `PARTIALLY_COMPLETED` (some `persist` threw despite passing validation — rare), or `FAILED` (everything threw). Write a single audit log entry: *"user X finalized draft Y; imported N rows; skipped M rows; edited K cells across J rows."*
6. **Cleanup.** `expiresAt` cleared. Child `BulkImportJobRow` rows retained for the audit trail; they are queryable but not editable (job is no longer `DRAFT`).

### Failure modes

| Scenario | Handling |
|---|---|
| User edits while finalize is running | PATCH waits on the row lock briefly, then sees status changed (`409`) and refetches. |
| Two browser tabs editing the same draft | Last-write-wins per row. UI shows `lastEditedAt` and stale cells repaint on the next round-trip. |
| Draft expired between open and edit | PATCH returns `404`; UI redirects back to upload page with a toast: *"This draft expired and was deleted."* |
| Skipped row count drops to 0 valid rows | Import button shows `Import 0 rows` and is disabled with tooltip "Nothing left to import." |
| `persist` throws for one row at finalize despite passing validation (e.g. race against another user creating the same FK) | Job becomes `PARTIALLY_COMPLETED`; the failed row's error is appended to its `BulkImportJobRow.errors`; row is not auto-skipped (user can investigate). |

## 9. Frontend / UI

### Pages

**`/imports`** (entry): essentially unchanged. The existing `ImportsLifecycleManager` is **split**: upload + history stays here; the validation summary + job sections move to the editor.

**`/imports/drafts/:id`** (new): the editor. New top-level route under `(dashboard)`, behind the existing `IMPORTS` permission middleware.

### Editor component breakdown

```
src/app/(dashboard)/imports/drafts/[id]/page.tsx     ← thin server-rendered shell
src/components/imports/draft-editor/
  ├── DraftEditor.tsx                ← client component, orchestrates state
  ├── DraftHeader.tsx                ← sticky totals + Import/Discard buttons
  ├── DraftGrid.tsx                  ← virtualised TanStack Table
  ├── cells/
  │   ├── TextCell.tsx
  │   ├── CnicCell.tsx               ← format-mask
  │   ├── DateCell.tsx               ← shadcn DatePicker
  │   ├── EnumCell.tsx               ← shadcn Select
  │   ├── FkCell.tsx                 ← shadcn Combobox (async search)
  │   └── index.ts                   ← editorForKind(kind) factory
  ├── RowStatus.tsx                  ← ✓ / ⚠ N errors / ⊘ skipped + [skip] button
  ├── FinalizeDialog.tsx             ← AlertDialog confirmation
  └── DiscardDialog.tsx              ← AlertDialog confirmation
src/lib/imports/client/
  └── useDraft.ts                    ← custom hook bundle wrapping fetch (matches existing
                                       imports-page pattern: useState + useEffect + raw fetch)
```

### Client state

- **No new state library.** Server state is fetched via raw `fetch` in `useEffect`, matching the existing `ImportsLifecycleManager` pattern. The `useDraft` hook bundle wraps fetch calls + an internal `useReducer` for the row-keyed cache so the grid can patch by `rowNumber` without re-fetching everything.
- **Optimistic update on PATCH:** client immediately repaints the edited cell, then reconciles with the server response (including any `affectedRows` siblings). On error → revert + toast.
- **Polling:** none. The page is single-user (creator-only drafts), so no need to poll for external changes. The user's own edits are write-through, not polled.
- No global state library. The grid component owns transient editor state (currently-open cell, in-progress text).

### Upload flow change

The existing `/imports` page's "Validate" and "Import" buttons are replaced by a single **"Upload & Open Editor"** button. If a draft for this module already exists, the server returns `409 { existingDraftId }` and the UI shows an `AlertDialog`: *"You have an in-progress {module} draft from {time}. Resume editing, or discard and start over?"*

Legacy callers using `/process` directly (scripts, API integrations) are unaffected.

### Visual tokens

- Bad cell: `bg-destructive/10`, `border-destructive`, tooltip uses shadcn `Tooltip`
- Skipped row: muted text (`text-muted-foreground`), badge `⊘ Skipped`, full row at `bg-muted/30`
- Valid cell: default
- Dirty (in-flight revalidate): subtle pulsing ring, `animate-pulse` on cell border

### A11y

- Cell editors are real form controls (`<input>`, shadcn `Select`/`Combobox`)
- Status badges include text labels (project convention)
- Keyboard navigation: arrow keys move focus across cells; Enter opens editor; Esc cancels; Tab moves to next cell
- Skip toggle is a real `<button>` with `aria-pressed`

## 10. Engine changes

The validation engine in `src/lib/imports/engine.ts` is refactored to expose **reusable per-row primitives** so both the draft editor and the existing batch path call the same code:

```ts
// new exported functions (no behaviour change for existing callers)
export async function validateRow(
  definition: BulkImportDefinition,
  row: Record<string, unknown>,
  ctx: ImportRunContext,
  rowNumber: number,
): Promise<{ row: Record<string, unknown>; data?: unknown; errors: ImportRowError[] }>

export function recomputePayloadDuplicates(
  definition: BulkImportDefinition,
  rows: Array<{ rowNumber: number; data: Record<string, unknown>; skipped: boolean }>,
): Map<number, ImportRowError[]>
```

The existing `runImport` function is refactored to call these — no semantic change for legacy callers, but the same code paths drive both flows.

A new field on `BulkImportDefinition`:

```ts
export type ColumnDescriptor = {
  key: string                       // post-alias canonical key
  header: string                    // sheet-side header label
  kind: "text" | "cnic" | "date" | "number" | "enum" | "fk"
  required: boolean
  enumValues?: string[]             // for kind="enum"
  fkOptionsLoader?: (ctx: ImportRunContext) => Promise<Array<{ value: string; label: string }>>
}

export type BulkImportDefinition = {
  // ...existing fields
  columns: ColumnDescriptor[]       // new — drives the editor and the columns endpoint
}
```

Each existing definition file (`guards.ts`, `users.ts`, `clients.ts`, `inventory.ts`) gets a `columns` array. For columns whose `kind` is `text`, the descriptor is one line; for date/enum/fk columns, the descriptor encodes the editor hint.

## 11. Migration / rollout

1. **Phase 1** — ship schema migration + draft endpoints + engine refactor. The UI is unchanged; the new endpoints are dark.
2. **Phase 2** — ship the editor page and route the "Upload" button to the new flow behind a feature flag (`IMPORTS_DRAFT_EDITOR` workflow rule).
3. **Phase 3** — enable the flag for Super Admin first, then a small QA group, then everyone. Old paths (`/validate`, `/process`) stay live the entire time.
4. **Phase 4** — once the editor has been the default for two release cycles with no incidents, deprecate `/validate` and `/process` (still callable for API integrations, but the UI no longer uses them).

## 12. Testing

### Automated

- **Unit (`src/lib/imports/__tests__/`):**
  - `validateRow` against the guards definition: required-field errors, ref-resolver errors, conditional errors, zod errors
  - `recomputePayloadDuplicates`: dup detection, dup-clearance when a row is edited or skipped, skipping a row removes it from the dup pool
  - Finalize re-run: drift between optimistic row state and re-validated state surfaces as 422
- **API integration (`__tests__/api/imports/drafts/`):**
  - Create draft → patch row → skip row → finalize → COMPLETED job
  - 409 on duplicate draft, 404 on non-owner access, 422 on finalize with errors
  - Cascade delete on `DELETE /drafts/:id`
- **Engine regression:** existing `runImport` tests pass unchanged.

### Manual / QA acceptance

- Upload the same `guards-test-import.xlsx` style file (3 valid + 1 bad CNIC + 1 phantom row): phantom dropped, bad CNIC visible, fix in-page, import shows 4/4 success
- Upload a 200-row file: editor renders within 2s; scrolling is smooth; cell edits round-trip in <500ms
- Two tabs editing the same draft: last-write-wins, no data corruption
- Refresh the page during editing: state preserved, no lost edits

## 13. Performance limits

- **Draft size:** soft cap 2000 rows, hard cap 5000. Beyond this, the upload endpoint returns `413` with a message suggesting splitting the file.
- **Row chunk pagination:** default 100 per request, max 500. Virtualised grid keeps DOM nodes ≤ visible rows + buffer.
- **Cross-row dup recompute:** at the 5000-row hard cap, recompute is O(rows × dup_fields) ≈ 50k field operations per edit — well under 50ms in Node.
- **Finalize:** for 5000 rows, full re-validation + persist in transaction mode may exceed Vercel's serverless 60s budget. Definitions configured with `persistInTransaction: true` get a 2000-row finalize cap; non-transactional definitions can go to 5000.

## 14. Open questions

None blocking. Items intentionally deferred for a follow-up:

- Storing the original uploaded file blob for "re-download original" support
- Per-cell edit history (rejected for v1; revisit if QA asks for it)
- Multi-user collaborative editing on a single draft (rejected for v1)
- Spreadsheet-grade features (add row, delete row, paste-from-Excel, undo/redo)

---

## Appendix A — Sequence: edit one cell

```
Browser                                    Server                              DB
   │                                          │                                 │
   │ click cell, type new value, blur         │                                 │
   ├─ optimistic local repaint ───────────────│                                 │
   │                                          │                                 │
   │ PATCH /drafts/:id/rows/5 { data }        │                                 │
   ├─────────────────────────────────────────►│                                 │
   │                                          │ load BulkImportJobRow #5        │
   │                                          ├────────────────────────────────►│
   │                                          │                                 │
   │                                          │ merge data, validateRow         │
   │                                          │ run DB dup checks for this row  │
   │                                          ├────────────────────────────────►│
   │                                          │                                 │
   │                                          │ load all non-skipped JobRows    │
   │                                          ├────────────────────────────────►│
   │                                          │ recomputePayloadDuplicates      │
   │                                          │                                 │
   │                                          │ write row #5 + any affectedRows │
   │                                          ├────────────────────────────────►│
   │                                          │                                 │
   │ ◄──── { row, affectedRows: [...] } ──────┤                                 │
   │                                          │                                 │
   │ reconcile local grid:                    │                                 │
   │  - row 5 errors + repaint                │                                 │
   │  - any sibling rows whose dup            │                                 │
   │    status changed                        │                                 │
```
