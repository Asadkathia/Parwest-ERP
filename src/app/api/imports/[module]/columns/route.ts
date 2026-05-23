import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { getImportDefinition } from "@/lib/imports/registry"
import "@/lib/imports/definitions" // register all import definitions (serverless module graph)
import { deriveManagerScope } from "@/lib/access/scope"

/**
 * GET /api/imports/:module/columns?sub=<subModule>
 *
 * Returns column metadata used by the draft editor to pick cell editors.
 * FK loaders run server-side here — the response holds resolved option lists.
 */
export async function GET(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()
  const { module } = await params
  const subModule = new URL(request.url).searchParams.get("sub") ?? undefined
  const definition = getImportDefinition(module, subModule)
  if (!definition) return badRequest(`Unknown import: ${module}`)
  const userId = session.user?.id
  if (!userId) return unauthorized()
  const ctx = {
    prisma,
    jobId: "columns-endpoint",
    actorUserId: userId,
    scope: deriveManagerScope(session) ?? {},
    cache: new Map<string, unknown>(),
  }
  const columns = await Promise.all(
    (definition.columns ?? []).map(async (col) => ({
      key: col.key,
      header: col.header,
      label: col.label,
      kind: col.kind,
      required: col.required,
      enumValues: col.enumValues,
      fkOptions: col.fkOptionsLoader ? await col.fkOptionsLoader(ctx) : undefined,
    })),
  )
  return ok({ columns })
}
