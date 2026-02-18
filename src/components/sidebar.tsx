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
} from "lucide-react"
import { useState } from "react"
import SidebarNav, { NavNode } from "@/components/ui/sidebar-nav"

const navItems: NavNode[] = [
    {
        title: "Dashboard",
        icon: LayoutDashboard,
        children: [
            { title: "Home", href: "/dashboard", icon: LayoutDashboard },
            { title: "Online Users", href: "/dashboard/online-users", icon: Users },
            { title: "AI Chat", href: "/dashboard/ai-chat", icon: Sparkles },
            { title: "Reports List", href: "/dashboard/reports-list", icon: FileText },
            { title: "Admin Center", href: "/dashboard/admin-center", icon: ClipboardList },
            { title: "SHSHK Insights", href: "/dashboard/shshk", icon: Sparkles },
        ],
    },
    {
        title: "Guards",
        icon: Users,
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
        children: [
            { title: "Operations", href: "/payroll/operations", icon: DollarSign },
            { title: "Loan", href: "/payroll/operations/loan", icon: DollarSign },
            { title: "Extra Hours", href: "/payroll/operations/extra-hours", icon: DollarSign },
            { title: "Special Duty", href: "/payroll/operations/special-duty", icon: DollarSign },
            { title: "Salary", href: "/payroll/operations/salary-v2", icon: DollarSign },
            { title: "UnPaid Salaries", href: "/payroll/operations/unpaid-salaries", icon: DollarSign },
            { title: "Reports", href: "/payroll/reports", icon: FileText },
            { title: "Settings", href: "/payroll/settings", icon: Settings },
            { title: "Loans", href: "/payroll/loans", icon: DollarSign },
            { title: "Bulk Loans", href: "/payroll/loans/bulk", icon: Upload },
        ],
    },
    {
        title: "Clients",
        icon: Building2,
        children: [
            { title: "All Clients", href: "/clients", icon: Building2 },
            { title: "Add Client", href: "/clients/new", icon: Building2 },
            { title: "Search Client", href: "/clients/search", icon: Search },
            { title: "Types & Locations", href: "/clients/types-locations", icon: Settings },
            { title: "Black Listed", href: "/clients/blacklist", icon: Building2 },
            { title: "Export Branches", href: "/clients/export-branches", icon: FileText },
            { title: "Invoice Prerequisites", href: "/clients/invoice-prerequisites", icon: Settings },
            { title: "Invoiced Billings", href: "/clients/invoiced-billings", icon: DollarSign },
            { title: "Branches", href: "/clients/branches", icon: MapPin },
            { title: "Pricing", href: "/clients/pricing", icon: DollarSign },
            { title: "Invoicing", href: "/clients/invoicing", icon: DollarSign },
        ],
    },
    {
        title: "Deployments",
        href: "/deployments",
        icon: MapPin,
    },
    {
        title: "Inventory",
        icon: Package,
        children: [
            { title: "Dashboard", href: "/inventory", icon: LayoutDashboard },
            { title: "Search", href: "/inventory/search", icon: Search },
            { title: "Categories", href: "/inventory/categories", icon: Package },
            { title: "Vendors", href: "/inventory/vendors", icon: Building2 },
            { title: "Conditions", href: "/inventory/conditions", icon: Settings },
            { title: "Demand", href: "/inventory/demand", icon: ClipboardList },
            { title: "Stock In", href: "/inventory/stock-in", icon: Upload },
            { title: "Assign Item", href: "/inventory/assign-item", icon: MapPin },
            { title: "Condemned Items", href: "/inventory/condemned", icon: History },
        ],
    },
    {
        title: "Users",
        icon: Users,
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
        title: "Ticketing",
        icon: Ticket,
        children: [
            { title: "All Tickets", href: "/tickets", icon: Ticket },
            { title: "Create Ticket", href: "/tickets/new", icon: Ticket },
            { title: "Prerequisites", href: "/tickets/prerequisites", icon: Settings },
        ],
    },
    {
        title: "Settings",
        icon: Settings,
        children: [
            { title: "Regions", href: "/settings/regions", icon: MapPin },
            { title: "Regional Offices", href: "/settings/offices", icon: Building2 },
            { title: "Guard Documents", href: "/settings/guard-pledgeable-documents", icon: FileText },
            { title: "User Types", href: "/settings/user-types", icon: Users },
            { title: "Guard Bank Names", href: "/settings/guard-bank-names", icon: DollarSign },
            { title: "Fingerprint Device", href: "/settings/fingerprint-device", icon: Settings },
            { title: "System Settings", href: "/settings/system", icon: Settings },
        ],
    },
    {
        title: "Reports",
        icon: FileText,
        children: [
            { title: "Overview", href: "/reports", icon: FileText },
            { title: "Scheduled", href: "/reports/scheduled", icon: FileText },
            { title: "Guard Deployment", href: "/reports/guard-deployment", icon: FileText },
            { title: "Day & Night", href: "/reports/day-night-duty", icon: FileText },
            { title: "Client Enrolled", href: "/reports/client-enrolled", icon: FileText },
        ],
    },
    {
        title: "Imports",
        href: "/imports",
        icon: Upload,
    },
    {
        title: "Requisitions",
        href: "/requisitions",
        icon: ClipboardList,
    },
    {
        title: "Audit",
        href: "/audit",
        icon: History,
    },
]

export function Sidebar() {
    const [openSections, setOpenSections] = useState<string[]>(["Dashboard", "Guards", "Clients"])
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    const toggleSection = (title: string) => {
        setOpenSections((prev) =>
            prev.includes(title)
                ? prev.filter((item) => item !== title)
                : [...prev, title]
        )
    }

    const sidebarContent = (
        <div className="flex h-full flex-col">
            <div className="flex h-16 items-center border-b border-[var(--sidebar-border)] px-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Parwest</p>
                    <h2 className="text-lg font-semibold text-white">ERP Console</h2>
                </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
                <SidebarNav
                    items={navItems}
                    openSections={openSections}
                    onToggleSection={toggleSection}
                    onNavigate={() => setIsMobileOpen(false)}
                />
            </nav>
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
