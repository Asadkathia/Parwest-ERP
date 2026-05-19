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

// Re-export so callers don't need to import from excel.ts directly.
export { parseImportFile }
export type { ParsedSheet }

const DRAFT_TTL_DAYS = 7
const MAX_DRAFT_ROWS = 5000 // hard cap per spec § 13

export class DraftError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "TOO_LARGE"
      | "INVALID_HEADERS"
      | "VALIDATION_FAILED"
      | "PERSIST_FAILED",
    public payload?: unknown,
  ) {
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

/** Create a new draft from a parsed sheet. Throws CONFLICT if the user
 *  already has a draft for (module, subModule). Header validation hard-stops. */
export async function createDraft(opts: {
  scope: DraftScope
  parsed: ParsedSheet
}): Promise<{ draftId: string }> {
  const definition = getImportDefinition(opts.scope.module, opts.scope.subModule)
  if (!definition)
    throw new DraftError(
      `Unknown import: ${opts.scope.module}/${opts.scope.subModule ?? ""}`,
      "NOT_FOUND",
    )
  if (opts.parsed.rows.length > MAX_DRAFT_ROWS) {
    throw new DraftError(`Draft exceeds row limit of ${MAX_DRAFT_ROWS}`, "TOO_LARGE")
  }
  const headerCheck = validateHeaders(definition, opts.parsed.headers)
  if (!headerCheck.valid) {
    throw new DraftError("Invalid headers", "INVALID_HEADERS", headerCheck)
  }

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

  await prisma.bulkImportJobRow.createMany({
    data: opts.parsed.rows.map((data, i) => ({
      jobId: job.id,
      rowNumber: i + 2,
      data: data as Prisma.InputJsonValue,
    })),
  })

  await revalidateAllRows(job.id, definition, opts.scope)
  return { draftId: job.id }
}

/** Ownership-aware loader. Returns null when missing or not owned —
 *  routes translate this to 404 (no 403 to avoid existence-leak). */
export async function getOwnedDraft(
  jobId: string,
  actorUserId: string,
): Promise<BulkImportJob | null> {
  const job = await prisma.bulkImportJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== "DRAFT") return null
  if (job.createdById !== actorUserId) return null
  return job
}

/** Re-validate every row in the draft and persist updated errors columns. */
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
    const result = await validateRow(
      definition,
      r.data as Record<string, unknown>,
      ctx,
      r.rowNumber,
    )
    perRowErrors.set(r.rowNumber, result.errors)
  }
  const view = rows.map((r) => ({
    rowNumber: r.rowNumber,
    data: r.data as Record<string, unknown>,
    skipped: r.skipped,
  }))
  const dupMap = recomputePayloadDuplicates(definition, view)
  for (const [rowNumber, errs] of dupMap) {
    const existing = perRowErrors.get(rowNumber) ?? []
    perRowErrors.set(rowNumber, [...existing, ...errs])
  }
  await prisma.$transaction(
    rows.map((r) =>
      prisma.bulkImportJobRow.update({
        where: { id: r.id },
        data: {
          errors: (perRowErrors.get(r.rowNumber) ?? []) as unknown as Prisma.InputJsonValue,
          dirty: false,
        },
      }),
    ),
  )
}

/** Edit one row. Returns the edited row plus any sibling rows whose
 *  error list changed (client repaints a small set). */
export async function patchDraftRow(opts: {
  jobId: string
  rowNumber: number
  data: Record<string, unknown>
  scope: DraftScope
}): Promise<{
  row: BulkImportJobRow
  affectedRows: Array<{ rowNumber: number; errors: ImportRowError[] }>
}> {
  const definition = await loadDefinitionForJob(opts.jobId)
  return prisma.$transaction(async (tx) => {
    const target = await tx.bulkImportJobRow.findUnique({
      where: { jobId_rowNumber: { jobId: opts.jobId, rowNumber: opts.rowNumber } },
    })
    if (!target) throw new DraftError("Row not found", "NOT_FOUND")
    const mergedData = { ...(target.data as Record<string, unknown>), ...opts.data }

    const ctx = buildCtx(opts.jobId, opts.scope)
    const result = await validateRow(definition, mergedData, ctx, opts.rowNumber)

    const allRows = await tx.bulkImportJobRow.findMany({ where: { jobId: opts.jobId } })
    const view = allRows.map((r) =>
      r.rowNumber === opts.rowNumber
        ? { rowNumber: r.rowNumber, data: mergedData, skipped: r.skipped }
        : { rowNumber: r.rowNumber, data: r.data as Record<string, unknown>, skipped: r.skipped },
    )
    const dupMap = recomputePayloadDuplicates(definition, view)

    const previousErrorsByRow = new Map<number, ImportRowError[]>(
      allRows.map((r) => [r.rowNumber, (r.errors as unknown as ImportRowError[]) ?? []]),
    )
    const nextErrorsByRow = new Map<number, ImportRowError[]>()
    for (const r of allRows) {
      const dupErrors = dupMap.get(r.rowNumber) ?? []
      if (r.rowNumber === opts.rowNumber) {
        nextErrorsByRow.set(r.rowNumber, [...result.errors, ...dupErrors])
      } else if (r.skipped) {
        nextErrorsByRow.set(r.rowNumber, [])
      } else {
        const ownErrors =
          previousErrorsByRow.get(r.rowNumber)?.filter((e) => !e.field.includes("+")) ?? []
        nextErrorsByRow.set(r.rowNumber, [...ownErrors, ...dupErrors])
      }
    }

    await tx.bulkImportJobRow.update({
      where: { id: target.id },
      data: {
        data: mergedData as Prisma.InputJsonValue,
        errors: (nextErrorsByRow.get(opts.rowNumber) ?? []) as unknown as Prisma.InputJsonValue,
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
          data: { errors: after as unknown as Prisma.InputJsonValue },
        })
        affected.push({ rowNumber: r.rowNumber, errors: after })
      }
    }

    const updatedRow = await tx.bulkImportJobRow.findUnique({ where: { id: target.id } })
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
}): Promise<{
  row: BulkImportJobRow
  affectedRows: Array<{ rowNumber: number; errors: ImportRowError[] }>
}> {
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
      const ownErrors = before.filter((e) => !e.field.includes("+"))
      const dupErrors = dupMap.get(r.rowNumber) ?? []
      const after = r.skipped ? [] : [...ownErrors, ...dupErrors]
      if (!errorsEqual(before, after)) {
        await tx.bulkImportJobRow.update({
          where: { id: r.id },
          data: { errors: after as unknown as Prisma.InputJsonValue },
        })
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
  const job = await prisma.$queryRaw<Array<BulkImportJob>>`
    SELECT * FROM "BulkImportJob" WHERE id = ${opts.jobId} FOR UPDATE
  `
  if (!job[0] || job[0].status !== "DRAFT") throw new DraftError("Not a draft", "NOT_FOUND")

  await revalidateAllRows(opts.jobId, definition, opts.scope)

  const rows = await prisma.bulkImportJobRow.findMany({
    where: { jobId: opts.jobId, skipped: false },
    orderBy: { rowNumber: "asc" },
  })
  const stillBroken = rows.filter(
    (r) => ((r.errors as unknown as ImportRowError[]) ?? []).length > 0,
  )
  if (stillBroken.length > 0) {
    throw new DraftError("Cannot finalize — errors remain", "VALIDATION_FAILED", {
      errorRowCount: stillBroken.length,
    })
  }

  const ctx = buildCtx(opts.jobId, opts.scope)
  let successCount = 0
  const persistErrors: ImportRowError[] = []
  const persistOne = async (
    row: BulkImportJobRow,
    txClient: Prisma.TransactionClient | typeof prisma,
  ) => {
    const result = await validateRow(
      definition,
      row.data as Record<string, unknown>,
      { ...ctx, prisma: txClient as never },
      row.rowNumber,
    )
    if (result.errors.length > 0 || !result.data) {
      persistErrors.push(...result.errors)
      return
    }
    try {
      await definition.persist(result.data as never, {
        ...ctx,
        prisma: txClient as never,
        tx: txClient as never,
      })
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
