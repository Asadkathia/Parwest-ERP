import { forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { getOwnedDraft } from "@/lib/imports/drafts"

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
