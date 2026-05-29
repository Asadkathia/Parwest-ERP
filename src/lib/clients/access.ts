import type { Session } from "next-auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

/**
 * Shared regional-scope guard for client `[id]/*` routes.
 *
 * Loads the client's region/office and compares it against the actor's manager
 * scope. Returns:
 *   - `null`         — caller is unrestricted, or the client is within scope
 *   - `"not_found"`  — the client does not exist
 *   - `"forbidden"`  — the client exists but is outside the caller's scope
 *
 * Call sites map the result to their own response helpers, e.g.:
 *   const scope = await checkClientScope(clientId, session)
 *   if (scope === "not_found") return notFound("Client not found.")
 *   if (scope === "forbidden") return forbidden("Access denied.")
 *
 * This is the single source of truth for "is this client within the caller's
 * region?" — do not re-implement the fetch + managerScopeDenied per route.
 */
export async function checkClientScope(
  clientId: string,
  session: Session
): Promise<null | "not_found" | "forbidden"> {
  const managerScope = deriveManagerScope(session)
  if (!managerScope) return null
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { regionId: true, regionalOfficeId: true },
  })
  if (!client) return "not_found"
  if (managerScopeDenied(managerScope, { regionId: client.regionId, regionalOfficeId: client.regionalOfficeId })) {
    return "forbidden"
  }
  return null
}
