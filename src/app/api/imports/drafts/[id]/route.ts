import { forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { deleteDraft, getOwnedDraft, DraftError } from "@/lib/imports/drafts"

/**
 * GET /api/imports/drafts/:id
 *   → { job, totals: { valid, skipped, errored, total } }
 * 404 (not 403) when not owner or not found.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()
  const { id } = await params
  const userId = session.user?.id
  if (!userId) return unauthorized()
  const job = await getOwnedDraft(id, userId)
  if (!job) return notFound("Draft not found")
  const rows = await prisma.bulkImportJobRow.findMany({
    where: { jobId: id },
    select: { rowNumber: true, errors: true, skipped: true },
  })
  let valid = 0,
    errored = 0,
    skipped = 0
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
  const userId = session.user?.id
  if (!userId) return unauthorized()
  try {
    await deleteDraft(id, userId)
    return ok({ deleted: true })
  } catch (err) {
    if (err instanceof DraftError && err.code === "NOT_FOUND") return notFound("Draft not found")
    throw err
  }
}
