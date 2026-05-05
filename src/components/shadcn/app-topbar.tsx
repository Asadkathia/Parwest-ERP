"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  Languages,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/shadcn/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar"
import { RegionSelector } from "@/components/shadcn/region-selector"
import { NotificationBell } from "@/components/shadcn/notification-bell"
import { useRegions } from "@/lib/hooks/useRegions"

// TODO: extract once Phase 2A nav-config lands at src/lib/navigation/items.ts
// Slug → display label map for breadcrumb segments. Keep in sync with the
// dashboard route folders under src/app/(dashboard)/.
const SLUG_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  guards: "Guards",
  guard: "Guard",
  clients: "Clients",
  client: "Client",
  payroll: "Payroll",
  "store-inventory": "Inventory",
  inventory: "Inventory (Legacy)",
  deployments: "Deployments",
  users: "Users",
  user: "User",
  tickets: "Tickets",
  reports: "Reports",
  settings: "Settings",
  audit: "Audit",
  imports: "Imports",
  bulkImport: "Bulk Import",
  requisitions: "Requisitions",
  "admin-approvals": "Admin Approvals",
}

function labelFor(slug: string): string {
  if (SLUG_LABELS[slug]) return SLUG_LABELS[slug]
  // Fallback: title-case the slug
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

type ThemeMode = "light" | "dark" | "system"
const THEME_STORAGE_KEY = "parwest:theme"

/**
 * ─── Canonical RTL pattern (Phase 8B pilot) ──────────────────────────
 *
 * The direction toggle below sets `document.documentElement.dir` to
 * `"ltr"` or `"rtl"` and persists the choice under `parwest:dir`. Tailwind
 * v4 reads the `dir` attribute natively, so `rtl:` / `ltr:` variants and
 * logical utilities (ms-/me-/ps-/pe-/start-/end-) work without a plugin.
 *
 * Rules for migrating screens to RTL-safe markup:
 *   1. Use logical properties everywhere — prefer `ms-*`/`me-*` over
 *      `ml-*`/`mr-*`, `ps-*`/`pe-*` over `pl-*`/`pr-*`, `start-*`/`end-*`
 *      over `left-*`/`right-*`, and `text-start`/`text-end` over
 *      `text-left`/`text-right`.
 *   2. Mirror directional iconography (chevrons, arrows, breadcrumb
 *      separators) with `rtl:rotate-180`.
 *   3. Always-LTR content (currency, IDs, phone numbers, CNIC, dates)
 *      must opt out via `dir="ltr"` on the wrapping element. Numeric
 *      cells should also keep `tabular-nums` for alignment.
 *   4. Don't introduce Urdu copy as part of an RTL pass — copy migration
 *      is a separate follow-up. Layout flip first, translation second.
 *   5. Test by toggling the Languages button in the topbar; the layout
 *      should mirror without any text-rendering glitches.
 *
 * The Guards LIST page (`src/app/(dashboard)/guards/page.tsx` +
 * `src/components/guards/GuardsListClient.tsx`) is the canonical
 * reference implementation for this pattern.
 */
type DirMode = "ltr" | "rtl"
const DIR_STORAGE_KEY = "parwest:dir"

function applyDir(mode: DirMode) {
  if (typeof document === "undefined") return
  document.documentElement.dir = mode
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (mode === "system") {
    delete root.dataset.theme
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
    root.dataset.theme = prefersDark ? "dark" : "light"
    // Mark as system-driven so we know to remove on next change
    root.dataset.themeSource = "system"
  } else {
    root.dataset.theme = mode
    root.dataset.themeSource = "user"
  }
}

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name || email || "").trim()
  if (!source) return "U"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export interface AppTopbarProps {
  /** Emitted by the hamburger; layout binds to sidebar collapse. */
  onSidebarToggle?: () => void
  className?: string
}

export function AppTopbar({
  onSidebarToggle,
  className,
}: AppTopbarProps): React.ReactElement {
  const pathname = usePathname() || "/"
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  // Build breadcrumb segments from the pathname
  const segments = React.useMemo(() => {
    const raw = pathname.split("/").filter(Boolean)
    return raw.map((slug, idx) => ({
      slug,
      href: "/" + raw.slice(0, idx + 1).join("/"),
      label: labelFor(slug),
      isLast: idx === raw.length - 1,
    }))
  }, [pathname])

  // ───── Theme toggle ─────
  const [themeMode, setThemeMode] = React.useState<ThemeMode>("system")

  // Mount: read stored preference and apply
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as
      | ThemeMode
      | null
    const initial: ThemeMode =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system"
    setThemeMode(initial)
    applyTheme(initial)
  }, [])

  // Live-react to OS theme changes when in System mode
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (themeMode !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener?.("change", handler)
    return () => {
      mq.removeEventListener?.("change", handler)
    }
  }, [themeMode])

  const setTheme = React.useCallback((mode: ThemeMode) => {
    setThemeMode(mode)
    applyTheme(mode)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    }
  }, [])

  // ───── Direction (RTL/LTR) toggle ─────
  // SSR-safe: state defaults to "ltr"; mount effect reads the stored
  // preference and applies it. Toggling cycles ltr → rtl → ltr.
  const [dirMode, setDirMode] = React.useState<DirMode>("ltr")

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(DIR_STORAGE_KEY) as
      | DirMode
      | null
    const initial: DirMode = stored === "rtl" || stored === "ltr" ? stored : "ltr"
    setDirMode(initial)
    applyDir(initial)
  }, [])

  const toggleDir = React.useCallback(() => {
    setDirMode((prev) => {
      const next: DirMode = prev === "ltr" ? "rtl" : "ltr"
      applyDir(next)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DIR_STORAGE_KEY, next)
      }
      return next
    })
  }, [])

  // ───── ⌘K command palette listener ─────
  const dispatchOpenPalette = React.useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("open-command-palette"))
  }, [])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        dispatchOpenPalette()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [dispatchOpenPalette])

  // ───── Region selector ─────
  // The picker drives the `?regionId=<id>` URL param. Matching the legacy
  // `RegionUrlPicker` contract: an absent param means "Global" (null). Any
  // present value is treated as a concrete region id. Server pages read
  // `searchParams.regionId` to filter their queries.
  const { regions } = useRegions()

  const regionParam = searchParams?.get("regionId") ?? null
  // Treat "all" as a legacy alias for Global. Anything else (incl. the
  // `__GLOBAL__` sentinel from the old picker) collapses to null too — the
  // new picker only ever puts concrete ids on the URL.
  const regionValue: string | null =
    !regionParam || regionParam === "all" || regionParam === "__GLOBAL__"
      ? null
      : regionParam

  const handleRegionChange = React.useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      if (next === null) {
        params.delete("regionId")
      } else {
        params.set("regionId", next)
      }
      // Region-dependent scope/filter params from other pages are stale once
      // the global region changes — clear them so we don't fetch (e.g.) the
      // previous region's office data under the new regionId.
      params.delete("regionalOfficeId")
      params.delete("officeId")
      params.delete("branchId")
      params.delete("clientId")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const userName = session?.user?.name ?? null
  const userEmail = session?.user?.email ?? null
  const userRole = session?.user?.role ?? null
  const userRegion = session?.user?.regionName ?? null
  const initials = getInitials(userName, userEmail)

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background px-4",
        className
      )}
    >
      {/* 1. Hamburger / sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle sidebar"
        onClick={onSidebarToggle}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* 2. Breadcrumb */}
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          {segments.length === 0 ? (
            <BreadcrumbItem>
              <BreadcrumbPage>Home</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            segments.map((seg, idx) => (
              <React.Fragment key={seg.href}>
                {idx > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
                  {seg.isLast ? (
                    <BreadcrumbPage>{seg.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={seg.href}>{seg.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {/* 4. Spacer */}
      <div className="flex-1" />

      {/* 5. Region selector */}
      {/* While the regions request is in flight the selector still renders;
          for SuperAdmin the Global option is always present, and the regional
          badge derives its label from the session, so an empty `regions`
          array is a safe degraded state. */}
      <RegionSelector
        regions={regions}
        value={regionValue}
        onChange={handleRegionChange}
        className="hidden lg:flex"
      />

      {/* 6. Command palette trigger */}
      <Button
        variant="outline"
        size="sm"
        onClick={dispatchOpenPalette}
        className="hidden gap-2 md:inline-flex"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="text-muted-foreground">Search…</span>
        <kbd className="ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      {/* Mobile: icon-only command palette trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={dispatchOpenPalette}
        className="md:hidden"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* 7a. Direction (RTL/LTR) toggle — Phase 8B pilot */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={
          dirMode === "rtl" ? "Switch to left-to-right" : "Switch to right-to-left"
        }
        aria-pressed={dirMode === "rtl"}
        onClick={toggleDir}
        title={dirMode === "rtl" ? "RTL" : "LTR"}
      >
        <Languages className="h-4 w-4" />
      </Button>

      {/* 7b. Theme toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Toggle theme">
            {themeMode === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : themeMode === "light" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Monitor className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="mr-2 h-4 w-4" />
            Light
            {themeMode === "light" ? (
              <span className="ml-auto text-xs text-muted-foreground">
                Active
              </span>
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className="mr-2 h-4 w-4" />
            Dark
            {themeMode === "dark" ? (
              <span className="ml-auto text-xs text-muted-foreground">
                Active
              </span>
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor className="mr-2 h-4 w-4" />
            System
            {themeMode === "system" ? (
              <span className="ml-auto text-xs text-muted-foreground">
                Active
              </span>
            ) : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 8. Notification bell */}
      <NotificationBell />

      {/* 9. User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open user menu"
            className="rounded-full"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              {userName || "Signed in"}
            </span>
            {userRole ? (
              <span className="text-xs font-normal text-muted-foreground">
                {userRole}
              </span>
            ) : null}
            {userRegion ? (
              <span className="text-xs font-normal text-muted-foreground">
                {userRegion}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Profile route (/users/me) does not yet exist — omitted intentionally. */}
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              void signOut({ callbackUrl: "/login" })
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

export default AppTopbar
