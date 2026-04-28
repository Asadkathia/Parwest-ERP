/**
 * Canonical app navigation tree.
 *
 * Shared by both the legacy sidebar (`src/components/sidebar.tsx`) and the
 * new shadcn-based sidebar (`src/components/shadcn/app-sidebar.tsx`). Keep
 * this shape stable — both consumers depend on it.
 *
 * Permission gating happens at the consumer (sidebar) — items declare their
 * `module` and an optional `requiredAction`; the sidebar applies the
 * `hasModuleAccess` / `hasAction` rules from `@/lib/api/permissions`.
 */

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
    ShieldAlert,
} from "lucide-react"

export type NavItemAction = "CREATE" | "VIEW" | "UPDATE" | "DELETE" | "REQUISITIONS"

/**
 * Shared nav-tree node shape — used by AppSidebar and CommandPalette.
 */
export type NavItem = {
    title: string
    href?: string
    icon: React.ComponentType<{ className?: string }>
    children?: NavItem[]
    /** Top-level module key used for permission filtering. null = always visible. */
    module?: string | null
    /** Optional override; otherwise inferred from href/title (see sidebar.tsx). */
    requiredAction?: NavItemAction
    /** Optional numeric badge shown next to the label (e.g. ticket count). */
    badge?: number | string
}

export const NAV_ITEMS: NavItem[] = [
    {
        title: "Dashboard",
        icon: LayoutDashboard,
        module: null,
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
