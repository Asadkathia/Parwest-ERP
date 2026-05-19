import { NextResponse } from "next/server"
import { forbidden, notFound, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { finalizeDraft, getOwnedDraft, DraftError } from "@/lib/imports/drafts"
import { deriveManagerScope } from "@/lib/access/scope"

/**
 * POST /api/imports/drafts/:id/finalize — promote draft to live job + persist.
 * 422 with `{ errorRowCount }` when validation errors still remain.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { id } = await params
  const userId = session.user?.id
  if (!userId) return unauthorized()
  const owned = await getOwnedDraft(id, userId)
  if (!owned) return notFound("Draft not found")

  try {
    const result = await finalizeDraft({
      jobId: id,
      scope: {
        module: owned.module,
        subModule: owned.subModule ?? undefined,
        actorUserId: userId,
        scope: deriveManagerScope(session) ?? {},
      },
    })
    return ok(result)
  } catch (err) {
    if (err instanceof DraftError) {
      if (err.code === "VALIDATION_FAILED") {
        return NextResponse.json(
          { success: false, message: err.message, code: "VALIDATION_FAILED", data: err.payload },
          { status: 422 },
        )
      }
      if (err.code === "NOT_FOUND") return notFound(err.message)
    }
    throw err
  }
}
