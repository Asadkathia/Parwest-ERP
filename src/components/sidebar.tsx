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
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import SidebarNav, { NavNode } from "@/components/ui/sidebar-nav"

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
            { title: "Operations", href: "/payroll/operations", icon: DollarSign },
            { title: "Loans", href: "/payroll/operations/loan", icon: DollarSign },
            { title: "Extra Hours", href: "/payroll/operations/extra-hours", icon: DollarSign },
            { title: "Special Duty", href: "/payroll/operations/special-duty", icon: DollarSign },
            { title: "Salary", href: "/payroll/operations/salary-v2", icon: DollarSign },
            { title: "UnPaid Salaries", href: "/payroll/operations/unpaid-salaries", icon: DollarSign },
            { title: "Reports", href: "/payroll/reports", icon: FileText },
            { title: "Settings", href: "/payroll/settings", icon: Settings },
            { title: "Bulk Loans", href: "/payroll/loans/bulk", icon: Upload },
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
            { title: "Invoice Prerequisites", href: "/clients/invoice-prerequisites", icon: Settings },
            { title: "Invoiced Billings", href: "/clients/invoiced-billings", icon: DollarSign },
            { title: "Branches", href: "/clients/branches", icon: MapPin },
            { title: "Pricing", href: "/clients/pricing", icon: DollarSign },
            { title: "Invoicing", href: "/clients/invoicing", icon: DollarSign },
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
            { title: "Roles", href: "/users/roles", icon: Settings },
            { title: "Permissions", href: "/users/permissions", icon: Settings },
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

function filterNavByPermissions(items: NavNode[], permissions: string[], isAdmin: boolean): NavNode[] {
    if (isAdmin) return items
    return items.filter((item) => {
        const mod = item.module
        if (mod === null || mod === undefined) return true // Dashboard — always visible
        return permissions.includes(mod)
    })
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

    // Derive visible nav items from session permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = (session?.user as any)?.role as string | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permissions = ((session?.user as any)?.permissions as string[]) || []

    // Admin role is always unrestricted — sees all modules regardless of permissions.
    // Non-admin users see only modules matching their assigned permissions.
    const isUnrestrictedAdmin = userRole === "Admin"

    const navItems = status === "loading"
        ? [] // show nothing while loading to avoid flash
        : filterNavByPermissions(allNavItems, permissions, isUnrestrictedAdmin)

    const sidebarContent = (
        <div className="flex h-full flex-col">
            <div className="flex h-16 items-center border-b border-[var(--sidebar-border)] px-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Parwest</p>
                    <h2 className="text-lg font-semibold text-white">ERP Console</h2>
                </div>
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
            {!isUnrestrictedAdmin && status === "authenticated" && navItems.length <= 1 && (
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