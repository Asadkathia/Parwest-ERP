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

function payloadDuplicates(
  definition: BulkImportDefinition,
  rows: Array<Record<string, unknown>>,
): ImportRowError[] {
  const errors: ImportRowError[] = []
  for (const rule of definition.duplicates ?? []) {
    if (rule.scope !== "payload" && rule.scope !== "both") continue
    const seen = new Map<string, number>()
    rows.forEach((row, idx) => {
      const composite = rule.fields.map((f) => cellToString(row[f]).toLowerCase()).join("||")
      if (!composite || composite === rule.fields.map(() => "").join("||")) return
      const firstSeen = seen.get(composite)
      if (firstSeen !== undefined) {
        errors.push({
          row: idx + 2,
          field: rule.fields.join("+"),
          message:
            rule.message ??
            `Duplicate of row ${firstSeen + 2} on (${rule.fields.join(", ")})`,
          values: row,
        })
      } else {
        seen.set(composite, idx)
      }
    })
  }
  return errors
}

async function dbDuplicates(
  definition: BulkImportDefinition,
  rows: Array<Record<string, unknown>>,
  ctx: ImportRunContext,
): Promise<ImportRowError[]> {
  const errors: ImportRowError[] = []
  for (const rule of definition.duplicates ?? []) {
    if (rule.scope !== "db" && rule.scope !== "both") continue
    if (!rule.existsInDb) continue
    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx]
      const values: Record<string, string> = {}
      let hasAny = false
      for (const f of rule.fields) {
        const v = cellToString(row[f])
        if (v) hasAny = true
        values[f] = v
      }
      if (!hasAny) continue
      const exists = await rule.existsInDb(values, ctx)
      if (exists) {
        errors.push({
          row: idx + 2,
          field: rule.fields.join("+"),
          message:
            rule.message ??
            `Already exists in the database (${rule.fields.join(", ")} = ${rule.fields.map((f) => values[f]).join(", ")})`,
          values: row,
        })
      }
    }
  }
  return errors
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
    const refResult = await resolveReferences(definition, original, ctx, rowNumber)
    const conditionalErrors = applyConditionals(definition, refResult.row, rowNumber)
    const earlyErrors = [...refResult.errors, ...conditionalErrors]
    if (earlyErrors.length > 0) {
      perRowErrors.push(...earlyErrors)
      continue
    }
    const parsedRow = definition.rowSchema.safeParse(refResult.row)
    if (!parsedRow.success) {
      for (const issue of (parsedRow.error as z.ZodError).issues) {
        perRowErrors.push({
          row: rowNumber,
          field: issue.path.join(".") || "__row__",
          message: issue.message,
          values: original,
        })
      }
      continue
    }
    validRows.push({ rowNumber, data: parsedRow.data })
  }

  // Cross-row duplicates (payload-scoped, then DB-scoped)
  perRowErrors.push(...payloadDuplicates(definition, parsed.rows))
  perRowErrors.push(...(await dbDuplicates(definition, parsed.rows, ctx)))

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
