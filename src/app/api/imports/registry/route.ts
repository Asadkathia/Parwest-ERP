import { forbidden, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { listImports } from "@/lib/imports/workflow"

/**
 * GET /api/imports/registry?module=guards
 *
 * Lists every registered (module, subModule) pair so the UI can render
 * a sub-import picker.
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()

  const moduleFilter = new URL(request.url).searchParams.get("module") || undefined
  return ok(listImports(moduleFilter))
}
