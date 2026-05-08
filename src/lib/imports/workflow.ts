/**
 * Bulk Imports — public surface.
 *
 * Thin shim over the registry-driven engine. Importing this file
 * registers all known definitions (via `./definitions`) and re-exports
 * the helpers the API routes need.
 *
 * Legacy callers that imported `validateImport` / `processImport` /
 * `getImportJob` / `toErrorCsv` from this module continue to work — the
 * implementations now delegate to the registry + Prisma-backed engine.
 */

import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

import "./definitions"
import { parseImportFile } from "./excel"
import { runImport, validateHeaders } from "./engine"
import { getImportDefinition, listImportSummaries } from "./registry"
import type { BulkImportSummary } from "./types"

export const IMPORT_MODULES = ["users", "guards", "clients", "inventory"] as const
export type ImportModule = (typeof IMPORT_MODULES)[number]

export type ImportPayload = {
  rows: Array<Record<string, unknown>>
  headers: string[]
  fileName?: string
}

export type ImportValidationError = {
  row: number
  field: string
  message: string
}

export type ImportValidationResult = {
  module: string
  subModule?: string
  headers: string[]
  totalRows: number
  validRows: number
  invalidRows: number
  valid: boolean
  errors: ImportValidationError[]
}

export type ImportJobRecord = {
  jobId: string
  module: string
  subModule?: string | null
  status: string
  createdAt: string
  updatedAt: string
  totalRows: number
  processedRows: number
  successRows: number
  failedRows: number
  errors: ImportValidationError[]
  validation: ImportValidationResult
}

/**
 * Reads an upload payload from a Request. Multipart files (.xlsx/.csv)
 * are parsed via exceljs; JSON bodies are accepted for the
 * legacy/test-harness path that posts pre-parsed `rows[]`.
 */
export async function readImportPayload(request: Request): Promise<ImportPayload> {
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return { rows: [], headers: [] }
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseImportFile(buffer, file.name)
    return parsed
  }

  const body = await request.json().catch(() => ({}))
  const rows = Array.isArray(body?.rows) ? (body.rows as Array<Record<string, unknown>>) : []
  const headers: string[] = Array.isArray(body?.headers)
    ? (body.headers as unknown[]).map((h) => String(h).trim()).filter(Boolean)
    : rows.length
      ? Object.keys(rows[0])
      : []
  return { rows, headers }
}

/**
 * Validate-only run. Creates a `BulkImportJob` row in DRY-RUN mode and
 * returns the validation summary. Use this for the UI pre-flight step.
 */
export async function validateImportRequest(opts: {
  module: string
  subModule?: string
  payload: ImportPayload
  actorUserId: string | null
  scope: { regionId?: string | null; regionalOfficeIds?: string[] | null }
}): Promise<
  | { ok: false; reason: "unknown-module" | "header-mismatch"; details?: unknown }
  | { ok: true; jobId: string; result: ReturnType<typeof toResult> }
> {
  const definition = getImportDefinition(opts.module, opts.subModule)
  if (!definition) return { ok: false, reason: "unknown-module" }

  // Header check is the hard-stop. Run it before creating the job row so
  // an obvious mismatch doesn't pollute the job history.
  const headerCheck = validateHeaders(definition, opts.payload.headers)
  if (!headerCheck.valid) {
    return { ok: false, reason: "header-mismatch", details: headerCheck }
  }

  const job = await prisma.bulkImportJob.create({
    data: {
      module: opts.module,
      subModule: opts.subModule ?? null,
      status: "QUEUED",
      headers: opts.payload.headers,
      totalRows: opts.payload.rows.length,
      fileName: opts.payload.fileName ?? null,
      createdById: opts.actorUserId,
    },
    select: { id: true },
  })

  const engineResult = await runImport(definition, {
    module: opts.module,
    subModule: opts.subModule,
    parsed: opts.payload,
    actorUserId: opts.actorUserId,
    scope: opts.scope,
    jobId: job.id,
    dryRun: true,
  })

  return { ok: true, jobId: job.id, result: toResult(engineResult, opts) }
}

/**
 * Validate + persist run. Creates a `BulkImportJob` row, runs the engine,
 * and returns the final status + counts.
 */
export async function processImportRequest(opts: {
  module: string
  subModule?: string
  payload: ImportPayload
  actorUserId: string | null
  scope: { regionId?: string | null; regionalOfficeIds?: string[] | null }
}): Promise<
  | { ok: false; reason: "unknown-module" | "header-mismatch"; details?: unknown }
  | { ok: true; jobId: string; result: ReturnType<typeof toResult> }
> {
  const definition = getImportDefinition(opts.module, opts.subModule)
  if (!definition) return { ok: false, reason: "unknown-module" }

  const headerCheck = validateHeaders(definition, opts.payload.headers)
  if (!headerCheck.valid) {
    return { ok: false, reason: "header-mismatch", details: headerCheck }
  }

  const job = await prisma.bulkImportJob.create({
    data: {
      module: opts.module,
      subModule: opts.subModule ?? null,
      status: "QUEUED",
      headers: opts.payload.headers,
      totalRows: opts.payload.rows.length,
      fileName: opts.payload.fileName ?? null,
      createdById: opts.actorUserId,
    },
    select: { id: true },
  })

  const engineResult = await runImport(definition, {
    module: opts.module,
    subModule: opts.subModule,
    parsed: opts.payload,
    actorUserId: opts.actorUserId,
    scope: opts.scope,
    jobId: job.id,
  })

  return { ok: true, jobId: job.id, result: toResult(engineResult, opts) }
}

function toResult(
  engineResult: Awaited<ReturnType<typeof runImport>>,
  opts: { module: string; subModule?: string; payload: ImportPayload },
): ImportValidationResult & { status: string; jobId?: string } {
  return {
    module: opts.module,
    subModule: opts.subModule,
    headers: opts.payload.headers,
    totalRows: engineResult.totalRows,
    validRows: engineResult.successRows,
    invalidRows: engineResult.failedRows,
    valid: engineResult.errors.length === 0,
    errors: engineResult.errors.map((e) => ({ row: e.row, field: e.field, message: e.message })),
    status: engineResult.status,
  }
}

/** Fetches a job by id. Returns null if missing. */
export async function getImportJob(jobId: string): Promise<ImportJobRecord | null> {
  const job = await prisma.bulkImportJob.findUnique({ where: { id: jobId } })
  if (!job) return null
  const errors = (job.errorRows as Prisma.JsonArray | null) ?? []
  const errorList = (Array.isArray(errors) ? errors : []) as unknown as ImportValidationError[]
  return {
    jobId: job.id,
    module: job.module,
    subModule: job.subModule,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successRows: job.successRows,
    failedRows: job.failedRows,
    errors: errorList,
    validation: {
      module: job.module,
      subModule: job.subModule ?? undefined,
      headers: job.headers,
      totalRows: job.totalRows,
      validRows: job.successRows,
      invalidRows: job.failedRows,
      valid: errorList.length === 0,
      errors: errorList,
    },
  }
}

/** Renders an error list as CSV — kept for the legacy `format=csv` route. */
export function toErrorCsv(errors: ImportValidationError[]): string {
  const header = "row,field,message"
  const lines = errors.map(
    (e) => `${e.row},${e.field},"${String(e.message).replaceAll('"', '""')}"`,
  )
  return [header, ...lines].join("\n")
}

/** Lists registered imports, optionally filtered by module. */
export function listImports(module?: string): BulkImportSummary[] {
  return listImportSummaries(module)
}
