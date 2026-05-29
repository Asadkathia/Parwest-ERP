import type { Session } from "next-auth"
import { prisma } from "@/lib/db"
import { forbidden, notFound } from "@/lib/api/response"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

/**
 * Shared regional-scope guard for guard `[id]/*` routes.
 *
 * Fetches the guard's region/office and rejects the request when the actor's
 * manager scope does not cover it. Returns a Response to short-circuit with
 * (404 if the guard does not exist, 403 if out of scope), or `null` when the
 * guard is in scope and the handler may continue.
 *
 * Usage at the top of a guard `[id]/*` mutation handler (after auth + hasAction):
 *   const denied = await requireGuardInScope(session, guardId)
 *   if (denied) return denied
 *
 * This is the single source of truth for "is this guard within the caller's
 * region?" — do not re-implement the fetch + managerScopeDenied per route.
 */
export async function requireGuardInScope(
  session: Session | null,
  guardId: string
): Promise<Response | null> {
  const guard = await prisma.guard.findUnique({
    where: { id: guardId },
    select: { id: true, regionId: true, regionalOfficeId: true },
  })
  if (!guard) return notFound("Guard not found")

  const scope = deriveManagerScope(session)
  if (
    managerScopeDenied(scope, {
      regionId: guard.regionId,
      regionalOfficeId: guard.regionalOfficeId,
    })
  ) {
    return forbidden("Forbidden: guard is outside your scope.")
  }

  return null
}
