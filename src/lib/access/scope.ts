import type { Session } from "next-auth"

export type ManagerScope = {
  role: string
  regionId: string | null
  regionalOfficeIds: string[]
}

export type ScopedQueryFilters = {
  regionId?: string | null
  regionalOfficeId?: string | null
}

export function isManagerRole(role: string | null | undefined) {
  const value = (role || "").toLowerCase()
  return value.includes("manager")
}

export function deriveManagerScope(session: Session | null): ManagerScope | null {
  const role = session?.user?.role || ""
  if (!isManagerRole(role)) return null

  const maybeRegionId = (session?.user as Record<string, unknown> | undefined)?.regionId
  const maybeOfficeId = (session?.user as Record<string, unknown> | undefined)?.regionalOfficeId

  return {
    role,
    regionId: typeof maybeRegionId === "string" ? maybeRegionId : null,
    regionalOfficeIds: typeof maybeOfficeId === "string" ? [maybeOfficeId] : [],
  }
}

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

  const where: Record<string, string> = {}
  if (keys.regionId && scope.regionId) where[keys.regionId] = scope.regionId
  if (keys.regionalOfficeId && scope.regionalOfficeIds.length > 0) {
    where[keys.regionalOfficeId] = scope.regionalOfficeIds[0]
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
