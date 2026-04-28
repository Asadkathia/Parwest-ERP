"use client"

/**
 * Phase 2 — client shell for the (dashboard) route group.
 *
 * Composes the new shadcn-based shell pieces:
 *   - <AppSidebar />        permission-gated, always-dark, collapsible
 *   - <AppTopbar />         breadcrumb + search + theme + region + user menu
 *   - <CommandPalette />    listens for the global `open-command-palette` event
 *
 * The server `(dashboard)/layout.tsx` handles auth + redirect; this component
 * only owns layout structure. The topbar / sidebar pull session data from
 * `useSession()` themselves.
 */

import * as React from "react"

import { AppSidebar } from "@/components/shadcn/app-sidebar"
import { AppTopbar } from "@/components/shadcn/app-topbar"
import { CommandPalette } from "@/components/shadcn/command-palette"

export interface DashboardShellProps {
    children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps): React.ReactElement {
    // On narrow viewports the sidebar is off-canvas; the topbar hamburger
    // toggles it. On md+ the sidebar is always inline and the hamburger is
    // a no-op (the sidebar's own footer chevron / `[` `]` keys handle
    // collapse there).
    const [mobileOpen, setMobileOpen] = React.useState(false)
    const handleSidebarToggle = React.useCallback(() => {
        setMobileOpen((o) => !o)
    }, [])

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <AppSidebar
                mobileOpen={mobileOpen}
                onMobileOpenChange={setMobileOpen}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <AppTopbar onSidebarToggle={handleSidebarToggle} />
                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
            <CommandPalette />
        </div>
    )
}

export default DashboardShell
