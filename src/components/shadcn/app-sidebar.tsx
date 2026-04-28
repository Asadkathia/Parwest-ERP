"use client"

/**
 * Phase 2A — always-dark app sidebar built on shadcn primitives.
 *
 * Drop-in replacement for `src/components/sidebar.tsx`. Self-sufficient:
 * reads its own session, pathname, and nav config. Does NOT inherit the
 * content `data-theme` attribute — always renders against the dark
 * sidebar token block.
 *
 * Behaviour parity with the legacy sidebar:
 *   - Per-module / per-action permission gating via `hasAction` /
 *     `hasModuleAccess` from `@/lib/api/permissions` (same call sites
 *     and inference rules as legacy `sidebar.tsx`).
 *   - Active route highlighting via `usePathname()`.
 *   - Sub-section collapse (auto-opens the section containing the
 *     current path).
 *   - Region scope indicator in the footer (Global pill for Super User
 *     / unscoped, otherwise "Region / Office").
 *   - Sign-out menu item in the footer.
 *
 * Visuals: per v1.0 brandbook + ERP prototype — collapsible (240px /
 * 64px), shield-P logo lockup at top, smooth width transitions.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    Globe,
    LogOut,
    Shield,
    ShieldAlert,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { permissionKey, type ActionKey } from "@/lib/constants/permissions"
import { isSuperAdmin } from "@/lib/api/permissions"
import { NAV_ITEMS, type NavItem } from "@/lib/navigation/items"
import { Button } from "@/components/shadcn/button"
import { ScrollArea } from "@/components/shadcn/scroll-area"
import { Separator } from "@/components/shadcn/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/shadcn/tooltip"

// ─── Permission filter (mirrors legacy sidebar.tsx) ─────────────────

function inferRequiredAction(node: NavItem): ActionKey {
    if (node.requiredAction) return node.requiredAction
    const title = node.title ?? ""
    const href = node.href ?? ""
    if (/delete/i.test(title)) return "DELETE"
    if (/\/new(\/|$)/.test(href) || /\b(add|new|create)\b/i.test(title)) return "CREATE"
    return "VIEW"
}

function filterSubtree(
    node: NavItem,
    permissions: string[],
    module: string | null,
): NavItem | null {
    const effectiveModule = (node.module ?? module) as string | null

    // Items without a gating module are always visible.
    if (effectiveModule === null || effectiveModule === undefined) {
        if (node.children?.length) {
            const children = node.children
                .map((c) => filterSubtree(c, permissions, null))
                .filter((c): c is NavItem => c !== null)
            return { ...node, children }
        }
        return node
    }

    const action = inferRequiredAction(node)
    const required = permissionKey(effectiveModule, action)
    const allowed = permissions.includes(required)

    if (node.children?.length) {
        const children = node.children
            .map((c) => filterSubtree(c, permissions, effectiveModule))
            .filter((c): c is NavItem => c !== null)
        const parentAllowed = permissions.includes(permissionKey(effectiveModule, "VIEW"))
        if (!parentAllowed && children.length === 0) return null
        return { ...node, children }
    }

    return allowed ? node : null
}

function filterNav(items: NavItem[], permissions: string[], unrestricted: boolean): NavItem[] {
    if (unrestricted) return items
    return items
        .map((item) => filterSubtree(item, permissions, null))
        .filter((item): item is NavItem => item !== null)
}

// ─── Active-path helpers ────────────────────────────────────────────

function nodeContainsPath(node: NavItem, pathname: string): boolean {
    if (node.href && (pathname === node.href || pathname.startsWith(node.href + "/"))) {
        return true
    }
    return node.children?.some((c) => nodeContainsPath(c, pathname)) ?? false
}

function defaultOpenKeysFor(items: NavItem[], pathname: string): string[] {
    // Walk the tree and collect titles of every group ancestor of the
    // active leaf so deep paths auto-expand all the way down.
    const open: string[] = []
    const walk = (nodes: NavItem[], trail: string[]) => {
        for (const n of nodes) {
            const here = [...trail, n.title]
            if (n.children?.length) {
                if (nodeContainsPath(n, pathname)) {
                    open.push(here.join("::"))
                }
                walk(n.children, here)
            }
        }
    }
    walk(items, [])
    return open
}

// ─── Component ──────────────────────────────────────────────────────

export interface AppSidebarProps {
    defaultCollapsed?: boolean
    className?: string
    /** Controlled off-canvas state for narrow viewports. */
    mobileOpen?: boolean
    /** Fired when the user dismisses the mobile sidebar (overlay click / nav click). */
    onMobileOpenChange?: (open: boolean) => void
}

export function AppSidebar({
    defaultCollapsed = false,
    className,
    mobileOpen = false,
    onMobileOpenChange,
}: AppSidebarProps): React.ReactElement {
    const pathname = usePathname()
    const { data: session, status } = useSession()
    const [collapsed, setCollapsed] = React.useState<boolean>(defaultCollapsed)
    const [openKeys, setOpenKeys] = React.useState<string[]>(() =>
        defaultOpenKeysFor(NAV_ITEMS, pathname ?? ""),
    )

    // When pathname changes, ensure ancestors of the active leaf are open
    // (don't close anything the user manually opened).
    React.useEffect(() => {
        const next = defaultOpenKeysFor(NAV_ITEMS, pathname ?? "")
        if (next.length === 0) return
        setOpenKeys((prev) => {
            const merged = new Set(prev)
            for (const k of next) merged.add(k)
            return Array.from(merged)
        })
    }, [pathname])

    // [ / ] keyboard shortcut to toggle collapsed state.
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Skip when focus is in a text input.
            const target = e.target as HTMLElement | null
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return
            }
            if (e.key === "[") {
                setCollapsed(true)
            } else if (e.key === "]") {
                setCollapsed(false)
            }
        }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [])

    const toggleKey = React.useCallback((key: string) => {
        setOpenKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
    }, [])

    // Permissions / scope.
    const sUser = (session?.user ?? null) as
        | (NonNullable<typeof session>["user"] & {
              permissions?: string[]
              regionId?: string | null
              regionalOfficeId?: string | null
              regionName?: string | null
              regionalOfficeName?: string | null
          })
        | null
    const permissions = sUser?.permissions ?? []
    const unrestricted = isSuperAdmin(session)

    const items = status === "loading" ? [] : filterNav(NAV_ITEMS, permissions, unrestricted)

    const regionId = sUser?.regionId ?? null
    const officeId = sUser?.regionalOfficeId ?? null
    const regionName = sUser?.regionName ?? null
    const officeName = sUser?.regionalOfficeName ?? null
    const scopeLabel: string = unrestricted || (!regionId && !officeId)
        ? "Global access"
        : [regionName ?? (regionId ? "—" : null), officeName ?? (officeId ? "—" : null)]
              .filter(Boolean)
              .join(" / ") || "Scoped"

    const widthClass = collapsed ? "w-16" : "w-60"

    // Auto-close the mobile drawer on route change so the new page isn't
    // hidden behind the overlay.
    React.useEffect(() => {
        if (mobileOpen) onMobileOpenChange?.(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname])

    const closeMobile = React.useCallback(() => {
        onMobileOpenChange?.(false)
    }, [onMobileOpenChange])

    return (
        <TooltipProvider delayDuration={150}>
            {/* Mobile overlay: tap to dismiss. md+ relies on the inline aside. */}
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={closeMobile}
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                />
            )}
            <aside
                data-theme="dark"
                className={cn(
                    "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-150 ease-out",
                    widthClass,
                    // On mobile, render as a fixed off-canvas drawer that
                    // slides in when `mobileOpen` is true. md+ keeps the
                    // legacy in-flow flex child layout.
                    "fixed inset-y-0 left-0 z-50 md:static md:translate-x-0",
                    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                    className,
                )}
            >
                {/* Wordmark */}
                <SidebarHeader collapsed={collapsed} />

                <Separator className="bg-sidebar-border opacity-60" />

                {/* Nav list */}
                <ScrollArea className="flex-1 px-2 py-3">
                    {status === "loading" ? (
                        <div className="space-y-2 px-1">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-8 animate-pulse rounded-md bg-white/5" />
                            ))}
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-0.5">
                            {items.map((item) => (
                                <SidebarTree
                                    key={item.title}
                                    node={item}
                                    pathname={pathname ?? ""}
                                    depth={0}
                                    keyPath={item.title}
                                    openKeys={openKeys}
                                    onToggle={toggleKey}
                                    collapsed={collapsed}
                                />
                            ))}
                            {!unrestricted && status === "authenticated" && items.length <= 1 && (
                                <li className="mt-3 px-2 py-1.5 text-xs text-sidebar-text-muted">
                                    <span className="inline-flex items-center gap-2">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        {!collapsed && <span>No modules assigned. Contact your Admin.</span>}
                                    </span>
                                </li>
                            )}
                        </ul>
                    )}
                </ScrollArea>

                <Separator className="bg-sidebar-border opacity-60" />

                {/* Footer: scope + sign-out + collapse toggle */}
                <SidebarFooter
                    collapsed={collapsed}
                    scopeLabel={scopeLabel}
                    unrestricted={unrestricted}
                    onToggleCollapsed={() => setCollapsed((c) => !c)}
                />
            </aside>
        </TooltipProvider>
    )
}

// ─── Header (logo lockup) ───────────────────────────────────────────

function SidebarHeader({ collapsed }: { collapsed: boolean }): React.ReactElement {
    return (
        <div className={cn("flex items-center gap-3 px-3 py-4", collapsed && "justify-center px-2")}>
            <div
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ background: "var(--brand-600, #2f5bff)", color: "#fff" }}
            >
                <Shield className="h-4 w-4" strokeWidth={1.75} />
            </div>
            {!collapsed && (
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
                        Parwest
                    </div>
                    <div className="truncate text-[11px] leading-tight text-sidebar-text-muted">
                        ERP Platform
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Footer (scope + sign-out + collapse) ───────────────────────────

function SidebarFooter({
    collapsed,
    scopeLabel,
    unrestricted,
    onToggleCollapsed,
}: {
    collapsed: boolean
    scopeLabel: string
    unrestricted: boolean
    onToggleCollapsed: () => void
}): React.ReactElement {
    return (
        <div className={cn("flex flex-col gap-2 p-3", collapsed && "items-center px-2")}>
            {/* Scope indicator */}
            {!collapsed ? (
                <div
                    className="flex min-w-0 items-center gap-2 rounded-md bg-sidebar-surface px-2 py-1.5 text-[11px] text-sidebar-text-muted"
                    title={scopeLabel}
                >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{scopeLabel}</span>
                </div>
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-surface text-sidebar-text-muted">
                            <Globe className="h-3.5 w-3.5" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">{scopeLabel}</TooltipContent>
                </Tooltip>
            )}

            <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
                {/* Sign out */}
                {collapsed ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Sign out"
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="h-8 w-8 text-sidebar-foreground hover:bg-white/[0.06]"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Sign out</TooltipContent>
                    </Tooltip>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex-1 justify-start gap-2 text-sidebar-foreground hover:bg-white/[0.06]"
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="text-xs">Sign out</span>
                    </Button>
                )}

                {/* Collapse toggle */}
                {collapsed ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Expand sidebar (])"
                                onClick={onToggleCollapsed}
                                className="h-8 w-8 text-sidebar-foreground hover:bg-white/[0.06]"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Expand ([)</TooltipContent>
                    </Tooltip>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Collapse sidebar ([)"
                        onClick={onToggleCollapsed}
                        className="h-8 w-8 text-sidebar-foreground hover:bg-white/[0.06]"
                        title="Collapse ([)"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {!collapsed && unrestricted && (
                <div className="px-1 text-[10px] uppercase tracking-wider text-sidebar-text-muted">
                    Super User
                </div>
            )}
        </div>
    )
}

// ─── Tree row (recursive) ───────────────────────────────────────────

function isActiveHref(pathname: string, href?: string): boolean {
    if (!href) return false
    return pathname === href || pathname.startsWith(href + "/")
}

function SidebarTree({
    node,
    pathname,
    depth,
    keyPath,
    openKeys,
    onToggle,
    collapsed,
}: {
    node: NavItem
    pathname: string
    depth: number
    keyPath: string
    openKeys: string[]
    onToggle: (key: string) => void
    collapsed: boolean
}): React.ReactElement {
    const Icon = node.icon
    const hasChildren = (node.children?.length ?? 0) > 0
    const open = openKeys.includes(keyPath)
    const active = isActiveHref(pathname, node.href)
    const childActive = !active && nodeContainsPath(node, pathname)

    // Indent for depth (only when expanded — collapsed shows only level-0).
    const indent = !collapsed ? { paddingLeft: `${0.75 + depth * 0.75}rem` } : undefined

    // In collapsed mode, only render top-level items as icon buttons.
    if (collapsed && depth > 0) {
        return <></>
    }

    if (hasChildren) {
        const trigger = (
            <button
                type="button"
                onClick={() => onToggle(keyPath)}
                aria-expanded={open}
                className={cn(
                    "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    "hover:bg-white/[0.06]",
                    active || childActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground",
                    collapsed && "justify-center px-0",
                )}
                style={indent}
            >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                    <>
                        <span className="min-w-0 flex-1 truncate text-left">{node.title}</span>
                        {node.badge !== undefined && (
                            <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent-foreground">
                                {node.badge}
                            </span>
                        )}
                        <ChevronDown
                            className={cn(
                                "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                                open ? "rotate-0" : "-rotate-90",
                            )}
                        />
                    </>
                )}
            </button>
        )

        return (
            <li>
                {collapsed ? (
                    <Tooltip>
                        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                        <TooltipContent side="right">{node.title}</TooltipContent>
                    </Tooltip>
                ) : (
                    trigger
                )}

                {!collapsed && (
                    <ul
                        className={cn(
                            "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                            open ? "max-h-[2400px] opacity-100" : "max-h-0 opacity-0",
                        )}
                    >
                        {node.children!.map((child) => (
                            <SidebarTree
                                key={child.title}
                                node={child}
                                pathname={pathname}
                                depth={depth + 1}
                                keyPath={`${keyPath}::${child.title}`}
                                openKeys={openKeys}
                                onToggle={onToggle}
                                collapsed={collapsed}
                            />
                        ))}
                    </ul>
                )}
            </li>
        )
    }

    // Leaf
    if (!node.href) {
        // No href and no children — render disabled label (rare).
        return (
            <li>
                <div
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-text-muted opacity-60"
                    style={indent}
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{node.title}</span>}
                </div>
            </li>
        )
    }

    const link = (
        <Link
            href={node.href}
            className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1",
                active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground",
                collapsed && "justify-center px-0",
            )}
            style={indent}
            aria-current={active ? "page" : undefined}
        >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
                <>
                    <span className="min-w-0 flex-1 truncate">{node.title}</span>
                    {node.badge !== undefined && (
                        <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent-foreground">
                            {node.badge}
                        </span>
                    )}
                </>
            )}
        </Link>
    )

    return (
        <li>
            {collapsed ? (
                <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{node.title}</TooltipContent>
                </Tooltip>
            ) : (
                link
            )}
        </li>
    )
}

export default AppSidebar
