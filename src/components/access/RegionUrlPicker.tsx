"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition } from "react"
import { Lock } from "lucide-react"
import { GLOBAL_REGION_VALUE } from "./region-sentinels"

type RegionOption = { id: string; name: string }

/**
 * Region picker that drives a `regionId` URL query param. Used on list pages
 * that gate their data fetch on a selected region. When `locked` is true the
 * dropdown is disabled and shows a lock icon — used for regional users whose
 * scope is fixed to their assigned region.
 */
export default function RegionUrlPicker({
    regions,
    locked = false,
    paramName = "regionId",
    label = "Region",
    includeGlobalOption = false,
}: {
    regions: RegionOption[]
    locked?: boolean
    paramName?: string
    label?: string
    /** When true, prepend a "Global" option that filters to users with no region. */
    includeGlobalOption?: boolean
}) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const current = searchParams.get(paramName) ?? ""

    const handleChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) params.set(paramName, value)
        else params.delete(paramName)
        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`)
        })
    }

    return (
        <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                {label} {locked && <Lock className="h-3.5 w-3.5" />}
            </label>
            <select
                className="ui-select disabled:opacity-60"
                value={current}
                disabled={locked || isPending}
                onChange={(e) => handleChange(e.target.value)}
            >
                <option value="">-- Select {label} --</option>
                {includeGlobalOption && (
                    <option value={GLOBAL_REGION_VALUE}>Global</option>
                )}
                {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                ))}
            </select>
            {locked && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">Locked to your assigned region.</p>
            )}
        </div>
    )
}
