import { NextResponse } from "next/server"
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { createDraft, DraftError, parseImportFile } from "@/lib/imports/drafts"
import { deriveManagerScope } from "@/lib/access/scope"

/**
 * POST /api/imports/:module/draft?sub=<subModule>
 *
 * Multipart file upload OR JSON `{ rows, headers, fileName }`. Creates a
 * DRAFT BulkImportJob + its rows, runs initial validation, returns the
 * draft id. 409 with `{ existingDraftId }` when the user already has a
 * draft for this (module, subModule).
 */
export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()
  const { module } = await params
  const subModule = new URL(request.url).searchParams.get("sub") ?? undefined

  const ct = request.headers.get("content-type") || ""
  let parsed
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return badRequest("file is required")
    const buffer = await file.arrayBuffer()
    parsed = await parseImportFile(buffer, file.name)
  } else {
    const body = (await request.json().catch(() => null)) as
      | { rows?: Array<Record<string, unknown>>; headers?: string[]; fileName?: string }
      | null
    if (!body?.rows || !Array.isArray(body.rows) || !body.headers) {
      return badRequest("rows[] and headers[] required")
    }
    // Coerce loose JSON cells to the ParsedSheet primitive shape.
    const coercedRows = body.rows.map((row) => {
      const out: Record<string, string | number | boolean | null> = {}
      for (const [k, v] of Object.entries(row)) {
        if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          out[k] = v
        } else {
          out[k] = v === undefined ? null : String(v)
        }
      }
      return out
    })
    parsed = { rows: coercedRows, headers: body.headers, fileName: body.fileName }
  }

  const userId = session.user?.id
  if (!userId) return unauthorized()
  const scope = {
    module,
    subModule,
    actorUserId: userId,
    scope: deriveManagerScope(session) ?? {},
  }

  try {
    const result = await createDraft({ scope, parsed })
    return ok(result, 201)
  } catch (err) {
    if (err instanceof DraftError) {
      if (err.code === "CONFLICT") {
        return NextResponse.json(
          { success: false, message: err.message, code: "CONFLICT", data: err.payload },
          { status: 409 },
        )
      }
      if (err.code === "INVALID_HEADERS" || err.code === "TOO_LARGE" || err.code === "NOT_FOUND") {
        return badRequest(err.message)
      }
    }
    throw err
  }
}
