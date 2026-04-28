"use client"

import * as React from "react"

export type Region = { id: string; name: string }

// Module-level cache shared across all consumers in the client bundle so we
// don't refetch on every navigation/component mount. Once a successful fetch
// completes, subsequent hook mounts read from this cache synchronously.
let cachedRegions: Region[] | null = null
let inflight: Promise<Region[]> | null = null
const subscribers = new Set<(regions: Region[]) => void>()

async function fetchRegions(): Promise<Region[]> {
  if (cachedRegions) return cachedRegions
  if (inflight) return inflight

  inflight = (async () => {
    const res = await fetch("/api/regions", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
    if (!res.ok) {
      throw new Error(`Failed to load regions (HTTP ${res.status})`)
    }
    const payload: unknown = await res.json()
    // The endpoint returns a raw array — NOT the api envelope. Be defensive
    // in case a future change wraps it.
    const list: Region[] = Array.isArray(payload)
      ? (payload as Array<{ id: string; name: string }>).map((r) => ({
          id: String(r.id),
          name: String(r.name),
        }))
      : []
    cachedRegions = list
    subscribers.forEach((cb) => cb(list))
    return list
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export interface UseRegionsResult {
  regions: Region[]
  loading: boolean
  error: string | null
}

/**
 * Fetches the list of regions visible to the current user via `/api/regions`.
 * Result is cached at module scope so re-mounts (e.g. route navigation) do not
 * refetch. Regional users still only receive their assigned region thanks to
 * server-side scope filtering.
 */
export function useRegions(): UseRegionsResult {
  const [regions, setRegions] = React.useState<Region[]>(
    () => cachedRegions ?? []
  )
  const [loading, setLoading] = React.useState<boolean>(() => cachedRegions === null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    if (cachedRegions) {
      setRegions(cachedRegions)
      setLoading(false)
      return
    }

    const onUpdate = (next: Region[]) => {
      if (cancelled) return
      setRegions(next)
    }
    subscribers.add(onUpdate)

    setLoading(true)
    fetchRegions()
      .then((list) => {
        if (cancelled) return
        setRegions(list)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load regions")
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
      subscribers.delete(onUpdate)
    }
  }, [])

  return { regions, loading, error }
}

export default useRegions
