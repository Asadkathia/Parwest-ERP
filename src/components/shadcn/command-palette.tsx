"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
    LayoutDashboard,
    Users,
    Building2,
    MapPin,
    DollarSign,
    Package,
    Ticket,
    Settings,
    FileText,
    History,
    ShieldAlert,
    Plus,
    type LucideIcon,
} from "lucide-react"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/shadcn/dialog"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/shadcn/command"
import { hasAction, hasModuleAccess, isSuperAdmin } from "@/lib/api/permissions"
import { cn } from "@/lib/utils"

const OPEN_EVENT = "open-command-palette"

/**
 * Canonical top-level navigation items for the palette.
 *
 * NOTE: derived inline from the legacy sidebar source
 * (`src/components/sidebar.tsx`) — Phase 2A has not yet promoted this list
 * to a shared `src/lib/navigation/items.ts`. Once that lands, this constant
 * should be replaced by an import.
 */
type NavItem = {
    label: string
    href: string
    icon: LucideIcon
    /** Module key for permission gating; null means always visible */
    module: string | null
    /** Optional shortcut hint shown on the right (cosmetic only). */
    shortcut?: string
}

const NAV_ITEMS: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: null },
    { label: "Guards", href: "/guards", icon: Users, module: "GUARDS" },
    { label: "Deployments", href: "/guards/deploy", icon: MapPin, module: "GUARDS" },
    { label: "Clients", href: "/clients", icon: Building2, module: "CLIENTS" },
    { label: "Payroll", href: "/payroll/salary-v2", icon: DollarSign, module: "PAYROLL" },
    { label: "Invoicing", href: "/clients/invoicing", icon: FileText, module: "CLIENTS" },
    { label: "Inventory", href: "/store-inventory", icon: Package, module: "INVENTORY" },
    { label: "Tickets", href: "/tickets", icon: Ticket, module: "TICKETING" },
    { label: "Reports", href: "/reports", icon: FileText, module: "REPORTS" },
    { label: "Audit", href: "/audit", icon: History, module: "AUDIT" },
    { label: "RBAC", href: "/users/roles", icon: ShieldAlert, module: "USERS" },
    { label: "Settings", href: "/settings/system", icon: Settings, module: "SETTINGS" },
]

type ActionItem = {
    label: string
    href: string
    icon: LucideIcon
    module: string | null
    /**
     * Required action on `module`. When present, the palette gates visibility
     * with `hasAction(session, module, action)` so we never surface commands
     * whose target route would just redirect (e.g. `Create guard` for users
     * who only have GUARDS:VIEW).
     */
    action?: "VIEW" | "CREATE" | "UPDATE" | "DELETE"
}

const ACTION_ITEMS: ActionItem[] = [
    { label: "Create guard", href: "/guards/new", icon: Plus, module: "GUARDS", action: "CREATE" },
    { label: "Create deployment", href: "/guards/deploy", icon: Plus, module: "GUARDS", action: "CREATE" },
    { label: "Open settings", href: "/settings/system", icon: Settings, module: "SETTINGS" },
]

export interface CommandPaletteProps {
    /** Optional override for testing/preview. Default: listens for the global event. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function CommandPalette(props: CommandPaletteProps): React.ReactElement {
    const router = useRouter()
    const { data: session } = useSession()

    const [internalOpen, setInternalOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")

    // Controlled-or-uncontrolled: if `props.open` is provided, we mirror it,
    // but we also still respond to the global event so the preview Button works.
    const isControlled = props.open !== undefined
    const open = isControlled ? !!props.open || internalOpen : internalOpen

    const setOpen = React.useCallback(
        (next: boolean) => {
            setInternalOpen(next)
            props.onOpenChange?.(next)
        },
        [props]
    )

    // Listen for the global open event dispatched by Phase 2B's Cmd+K handler.
    React.useEffect(() => {
        const handler = () => setOpen(true)
        window.addEventListener(OPEN_EVENT, handler)
        return () => {
            window.removeEventListener(OPEN_EVENT, handler)
        }
    }, [setOpen])

    // Reset query when palette closes so it opens fresh next time.
    React.useEffect(() => {
        if (!open) setQuery("")
    }, [open])

    // Permission filter: SuperAdmin bypass + module-level VIEW for everyone else.
    const canSee = React.useCallback(
        (module: string | null) => {
            if (module === null) return true
            if (isSuperAdmin(session)) return true
            return hasModuleAccess(session, module)
        },
        [session]
    )

    const visibleNav = React.useMemo(
        () => NAV_ITEMS.filter((it) => canSee(it.module)),
        [canSee]
    )
    const visibleActions = React.useMemo(
        () =>
            ACTION_ITEMS.filter((it) => {
                if (it.module === null) return true
                if (isSuperAdmin(session)) return true
                return it.action
                    ? hasAction(session, it.module, it.action)
                    : hasModuleAccess(session, it.module)
            }),
        [session]
    )

    const handleSelect = React.useCallback(
        (href: string) => {
            setOpen(false)
            router.push(href)
        },
        [router, setOpen]
    )

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                // Hide the built-in close button (spec: Escape only) by
                // targeting the absolutely-positioned close affordance.
                className="max-w-[640px] gap-0 overflow-hidden p-0 [&>button.absolute]:hidden"
            >
                <DialogTitle className="sr-only">Command palette</DialogTitle>
                <DialogDescription className="sr-only">
                    Search and run a command across the ERP.
                </DialogDescription>
                <Command
                    className={cn(
                        "[&_[cmdk-group-heading]]:px-2",
                        "[&_[cmdk-group-heading]]:font-medium",
                        "[&_[cmdk-group-heading]]:text-muted-foreground",
                        "[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0",
                        "[&_[cmdk-group]]:px-2",
                        "[&_[cmdk-input-wrapper]_svg]:h-5",
                        "[&_[cmdk-input-wrapper]_svg]:w-5",
                        "[&_[cmdk-input]]:h-12",
                        "[&_[cmdk-item]]:h-10",
                        "[&_[cmdk-item]]:px-2",
                        "[&_[cmdk-item]_svg]:h-4",
                        "[&_[cmdk-item]_svg]:w-4"
                    )}
                >
                    <div className="sticky top-0 z-10 bg-popover">
                        <CommandInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Type a command or search…"
                        />
                    </div>
                    <CommandList>
                        <CommandEmpty>
                            <div className="space-y-1 py-2 text-center">
                                <p className="text-sm">
                                    No matches for &ldquo;{query}&rdquo;
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Try searching for a module name or action.
                                </p>
                            </div>
                        </CommandEmpty>

                        {visibleNav.length > 0 && (
                            <CommandGroup heading="Navigation">
                                {visibleNav.map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <CommandItem
                                            key={`nav:${item.href}`}
                                            value={`nav ${item.label} ${item.href}`}
                                            onSelect={() => handleSelect(item.href)}
                                        >
                                            <Icon />
                                            <span>{item.label}</span>
                                            {item.shortcut && (
                                                <CommandShortcut
                                                    className={cn(
                                                        "ml-auto text-xs text-muted-foreground"
                                                    )}
                                                >
                                                    {item.shortcut}
                                                </CommandShortcut>
                                            )}
                                        </CommandItem>
                                    )
                                })}
                            </CommandGroup>
                        )}

                        {visibleActions.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup heading="Actions">
                                    {visibleActions.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <CommandItem
                                                key={`action:${item.href}`}
                                                value={`action ${item.label} ${item.href}`}
                                                onSelect={() =>
                                                    handleSelect(item.href)
                                                }
                                            >
                                                <Icon />
                                                <span>{item.label}</span>
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            </>
                        )}

                        <CommandSeparator />
                        <CommandGroup heading="Recent">
                            <CommandItem
                                disabled
                                value="recent-empty"
                                className="text-muted-foreground"
                            >
                                <span>No recent items</span>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    )
}

export default CommandPalette
