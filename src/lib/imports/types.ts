/**
 * Bulk Import Registry — public types.
 *
 * A `BulkImportDefinition` is data, not code: every (module, subModule) pair
 * registers one of these objects describing its headers, per-row validators,
 * cross-row checks, and a `persist` function. The generic validate/process
 * pipeline drives the registry, so adding a new sub-import means writing a
 * definition file — no controller/route/UI changes required.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import type { z } from "zod"

export type ImportModuleKey = string

/** A single per-row error captured during validation or processing. */
export type ImportRowError = {
  /** 1-based row number in the source file (header row is 1, first data row is 2). */
  row: number
  /** The header/field name responsible — `"__row__"` for whole-row errors. */
  field: string
  /** Human-readable error explanation. */
  message: string
  /** Original row values (best-effort) so QA can reproduce. */
  values?: Record<string, unknown>
  /** Error kind. `"DB_DUPLICATE"` marks an existing-record conflict (CNIC already
   *  enrolled / blacklisted) — a hard error that skipping does NOT resolve, so it
   *  stays visible on skipped rows. */
  code?: string
}

/** Header validation outcome. Hard-stops the import when `valid === false`. */
export type HeaderValidationResult = {
  valid: boolean
  /** Required headers absent from the uploaded sheet. */
  missing: string[]
  /** Headers in the uploaded sheet not declared by the schema. */
  unknown: string[]
}

/**
 * Per-row validation outcome. `data` is the typed/normalised row when valid;
 * `errors` accumulates everything wrong with that row.
 */
export type RowValidationResult<T> =
  | { valid: true; data: T; errors: [] }
  | { valid: false; errors: ImportRowError[] }

/**
 * Reference resolver — looks up FK existence (e.g. role name → role id).
 * Returns the resolved value (often an id) or null when not found. The
 * generic validator treats null as a row error using the supplied message.
 */
export type ReferenceResolver<T = unknown> = (
  value: string,
  ctx: ImportRunContext,
) => Promise<T | null>

/**
 * Persist hook — invoked once per valid row. Should be idempotent where
 * possible. Throw to mark the row failed; the engine collects the message.
 *
 * `tx` is the active Prisma transaction client when the engine runs in
 * transactional mode (configured per-definition). For per-row independence
 * (default), `tx` is the regular Prisma client.
 */
export type PersistFn<T> = (
  row: T,
  ctx: ImportRunContext & { tx: PrismaClient | Prisma.TransactionClient },
) => Promise<void>

/**
 * Context passed through validation and persistence — gives definitions
 * access to the active session, prisma client, current job id, and any
 * memoised lookups built during the run.
 */
export type ImportRunContext = {
  prisma: PrismaClient
  jobId: string
  /** Logged-in user id from the API session (null in mock mode). */
  actorUserId: string | null
  /**
   * Region / regional-office scope of the actor — definitions should respect
   * this when looking up references (e.g. only resolve guards within scope).
   */
  scope: {
    regionId?: string | null
    regionalOfficeIds?: string[] | null
  }
  /** Generic memoisation cache shared across rows for this run. */
  cache: Map<string, unknown>
}

export type DuplicateScope = "payload" | "db" | "both"

export type DuplicateRule = {
  /** Which header(s) form the dedup key. Composite when length > 1. */
  fields: string[]
  /** Where to check — within the uploaded payload, the DB, or both. */
  scope: DuplicateScope
  /**
   * DB lookup — required when scope includes "db". Returns true if the
   * composite-key tuple already exists.
   */
  existsInDb?: (
    values: Record<string, string>,
    ctx: ImportRunContext,
  ) => Promise<boolean>
  /** Optional override for the error message. */
  message?: string
}

export type ColumnKind = "text" | "cnic" | "phone" | "date" | "number" | "enum" | "fk"

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
  /**
   * Display-only column the editor renders non-editable. Used for values the
   * persist layer computes itself (e.g. joining date = date of import), shown
   * so the user can see what will be stored without being able to change it.
   */
  readOnly?: boolean
  /**
   * Offer a "set for all rows" bulk control above the grid for this column.
   * Intended for fields that are typically the same across an import batch
   * (e.g. supervisor). The control's value source is the column's `fkOptions`
   * for `kind === "fk"`, else a free-text input.
   */
  bulkApply?: boolean
}

export type ConditionalRule = {
  /** Header that triggers the rule when its predicate returns true. */
  when: { field: string; predicate: (value: string) => boolean }
  /** Field that becomes required when the predicate is satisfied. */
  thenRequired: string[]
  /** Optional override message. */
  message?: string
}

/**
 * A registered bulk-import definition. The shape is deliberately verbose so
 * each registration is self-describing — debugging a misbehaving import
 * means reading one file, not chasing across the codebase.
 */
export interface BulkImportDefinition<TRow = Record<string, unknown>> {
  /** Module key. Matches the route segment, e.g. "guards". */
  module: ImportModuleKey
  /** Sub-import key. Optional for top-level module imports (e.g. "users"). */
  subModule?: string
  /** Display label shown in the UI. */
  label: string
  /** Long-form description (shown under the title on the import screen). */
  description?: string

  /** Required headers in the order they appear in the template. */
  requiredHeaders: string[]
  /** Optional headers the schema understands. Unknown headers fail validation. */
  optionalHeaders?: string[]

  /**
   * Optional alias map: header-as-it-appears-in-the-sheet → canonical key.
   *
   * Used when the source template uses human-friendly headers
   * ("father name") but the zod schema / persist code expects camelCase
   * keys ("fatherName"). The engine remaps EVERY row's keys through this
   * map BEFORE reference resolution, zod parsing, and duplicate checks
   * run. Header validation is performed against the *aliased* headers,
   * so `requiredHeaders` + `optionalHeaders` should list the sheet-side
   * strings (the keys of this map), not the canonical names.
   *
   * Aliases are case-sensitive — match the team's template exactly.
   */
  headerAliases?: Record<string, string>

  /**
   * Zod schema applied to each row AFTER reference resolution. Use this for
   * required / format / length / enum checks. Reference + duplicate +
   * conditional checks are configured separately so the engine can short-
   * circuit DB queries when zod already failed.
   */
  rowSchema: z.ZodType<TRow>

  /**
   * FK resolvers — keyed by header. Each receives the raw cell string and
   * returns the resolved value (often a database id) or null. Resolved
   * values are merged into the row before zod runs.
   */
  referenceResolvers?: Record<string, ReferenceResolver>

  /** Conditional "X required when Y satisfies P" rules. */
  conditionals?: ConditionalRule[]

  /** Duplicate-detection rules. Multiple supported. */
  duplicates?: DuplicateRule[]

  /**
   * Whether to persist all rows in a single Prisma transaction. Default
   * false — independent per-row persistence so one bad row doesn't roll
   * back the rest. Set true for imports that must be all-or-nothing.
   */
  persistInTransaction?: boolean

  /** Persist hook. */
  persist: PersistFn<TRow>

  /**
   * Sample row(s) shown in the downloadable .xlsx template. The first row
   * after the header is filled with these values to give users a worked
   * example.
   */
  sampleRows?: Array<Record<string, string | number>>

  /** Required permission action. Defaults to ("IMPORTS", "CREATE"). */
  permission?: { module: string; action: string }

  /**
   * Editor metadata for the draft editor's grid. Each entry describes one
   * cell editor. Optional — when omitted, every column falls back to plain
   * text input. Define at least the columns that have non-trivial editors
   * (dates, enums, FKs) and let `text` be the default for the rest.
   */
  columns?: ColumnDescriptor[]
}

/**
 * Lightweight index for the UI — what the menu shows before a specific
 * definition is opened.
 */
export type BulkImportSummary = {
  module: ImportModuleKey
  subModule?: string
  label: string
  description?: string
  /** Headers that must be present in the uploaded file. */
  requiredHeaders: string[]
  /** Additional headers the import recognizes (not mandatory). */
  optionalHeaders?: string[]
}
