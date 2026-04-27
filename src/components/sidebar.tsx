"use client"

import { cn } from "@/lib/utils"
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
    Upload,
    ClipboardList,
    History,
    Search,
    Sparkles,
    Menu,
    X,
    ShieldAlert,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import SidebarNav, { NavNode } from "@/components/ui/sidebar-nav"
import { permissionKey, type ActionKey } from "@/lib/constants/permissions"
import { isSuperAdmin } from "@/lib/api/permissions"

const allNavItems: NavNode[] = [
    {
        title: "Dashboard",
        icon: LayoutDashboard,
        module: null, // always visible
        children: [
            { title: "Home", href: "/dashboard", icon: LayoutDashboard },
            { title: "Online Users", href: "/dashboard/online-users", icon: Users },
            { title: "AI Chat", href: "/dashboard/ai-chat", icon: Sparkles },
            { title: "Admin Center", href: "/dashboard/admin-center", icon: ClipboardList },
            { title: "SHSHK Insights", href: "/dashboard/shshk", icon: Sparkles },
        ],
    },
    {
        title: "Guards",
        icon: Users,
        module: "GUARDS",
        children: [
            { title: "All Guards", href: "/guards", icon: Users },
            { title: "Add Guard", href: "/guards/new", icon: Users },
            { title: "Search Guards", href: "/guards/search", icon: Users },
            { title: "Export Guards", href: "/guards/export", icon: FileText },
            { title: "Black Listed", href: "/guards/blacklist", icon: Users },
            { title: "Inactive Guards", href: "/guards/inactive", icon: Users },
            { title: "Deploy Guards", href: "/guards/deploy", icon: MapPin },
            { title: "Deployments Rate", href: "/guards/deployments-rate", icon: DollarSign },
            { title: "Attendance", href: "/guards/attendance", icon: Users },
            { title: "Client Attendance", href: "/guards/client-attendance", icon: Building2 },
            { title: "Residences", href: "/guards/residences", icon: Building2 },
            { title: "Assign Residence", href: "/guards/assign-residence", icon: MapPin },
            { title: "OnJob Trainings", href: "/guards/trainings", icon: FileText },
            { title: "Emergency Guard", href: "/guards/emergency", icon: Users },
            { title: "Docs Checklist Print", href: "/guards/docs-checklist", icon: FileText },
            { title: "Prerequisites", href: "/guards/prerequisites", icon: Users },
        ],
    },
    {
        title: "Payroll",
        icon: DollarSign,
        module: "PAYROLL",
        children: [
            { title: "Loans", href: "/payroll/loans", icon: DollarSign },
            { title: "Extra Hours", href: "/payroll/extra-hours", icon: DollarSign },
            { title: "Other Deductions", href: "/payroll/other-deductions", icon: DollarSign },
            { title: "Special Duty", href: "/payroll/special-duty", icon: DollarSign },
            { title: "Holidays", href: "/payroll/holidays", icon: DollarSign },
            { title: "Salary", href: "/payroll/salary-v2", icon: DollarSign },
            { title: "Salary State", href: "/payroll/state", icon: ShieldAlert },
            { title: "Bulk Salary Slips", href: "/payroll/bulk-salary-slips", icon: DollarSign },
            { title: "Clearance", href: "/payroll/clearance", icon: DollarSign },
            { title: "UnPaid Salaries", href: "/payroll/unpaid-salaries", icon: DollarSign },
            { title: "Reports", href: "/payroll/reports", icon: FileText },
            { title: "Settings", href: "/payroll/settings", icon: Settings },
        ],
    },
    {
        title: "Clients",
        icon: Building2,
        module: "CLIENTS",
        children: [
            { title: "All Clients", href: "/clients", icon: Building2 },
            { title: "Add Client", href: "/clients/new", icon: Building2 },
            { title: "Search Client", href: "/clients/search-v2", icon: Search },
            { title: "Types & Locations", href: "/clients/types-locations", icon: Settings },
            { title: "Black Listed", href: "/clients/blacklist", icon: Building2 },
            { title: "Export Branches", href: "/clients/export-branches", icon: FileText },
            { title: "Invoicing", href: "/clients/invoicing", icon: DollarSign },
            { title: "Invoice Prerequisites", href: "/clients/invoice-prerequisites", icon: Settings },
            { title: "Branches", href: "/clients/branches", icon: MapPin },
            { title: "Pricing", href: "/clients/pricing", icon: DollarSign },
            { title: "Insurance by Clients", href: "/clients/clientInsuranceSettings", icon: ShieldAlert },
        ],
    },
    {
        title: "Inventory",
        icon: Package,
        module: "INVENTORY",
        children: [
            {
                title: "Warehouses & Stores",
                icon: Building2,
                children: [
                    { title: "Stores", href: "/store-inventory/stores", icon: Building2 },
                    {
                        title: "Demands",
                        icon: ClipboardList,
                        children: [
                            { title: "Demand Request", href: "/store-inventory/demands-send", icon: ClipboardList },
                            { title: "Demand Respond", href: "/store-inventory/demands-response", icon: ClipboardList },
                        ],
                    },
                ],
            },
            {
                title: "Management",
                icon: Search,
                children: [
                    { title: "Inventory List", href: "/store-inventory/inventories", icon: Search },
                    { title: "Guard Assignments", href: "/store-inventory/inventory-assignments", icon: MapPin },
                    { title: "Employee Assignments", href: "/store-inventory/employee-assignments", icon: MapPin },
                    { title: "Client Assignments", href: "/store-inventory/client-assignments", icon: MapPin },
                ],
            },
            {
                title: "Vendors & Orders",
                icon: FileText,
                children: [
                    { title: "Vendors", href: "/store-inventory/vendors", icon: Building2 },
                    { title: "Purchases", href: "/store-inventory/purchases", icon: FileText },
                    { title: "Create Purchase", href: "/store-inventory/purchase-create", icon: Upload },
                ],
            },
            {
                title: "Product Definition",
                icon: Settings,
                children: [
                    {
                        title: "Weapons",
                        icon: Package,
                        children: [
                            { title: "Weapon Types", href: "/store-inventory/weapon-types", icon: Package },
                            { title: "Calibres", href: "/store-inventory/calibres", icon: Settings },
                            { title: "Licenses", href: "/store-inventory/licenses", icon: FileText },
                        ],
                    },
                    { title: "Products", href: "/store-inventory/products", icon: Package },
                    { title: "Create Product", href: "/store-inventory/product-create", icon: Upload },
                    { title: "Brands", href: "/store-inventory/brands", icon: Package },
                    { title: "Units", href: "/store-inventory/units", icon: Package },
                    { title: "Categories", href: "/store-inventory/categories", icon: Package },
                    { title: "Statuses", href: "/store-inventory/statuses", icon: Settings },
                    { title: "Conditions", href: "/store-inventory/conditions", icon: Settings },
                    { title: "Variations", href: "/store-inventory/variations", icon: Settings },
                    { title: "Repairings", href: "/store-inventory/repairings", icon: History },
                    { title: "Product Unique Items", href: "/store-inventory/product-unique-items", icon: Package },
                ],
            },
            {
                title: "Stock Operations",
                icon: History,
                children: [
                    { title: "Adjustments", href: "/store-inventory/adjustments", icon: History },
                    { title: "Create Adjustment", href: "/store-inventory/adjustment-create", icon: Upload },
                    { title: "Audits", href: "/store-inventory/audits", icon: History },
                    { title: "Dashboard", href: "/store-inventory", icon: LayoutDashboard },
                ],
            },
            {
                title: "Weapon Operations",
                icon: Package,
                children: [
                    { title: "Weapon Inventory", href: "/store-inventory/weapon-inventories", icon: Search },
                    { title: "Ammo Inventory", href: "/store-inventory/ammo-inventories", icon: Search },
                    { title: "Weapon Purchases", href: "/store-inventory/weapon-purchases", icon: FileText },
                    { title: "Create Weapon Purchase", href: "/store-inventory/weapon-purchase-create", icon: Upload },
                    { title: "Weapon Adjustments", href: "/store-inventory/weapon-adjustments", icon: History },
                    { title: "Create Weapon Adjustment", href: "/store-inventory/weapon-adjustment-create", icon: Upload },
                    { title: "Weapon Client Assignment", href: "/store-inventory/weapon-client-assignments", icon: MapPin },
                ],
            },
        ],
    },
    {
        title: "Users",
        icon: Users,
        module: "USERS",
        children: [
            { title: "All Users", href: "/users", icon: Users },
            { title: "Add User", href: "/users/new", icon: Users },
            { title: "Search Users", href: "/users/search", icon: Search },
            { title: "Roles & Permissions", href: "/users/roles", icon: Settings },
            { title: "M/S Relationship", href: "/users/ms-relationship", icon: Users },
            { title: "Switch Supervisor", href: "/users/switch-supervisor", icon: Users },
            { title: "C/S Relationship", href: "/users/cs-relationship", icon: Users },
        ],
    },
    {
        title: "Admin Approvals",
        icon: ShieldAlert,
        module: "ADMIN_APPROVALS",
        children: [
            { title: "Guards Approval", href: "/admin-approvals/guards-approval", icon: ShieldAlert },
        ],
    },
    {
        title: "Ticketing",
        icon: Ticket,
        module: "TICKETING",
        children: [
            { title: "All Tickets", href: "/tickets", icon: Ticket },
            { title: "Create Ticket", href: "/tickets/new", icon: Ticket },
            { title: "Prerequisites", href: "/tickets/prerequisites", icon: Settings },
        ],
    },
    {
        title: "Settings",
        icon: Settings,
        module: "SETTINGS",
        children: [
            { title: "Regions", href: "/settings/regions", icon: MapPin },
            { title: "Regional Offices", href: "/settings/offices", icon: Building2 },
            { title: "Guard Documents", href: "/settings/guard-pledgeable-documents", icon: FileText },
            { title: "User Types", href: "/settings/user-types", icon: Users },
            { title: "Guard Bank Names", href: "/settings/guard-bank-names", icon: DollarSign },
            { title: "Fingerprint Device", href: "/settings/fingerprint-device", icon: Settings },
            { title: "Workflow Rules", href: "/settings/workflow-rules", icon: Settings },
            { title: "System Settings", href: "/settings/system", icon: Settings },
        ],
    },
    {
        title: "Reports",
        icon: FileText,
        module: "REPORTS",
        children: [
            { title: "Overview", href: "/reports", icon: FileText },
            { title: "Scheduled", href: "/reports/scheduled", icon: FileText },
            { title: "Guard Deployment", href: "/reports/guard-deployment", icon: FileText },
            { title: "Day & Night", href: "/reports/day-night-duty", icon: FileText },
            { title: "Client Enrolled", href: "/reports/client-enrolled", icon: FileText },
            { title: "AI/Prompt Reports", href: "/reports/ai", icon: Sparkles },
            { title: "Generated Reports", href: "/reports/generated", icon: FileText },
        ],
    },
    {
        title: "Imports",
        href: "/imports",
        icon: Upload,
        module: "IMPORTS",
    },
    {
        title: "Requisitions",
        href: "/requisitions",
        icon: ClipboardList,
        module: "REQUISITIONS",
    },
    {
        title: "Audit",
        href: "/audit",
        icon: History,
        module: "AUDIT",
    },
]

/**
 * Infer the action required to show a nav item.
 *  - explicit `requiredAction` wins
 *  - href ending in `/new`, or title containing "Add"/"New"/"Create" → CREATE
 *  - title containing "Delete" → DELETE
 *  - everything else → VIEW (navigation is fundamentally a read)
 */
function inferRequiredAction(node: NavNode): ActionKey {
    if (node.requiredAction) return node.requiredAction
    const title = node.title ?? ""
    const href = node.href ?? ""
    if (/delete/i.test(title)) return "DELETE"
    if (/\/new(\/|$)/.test(href) || /\b(add|new|create)\b/i.test(title)) return "CREATE"
    return "VIEW"
}

/**
 * Filter a subtree by the user's permission set.
 * For each node:
 *  - if it has a `module` set, the user must hold `"MODULE:<action>"`
 *  - children are filtered recursively using the PARENT's module
 *  - a group node with no surviving children is dropped
 */
function filterSubtree(node: NavNode, permissions: string[], module: string | null): NavNode | null {
    // Determine the effective module for this node (inherits from parent).
    const effectiveModule = (node.module ?? module) as string | null

    // Dashboard / no-module items are always visible.
    if (effectiveModule === null || effectiveModule === undefined) {
        if (node.children?.length) {
            const children = node.children
                .map((c) => filterSubtree(c, permissions, null))
                .filter((c): c is NavNode => c !== null)
            return { ...node, children }
        }
        return node
    }

    // For gated items, check the per-action permission key.
    const action = inferRequiredAction(node)
    const required = permissionKey(effectiveModule, action)
    const allowed = permissions.includes(required)

    if (node.children?.length) {
        const children = node.children
            .map((c) => filterSubtree(c, permissions, effectiveModule))
            .filter((c): c is NavNode => c !== null)

        // Parent group itself: allow if the user has VIEW on the module
        // (navigation is fundamentally a read).
        const parentAllowed = permissions.includes(permissionKey(effectiveModule, "VIEW"))

        if (!parentAllowed && children.length === 0) return null
        return { ...node, children }
    }

    return allowed ? node : null
}

function filterNavByPermissions(items: NavNode[], permissions: string[], isAdmin: boolean): NavNode[] {
    if (isAdmin) return items
    return items
        .map((item) => filterSubtree(item, permissions, null))
        .filter((item): item is NavNode => item !== null)
}

function hasPathInTree(node: NavNode, pathname: string): boolean {
    if (node.href && (pathname === node.href || pathname.startsWith(node.href + "/"))) {
        return true
    }

    if (!node.children?.length) {
        return false
    }

    return node.children.some((child) => hasPathInTree(child, pathname))
}

function getActiveSectionTitle(pathname: string): string | null {
    for (const item of allNavItems) {
        if (!item.children) continue
        if (item.children.some((child) => hasPathInTree(child, pathname))) {
            return item.title
        }
    }
    return null
}

export function Sidebar() {
    const pathname = usePathname()
    const { data: session, status } = useSession()
    const [openSections, setOpenSections] = useState<string[]>(() => {
        const active = getActiveSectionTitle(pathname)
        return active ? [active] : []
    })
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    // When pathname changes, ensure the active section is open (without closing others)
    useEffect(() => {
        const active = getActiveSectionTitle(pathname)
        if (active) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- open the nav section that matches the current pathname
            setOpenSections((prev) => (prev.includes(active) ? prev : [...prev, active]))
        }
    }, [pathname])

    const toggleSection = (title: string) => {
        setOpenSections((prev) =>
            prev.includes(title)
                ? prev.filter((item) => item !== title)
                : [...prev, title]
        )
    }

    // Derive visible nav items from session permissions.
    // SuperAdmin bypass (shared rule from @/lib/api/permissions):
    //   - "Super User" role → always unrestricted
    //   - "Admin" role with NO permissions → unrestricted
    //   - Anyone else → filtered by their per-action permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permissions = ((session?.user as any)?.permissions as string[]) || []
    const isUnrestricted = isSuperAdmin(session)

    const navItems = status === "loading"
        ? [] // show nothing while loading to avoid flash
        : filterNavByPermissions(allNavItems, permissions, isUnrestricted)

    // Derive the scope indicator. Names come from the JWT (baked at sign-in),
    // so this works for users without SETTINGS:VIEW. Super User → Global pill.
    // Otherwise → "Region / Office" pill.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sUser = session?.user as any
    const regionId: string | null = sUser?.regionId ?? null
    const officeId: string | null = sUser?.regionalOfficeId ?? null
    const regionName: string | null = sUser?.regionName ?? null
    const officeName: string | null = sUser?.regionalOfficeName ?? null

    let scopeIndicator: ReactNode = null
    if (status === "authenticated") {
        if (isUnrestricted || (!regionId && !officeId)) {
            scopeIndicator = (
                <span
                    className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
                    title="Unscoped — sees all regions"
                >
                    Global
                </span>
            )
        } else {
            const label = [regionName ?? (regionId ? "—" : null), officeName ?? (officeId ? "—" : null)]
                .filter(Boolean)
                .join(" / ")
            if (label) {
                scopeIndicator = (
                    <span
                        className="inline-flex max-w-full items-center truncate rounded-full border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-2 py-0.5 text-[11px] font-medium text-sky-200"
                        title={`Scoped to ${label}`}
                    >
                        {label}
                    </span>
                )
            }
        }
    }

    const sidebarContent = (
        <div className="flex h-full flex-col">
            <div className="flex flex-col justify-center gap-1 border-b border-[var(--sidebar-border)] px-6 py-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Parwest</p>
                    <h2 className="text-lg font-semibold text-white">ERP Console</h2>
                </div>
                {scopeIndicator && (
                    <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="shrink-0">Scope:</span>
                        <span className="min-w-0 flex-1 truncate">{scopeIndicator}</span>
                    </div>
                )}
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
                {status === "loading" ? (
                    <div className="space-y-2 pt-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-8 animate-pulse rounded bg-white/10" />
                        ))}
                    </div>
                ) : (
                    <SidebarNav
                        items={navItems}
                        openSections={openSections}
                        onToggleSection={toggleSection}
                        onNavigate={() => setIsMobileOpen(false)}
                    />
                )}
            </nav>
            {/* Permission notice for non-admin users */}
            {!isUnrestricted && status === "authenticated" && navItems.length <= 1 && (
                <div className="border-t border-[var(--sidebar-border)] p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        <span>No modules assigned. Contact your Admin.</span>
                    </div>
                </div>
            )}
        </div>
    )

    return (
        <>
            {/* Mobile toggle button */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="fixed left-4 top-4 z-50 rounded-[var(--radius-md)] bg-[var(--surface)] p-2 shadow-[var(--shadow-sm)] lg:hidden"
            >
                {isMobileOpen ? (
                    <X className="h-6 w-6" />
                ) : (
                    <Menu className="h-6 w-6" />
                )}
            </button>

            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 h-screen w-[17rem] border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-transform lg:translate-x-0",
                    isMobileOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {sidebarContent}
            </aside>
        </>
    )
}