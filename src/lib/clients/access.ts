import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, type ManagerScope } from "@/lib/access/scope"

/**
 * Region-less clients (B1): a client is visible to a regional manager when it has
 * a BRANCH in that manager's region/office, OR it is a *branchless* client whose
 * own region/office matches (branchless clients keep a region since they have no
 * branches to scope by — see the client create form). This is the single source
 * of truth for "which clients can this manager see?" — branchful clients scope by
 * their branches, branchless by their own `regionId`/`regionalOfficeId`.
 *
 * Returns a Prisma `where` fragment; `{}` for an unrestricted (SuperAdmin) scope.
 */
export function clientScopeWhere(scope: ManagerScope | null): Prisma.ClientWhereInput {
  if (!scope) return {}

  // Office scope is the more specific filter; prefer it when present.
  if (scope.regionalOfficeIds.length > 0) {
    const officeMatch =
      scope.regionalOfficeIds.length === 1
        ? scope.regionalOfficeIds[0]
        : { in: scope.regionalOfficeIds }
    return {
      OR: [
        { branches: { some: { regionalOfficeId: officeMatch } } },
        { isBranchless: true, regionalOfficeId: officeMatch },
      ],
    }
  }

  if (scope.regionId) {
    return {
      OR: [
        { branches: { some: { regionalOffice: { regionId: scope.regionId } } } },
        { isBranchless: true, regionId: scope.regionId },
      ],
    }
  }

  // Restricted scope with neither key resolvable → see nothing (fail closed).
  return { id: "__no_client_matches__" }
}

/** True when the given client is within the scope (or scope is unrestricted). */
export async function clientInScope(
  clientId: string,
  scope: ManagerScope | null
): Promise<boolean> {
  if (!scope) return true
  const n = await prisma.client.count({ where: { id: clientId, ...clientScopeWhere(scope) } })
  return n > 0
}

/**
 * Shared regional-scope guard for client `[id]/*` routes. Returns:
 *   - `null`         — caller is unrestricted, or the client is within scope
 *   - `"not_found"`  — the client does not exist
 *   - `"forbidden"`  — the client exists but is outside the caller's scope
 *
 * Branch-aware: scoping follows the client's branches (or its own region when
 * branchless). Do not re-implement the fetch + scope check per route.
 */
export async function checkClientScope(
  clientId: string,
  session: Session
): Promise<null | "not_found" | "forbidden"> {
  const scope = deriveManagerScope(session)
  if (!scope) return null
  const exists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })
  if (!exists) return "not_found"
  return (await clientInScope(clientId, scope)) ? null : "forbidden"
}
