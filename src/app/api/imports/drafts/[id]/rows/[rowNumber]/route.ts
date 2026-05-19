import { badRequest, forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { getOwnedDraft, patchDraftRow, DraftError } from "@/lib/imports/drafts"
import { deriveManagerScope } from "@/lib/access/scope"

/**
 * PATCH /api/imports/drafts/:id/rows/:rowNumber
 * Body: { data: Record<string, unknown> } — merged into row.data, then revalidated.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rowNumber: string }> },
) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { id, rowNumber } = await params
  const userId = session.user?.id
  if (!userId) return unauthorized()
  const owned = await getOwnedDraft(id, userId)
  if (!owned) return notFound("Draft not found")

  const body = (await request.json().catch(() => null)) as { data?: Record<string, unknown> } | null
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
        actorUserId: userId,
        scope: deriveManagerScope(session) ?? {},
      },
    })
    return ok(result)
  } catch (err) {
    if (err instanceof DraftError && err.code === "NOT_FOUND") return notFound(err.message)
    throw err
  }
}
