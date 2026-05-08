import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope } from "@/lib/access/scope"
import { processImportRequest, readImportPayload } from "@/lib/imports/workflow"

/**
 * POST /api/imports/[module]/process
 * POST /api/imports/[module]/process?sub=loans
 *
 * Validate + persist. Header mismatch is still a hard-stop (400). All
 * other errors are collected per-row and returned as part of the job
 * record; the engine writes a durable `BulkImportJob` for audit.
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
    const result = await processImportRequest({
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

    return ok({ jobId: result.ok ? result.jobId : null, ...result.ok ? result.result : {} }, 202)
  } catch (error) {
    console.error("Error processing import:", error)
    return internalServerError("Failed to process import file")
  }
}
