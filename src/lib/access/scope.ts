import type { Session } from "next-auth"
import { isSuperAdmin } from "@/lib/api/permissions"

export type ManagerScope = {
  role: string
  regionId: string | null
  regionalOfficeIds: string[]
}

export type ScopedQueryFilters = {
  regionId?: string | null
  regionalOfficeId?: string | null
}

type SessionUserLike = {
  role?: string
  roleScopeType?: "GLOBAL" | "REGIONAL"
  regionId?: string | null
  regionalOfficeId?: string | null
  permissions?: string[]
}

function getUser(session: Session | null): SessionUserLike | undefined {
  return session?.user as SessionUserLike | undefined
}

/**
 * Return a regional scope for this session, or null if the user should see
 * all regions. A user is regionally scoped when:
 *   - they are NOT a SuperAdmin (per isSuperAdmin — "Super User" role, or
 *     "Admin" with no explicit permissions), AND
 *   - their role's scopeType is REGIONAL.
 *
 * The regionId / regionalOfficeId are read from the session and, in the
 * well-formed case, are guaranteed to be set for REGIONAL users (the API
 * layer rejects user creations/updates that violate this invariant).
 */
export function deriveRegionalScope(session: Session | null): ManagerScope | null {
  if (isSuperAdmin(session)) return null

  const user = getUser(session)
  if (!user) return null

  if (user.roleScopeType !== "REGIONAL") return null

  const regionId = typeof user.regionId === "string" ? user.regionId : null
  const regionalOfficeId =
    typeof user.regionalOfficeId === "string" ? user.regionalOfficeId : null

  // REGIONAL users without a regionId should never happen (API-enforced),
  // but if we hit one (pre-migration data, direct DB edit, etc.), fail safe
  // by scoping them to an impossible region so they see nothing — better
  // than silently leaking cross-region data.
  if (!regionId && !regionalOfficeId) {
    return {
      role: user.role ?? "",
      regionId: "__missing__",
      regionalOfficeIds: [],
    }
  }

  return {
    role: user.role ?? "",
    regionId,
    regionalOfficeIds: regionalOfficeId ? [regionalOfficeId] : [],
  }
}

/**
 * Back-compat alias. Existing call sites (~190 endpoints) still import
 * `deriveManagerScope` — redirect them to the new regional scope logic so
 * the entire system picks up the fix without touching each endpoint.
 */
export const deriveManagerScope = deriveRegionalScope

export function applyManagerScope<T>(
  rows: T[],
  scope: ManagerScope | null,
  getters: {
    regionId?: (row: T) => string | null | undefined
    regionalOfficeId?: (row: T) => string | null | undefined
  }
) {
  if (!scope) return rows
  return rows.filter((row) => {
    const rowRegion = getters.regionId?.(row) || null
    const rowOffice = getters.regionalOfficeId?.(row) || null

    const regionPass = scope.regionId ? rowRegion === scope.regionId : true
    const officePass = scope.regionalOfficeIds.length > 0 ? scope.regionalOfficeIds.includes(rowOffice || "") : true

    return regionPass && officePass
  })
}

export function buildManagerScopeWhere(
  scope: ManagerScope | null,
  keys: {
    regionId?: string
    regionalOfficeId?: string
  }
) {
  if (!scope) return {}

  const where: Record<string, string | { in: string[] }> = {}
  if (keys.regionId && scope.regionId) where[keys.regionId] = scope.regionId
  if (keys.regionalOfficeId && scope.regionalOfficeIds.length > 0) {
    where[keys.regionalOfficeId] = scope.regionalOfficeIds.length === 1
      ? scope.regionalOfficeIds[0]
      : { in: scope.regionalOfficeIds }
  }
  return where
}

export function managerScopeDenied(
  scope: ManagerScope | null,
  values: ScopedQueryFilters
) {
  if (!scope) return false

  if (scope.regionId && values.regionId && values.regionId !== scope.regionId) return true
  if (
    scope.regionalOfficeIds.length > 0 &&
    values.regionalOfficeId &&
    !scope.regionalOfficeIds.includes(values.regionalOfficeId)
  ) {
    return true
  }
  return false
}
