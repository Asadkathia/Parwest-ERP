"use client"

import { useSearchParams } from "next/navigation"
import { useMemo } from "react"

/**
 * Read region/regionalOffice URL params and return them as a query-string
 * suffix ready to append to v2 API requests. Returned values:
 *   - `params`:  empty URLSearchParams for SuperAdmin with no picker selection,
 *                otherwise contains `regionId` and/or `regionalOfficeId`.
 *   - `suffix`:  `&regionId=…` style — empty when no params.
 *   - `query`:   `?regionId=…` style for URLs without an existing query.
 *
 * Regional users have their scope enforced server-side from the session — this
 * hook is primarily for SuperAdmin to drive list filtering via the URL picker.
 */
export function useScopeQuery() {
  const searchParams = useSearchParams()

  return useMemo(() => {
    const regionId = searchParams.get("regionId")?.trim() || ""
    const regionalOfficeId = searchParams.get("regionalOfficeId")?.trim() || ""

    const params = new URLSearchParams()
    if (regionId && regionId !== "__GLOBAL__") params.set("regionId", regionId)
    if (regionalOfficeId) params.set("regionalOfficeId", regionalOfficeId)

    const queryString = params.toString()
    return {
      regionId: regionId || null,
      regionalOfficeId: regionalOfficeId || null,
      params,
      suffix: queryString ? `&${queryString}` : "",
      query: queryString ? `?${queryString}` : "",
    }
  }, [searchParams])
}
