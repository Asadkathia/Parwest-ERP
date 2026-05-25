/**
 * Bulk Import Engine — generic validate + process pipeline.
 *
 * Drives a `BulkImportDefinition` against a parsed sheet:
 *   1. Header validation (hard-stop on mismatch).
 *   2. Per-row pipeline: reference resolution → conditionals → zod schema.
 *   3. Cross-row checks: duplicates (payload + DB).
 *   4. Persistence — per-row by default, transactional when requested.
 *
 * The engine writes to a durable `BulkImportJob` Prisma row throughout,
 * so partial progress is recoverable and the UI can poll `GET /api/imports/jobs/:id`.
 */

import type { BulkImportStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { z } from "zod"

import type { ParsedSheet } from "./excel"
import type {
  BulkImportDefinition,
  HeaderValidationResult,
  ImportRowError,
  ImportRunContext,
} from "./types"

export type EngineParsedSheet = {
  headers: string[]
  rows: Array<Record<string, unknown>>
  fileName?: string
}

export type EngineRunOptions = {
  module: string
  subModule?: string
  parsed: EngineParsedSheet | ParsedSheet
  actorUserId: string | null
  scope: ImportRunContext["scope"]
  /** When true, validate-only — no persistence, no job row mutation past
   *  the "VALIDATING → COMPLETED" transition. Used by the dry-run UI. */
  dryRun?: boolean
  /** Pre-existing job id (created upstream by the route). */
  jobId: string
}

export function validateHeaders(
  definition: BulkImportDefinition,
  parsedHeaders: string[],
): HeaderValidationResult {
  const knownSet = new Set([...(definition.requiredHeaders ?? []), ...(definition.optionalHeaders ?? [])])
  const fileSet = new Set(parsedHeaders.filter(Boolean))
  const missing = (definition.requiredHeaders ?? []).filter((h) => !fileSet.has(h))
  const unknown = parsedHeaders.filter((h) => h && !knownSet.has(h))
  return {
    valid: missing.length === 0 && unknown.length === 0,
    missing,
    unknown,
  }
}

/** Internal — narrows a parsed cell value to a string suitable for resolvers/zod. */
function cellToString(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v
  return String(v)
}

/**
 * Internal — remaps a parsed row's keys through the definition's
 * `headerAliases` (sheet-side header → canonical key). Unmapped keys pass
 * through unchanged so non-aliased optional headers still reach the schema.
 */
function applyHeaderAliases(
  definition: BulkImportDefinition,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const aliases = definition.headerAliases
  if (!aliases) return row
  const isEmpty = (x: unknown) => x === undefined || x === null || x === ""
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const canonical = aliases[k] ?? k
    if (canonical in out) {
      // Deterministic conflict resolution (row data is JSONB, so key insertion
      // order is NOT reliable): never overwrite with an empty value; a key that
      // is already canonical (k === canonical, e.g. a direct/edited value) wins
      // over a header-aliased value; otherwise keep the first non-empty value.
      if (isEmpty(v)) continue
      const incomingIsDirectCanonical = k === canonical
      if (!incomingIsDirectCanonical && !isEmpty(out[canonical])) continue
    }
    out[canonical] = v
  }
  return out
}

async function resolveReferences(
  definition: BulkImportDefinition,
  row: Record<string, unknown>,
  ctx: ImportRunContext,
  rowNumber: number,
): Promise<{ row: Record<string, unknown>; errors: ImportRowError[] }> {
  const errors: ImportRowError[] = []
  if (!definition.referenceResolvers) return { row, errors }
  const resolved: Record<string, unknown> = { ...row }
  for (const [field, resolver] of Object.entries(definition.referenceResolvers)) {
    const raw = cellToString(row[field])
    if (!raw) continue
    try {
      const value = await resolver(raw, ctx)
      if (value == null) {
        errors.push({
          row: rowNumber,
          field,
          message: `${field} "${raw}" was not found`,
          values: row,
        })
      } else {
        resolved[field] = value
      }
    } catch (err) {
      errors.push({
        row: rowNumber,
        field,
        message: err instanceof Error ? err.message : `Failed to resolve ${field}`,
        values: row,
      })
    }
  }
  return { row: resolved, errors }
}

function applyConditionals(
  definition: BulkImportDefinition,
  row: Record<string, unknown>,
  rowNumber: number,
): ImportRowError[] {
  const errors: ImportRowError[] = []
  for (const rule of definition.conditionals ?? []) {
    const trigger = cellToString(row[rule.when.field])
    if (!rule.when.predicate(trigger)) continue
    for (const required of rule.thenRequired) {
      if (!cellToString(row[required])) {
        errors.push({
          row: rowNumber,
          field: required,
          message:
            rule.message ??
            `${required} is required when ${rule.when.field} = "${trigger}"`,
          values: row,
        })
      }
    }
  }
  return errors
}

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
  const errors: ImportRowError[] = []
  if (!parsed.success) {
    for (const issue of (parsed.error as z.ZodError).issues) {
      errors.push({
        row: rowNumber,
        field: issue.path.join(".") || "__row__",
        message: issue.message,
        values: originalRow,
      })
    }
  }
  // Per-row DB-duplicate checks. Run these REGARDLESS of schema validity, so
  // errors like "CNIC already exists" surface alongside other row errors
  // instead of being hidden until every other field is fixed. They only need
  // the raw field value, not a fully-valid row.
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
    try {
      const exists = await rule.existsInDb(values, ctx)
      if (exists) {
        errors.push({
          row: rowNumber,
          field: rule.fields.join("+"),
          message:
            rule.message ??
            `Already exists in the database (${rule.fields.join(", ")} = ${rule.fields.map((f) => values[f]).join(", ")})`,
          values: originalRow,
          code: "DB_DUPLICATE",
        })
      }
    } catch (err) {
      // A failed duplicate probe must not break row validation, but log it —
      // a DB connection/logic failure here would otherwise be silently hidden.
      console.warn(`[validateRow] duplicate probe failed for row ${rowNumber}:`, err)
    }
  }
  if (errors.length > 0) return { row: refResult.row, errors }
  return { row: refResult.row, data: parsed.success ? parsed.data : undefined, errors: [] }
}

export type EngineResult = {
  totalRows: number
  successRows: number
  failedRows: number
  errors: ImportRowError[]
  /** Final job status after the run. */
  status: BulkImportStatus
}

/**
 * Runs validation + (optionally) persistence for the parsed sheet against
 * the registered definition. Mutates the `BulkImportJob` row throughout
 * so the UI can poll progress; returns a summary at the end.
 */
export async function runImport(
  definition: BulkImportDefinition,
  options: EngineRunOptions,
): Promise<EngineResult> {
  const { parsed, actorUserId, scope, dryRun, jobId } = options
  const ctx: ImportRunContext = {
    prisma,
    jobId,
    actorUserId,
    scope,
    cache: new Map(),
  }

  // Header validation is enforced at the controller level — we re-check
  // here as a defence-in-depth measure but treat it as a hard stop.
  const headerCheck = validateHeaders(definition, parsed.headers)
  if (!headerCheck.valid) {
    const errors: ImportRowError[] = []
    for (const m of headerCheck.missing) {
      errors.push({ row: 1, field: m, message: `Missing required header "${m}"` })
    }
    for (const u of headerCheck.unknown) {
      errors.push({ row: 1, field: u, message: `Unknown header "${u}"` })
    }
    await prisma.bulkImportJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorRows: errors as unknown as Prisma.InputJsonValue,
        headers: parsed.headers,
        totalRows: parsed.rows.length,
      },
    })
    return {
      totalRows: parsed.rows.length,
      successRows: 0,
      failedRows: parsed.rows.length,
      errors,
      status: "FAILED",
    }
  }

  await prisma.bulkImportJob.update({
    where: { id: jobId },
    data: {
      status: "VALIDATING",
      startedAt: new Date(),
      headers: parsed.headers,
      totalRows: parsed.rows.length,
    },
  })

  // Per-row validation pass
  const perRowErrors: ImportRowError[] = []
  const validRows: Array<{ rowNumber: number; data: unknown }> = []

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

  // Cross-row payload duplicates. Per-row DB-duplicate checks already
  // ran inside `validateRow` above, so we don't repeat them here. Rows are
  // aliased so duplicate rules reference canonical key names, not
  // sheet-side header strings.
  const aliasedView = parsed.rows.map((r, i) => ({
    rowNumber: i + 2,
    data: applyHeaderAliases(definition, r),
  }))
  const payloadDupMap = recomputePayloadDuplicates(definition, aliasedView)
  for (const [, errs] of payloadDupMap) perRowErrors.push(...errs)

  // Drop rows whose validation failed for any reason from the persist set.
  const failedRowSet = new Set(perRowErrors.map((e) => e.row))
  const toPersist = validRows.filter((v) => !failedRowSet.has(v.rowNumber))

  if (dryRun) {
    const status: BulkImportStatus =
      perRowErrors.length === 0 ? "COMPLETED" : "FAILED"
    await prisma.bulkImportJob.update({
      where: { id: jobId },
      data: {
        status,
        finishedAt: new Date(),
        successRows: toPersist.length,
        failedRows: parsed.rows.length - toPersist.length,
        processedRows: parsed.rows.length,
        errorRows: perRowErrors as unknown as Prisma.InputJsonValue,
      },
    })
    return {
      totalRows: parsed.rows.length,
      successRows: toPersist.length,
      failedRows: parsed.rows.length - toPersist.length,
      errors: perRowErrors,
      status,
    }
  }

  await prisma.bulkImportJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING" },
  })

  // Persistence pass
  const persistErrors: ImportRowError[] = []
  let successCount = 0

  const persistOne = async (
    rowEntry: { rowNumber: number; data: unknown },
    tx: ImportRunContext["prisma"] | Prisma.TransactionClient,
  ) => {
    try {
      await definition.persist(rowEntry.data as never, { ...ctx, tx })
      successCount += 1
    } catch (err) {
      persistErrors.push({
        row: rowEntry.rowNumber,
        field: "__row__",
        message: err instanceof Error ? err.message : "Failed to persist row",
      })
    }
  }

  if (definition.persistInTransaction) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const r of toPersist) await persistOne(r, tx)
        if (persistErrors.length > 0) {
          throw new Error(
            `Aborting transactional import: ${persistErrors.length} row(s) failed`,
          )
        }
      })
    } catch (err) {
      // Mark every "successful" row as failed since the transaction rolled back.
      successCount = 0
      if (persistErrors.length === 0) {
        persistErrors.push({
          row: 1,
          field: "__row__",
          message: err instanceof Error ? err.message : "Transaction failed",
        })
      }
    }
  } else {
    for (const r of toPersist) await persistOne(r, prisma)
  }

  const allErrors = [...perRowErrors, ...persistErrors]
  const totalFailed = parsed.rows.length - successCount
  const status: BulkImportStatus =
    successCount === 0
      ? "FAILED"
      : totalFailed === 0
        ? "COMPLETED"
        : "PARTIALLY_COMPLETED"

  await prisma.bulkImportJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: new Date(),
      successRows: successCount,
      failedRows: totalFailed,
      processedRows: parsed.rows.length,
      errorRows: allErrors as unknown as Prisma.InputJsonValue,
    },
  })

  return {
    totalRows: parsed.rows.length,
    successRows: successCount,
    failedRows: totalFailed,
    errors: allErrors,
    status,
  }
}
