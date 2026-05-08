import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope } from "@/lib/access/scope"
import { readImportPayload, validateImportRequest } from "@/lib/imports/workflow"

/**
 * POST /api/imports/[module]/validate
 * POST /api/imports/[module]/validate?sub=loans
 *
 * Dry-run validation. Returns row-level errors without persisting.
 * Header mismatch is a hard-stop returning 400 with the missing/unknown
 * header diff — the UI surfaces this as a banner.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()

    const { module } = await params
    const subModule = new URL(request.url).searchParams.get("sub") || undefined

    const payload = await readImportPayload(request)
    if (!payload.rows.length) {
      return badRequest("No import rows supplied. Provide JSON rows[] or multipart file.")
    }

    const scope = deriveManagerScope(session)
    const result = await validateImportRequest({
      module,
      subModule,
      payload,
      actorUserId: session.user?.id ?? null,
      scope: { regionId: scope?.regionId, regionalOfficeIds: scope?.regionalOfficeIds },
    })

    if (!result.ok) {
      if (result.reason === "unknown-module") {
        return badRequest(
          `Unsupported import '${module}${subModule ? `::${subModule}` : ""}'. Check the registry.`,
        )
      }
      if (result.reason === "header-mismatch") {
        const d = result.details as { missing?: string[]; unknown?: string[] } | undefined
        const parts: string[] = []
        if (d?.missing?.length) parts.push(`missing: ${d.missing.join(", ")}`)
        if (d?.unknown?.length) parts.push(`unknown: ${d.unknown.join(", ")}`)
        return badRequest(`Header mismatch — ${parts.join(" | ") || "headers do not match the template"}`)
      }
    }

    return ok({ jobId: result.ok ? result.jobId : null, ...result.ok ? result.result : {} })
  } catch (error) {
    console.error("Error validating import:", error)
    return internalServerError("Failed to validate import file")
  }
}
