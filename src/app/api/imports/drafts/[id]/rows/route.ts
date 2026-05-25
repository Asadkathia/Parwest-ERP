import { badRequest, forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { bulkPatchDraftRows, getOwnedDraft } from "@/lib/imports/drafts"
import { deriveManagerScope } from "@/lib/access/scope"

/**
 * GET /api/imports/drafts/:id/rows?cursor=<rowNumber>&take=<n>
 *
 * Paginated row list keyed by rowNumber. Returns up to 500 rows per page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()
  const { id } = await params
  const userId = session.user?.id
  if (!userId) return unauthorized()
  const job = await getOwnedDraft(id, userId)
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

/**
 * PATCH /api/imports/drafts/:id/rows
 * Body: { data: Record<string, unknown> } — merged into EVERY row, then all
 * rows are revalidated. Backs the editor's "set for all rows" bulk control.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { id } = await params
  const userId = session.user?.id
  if (!userId) return unauthorized()
  const owned = await getOwnedDraft(id, userId)
  if (!owned) return notFound("Draft not found")

  const body = (await request.json().catch(() => null)) as { data?: Record<string, unknown> } | null
  if (!body?.data || typeof body.data !== "object") return badRequest("data {} required")

  const result = await bulkPatchDraftRows({
    jobId: id,
    data: body.data,
    scope: {
      module: owned.module,
      subModule: owned.subModule ?? undefined,
      actorUserId: userId,
      scope: deriveManagerScope(session) ?? {},
    },
  })
  return ok(result)
}
