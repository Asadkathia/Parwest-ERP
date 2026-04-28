"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Globe, MapPin } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import { Badge } from "@/components/shadcn/badge"
import { Skeleton } from "@/components/shadcn/skeleton"
import { cn } from "@/lib/utils"

export interface Region {
  id: string
  name: string
}

export interface RegionSelectorProps {
  /** List of available regions to choose from. */
  regions: Region[]
  /** Current selection: `null` means "Global (all regions)". */
  value: string | null
  /** Selection callback. Receives `null` for the Global sentinel. */
  onChange: (regionId: string | null) => void
  /**
   * Auto-detected from the session, but can be overridden for storybook /
   * preview pages that need to demo all visual states without a real session.
   */
  forceMode?: "global" | "regional"
  /** Optional className applied to the trigger / badge wrapper. */
  className?: string
}

type SessionUser = {
  role?: string
  permissions?: string[]
  regionId?: string | null
} | undefined

const GLOBAL_VALUE = "__global__"

function isSessionSuperAdmin(user: SessionUser): boolean {
  if (!user) return false
  if (user.role === "Super User") return true
  return user.role === "Admin" && (user.permissions?.length ?? 0) === 0
}

/**
 * Region selector for the v1.1 design system.
 *
 * - SuperAdmin-style sessions get a `Select` with a "Global" sentinel option.
 * - Regional users get a read-only `Badge` showing their locked region.
 *
 * NOTE: this is a *new* primitive — the legacy
 * `src/components/payroll/PayrollRegionGate.tsx` is intentionally untouched
 * and continues to expose its `{ locked, superAdmin }` callback signature
 * until the Phase 5 module migration.
 */
export function RegionSelector({
  regions,
  value,
  onChange,
  forceMode,
  className,
}: RegionSelectorProps) {
  const { data: session, status } = useSession()

  // Hydration guard: the selector renders different markup (Select vs Badge
  // vs Skeleton) depending on session status. If the client's first render
  // sees an already-resolved session while the server rendered the Skeleton,
  // the Radix `useId` counter advances differently and every later trigger
  // (theme/notifications/user) gets a mismatched id. Render the Skeleton on
  // the server *and* on the first client commit, then swap once mounted.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Loading skeleton — also covers the pre-mount client commit.
  if (!forceMode && (!mounted || status === "loading")) {
    return (
      <Skeleton
        className={cn("h-9 min-w-[180px] rounded-md", className)}
        aria-label="Loading region selector"
      />
    )
  }

  const sessionUser = session?.user as SessionUser
  const detectedMode: "global" | "regional" = forceMode
    ? forceMode
    : isSessionSuperAdmin(sessionUser)
      ? "global"
      : "regional"

  if (detectedMode === "regional") {
    // Read-only — derive the locked region name from props or session.
    const lockedId =
      value ?? (sessionUser?.regionId ? String(sessionUser.regionId) : null)
    const lockedRegion = regions.find((r) => r.id === lockedId)
    const label = lockedRegion?.name ?? "Region locked"

    return (
      <Badge
        variant="secondary"
        className={cn(
          "min-w-[180px] justify-start gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
          className
        )}
        aria-label={`Region locked to ${label}`}
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate">{label}</span>
      </Badge>
    )
  }

  // Global mode — Select with a Global sentinel.
  const selectValue = value === null ? GLOBAL_VALUE : value
  const isGlobal = value === null

  return (
    <Select
      value={selectValue}
      onValueChange={(next) => {
        onChange(next === GLOBAL_VALUE ? null : next)
      }}
    >
      <SelectTrigger
        className={cn("min-w-[180px] gap-2", className)}
        aria-label="Select region scope"
      >
        <span className="flex items-center gap-2">
          {isGlobal ? (
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-[var(--brand-600,theme(colors.blue.700))]"
            />
          ) : (
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          )}
          <SelectValue placeholder="Select region" />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GLOBAL_VALUE}>
          <span className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" aria-hidden />
            Global
          </span>
        </SelectItem>
        {regions.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            <span className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {r.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default RegionSelector
