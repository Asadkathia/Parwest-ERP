"use client"

import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Users,
    Building2,
    MapPin,
    DollarSign,
    Package,
    Settings,
    FileText,
    Upload,
    ClipboardList,
    History,
    Sparkles,
    Menu,
    X,
    Briefcase,
    BarChart3,
    Shield,
} from "lucide-react"
import { useState } from "react"
import SidebarNav, { NavNode } from "@/components/ui/sidebar-nav"

const navItems: NavNode[] = [
    {
        title: "Dashboard",
        icon: LayoutDashboard,
        children: [
            { title: "Home", href: "/dashboard", icon: LayoutDashboard },
            { title: "AI Chat", href: "/dashboard/ai-chat", icon: Sparkles },
            { title: "Online Users", href: "/dashboard/online-users", icon: Users },
            { title: "Admin Center", href: "/dashboard/admin-center", icon: ClipboardList },
        ],
    },
    {
        title: "Workforce",
        icon: Briefcase,
        children: [
            { title: "Directory", href: "/guards", icon: Users },
            { title: "Enrollment", href: "/guards/new", icon: Users },
            { title: "Deployment", href: "/guards/deploy", icon: MapPin },
            { title: "Attendance", href: "/guards/attendance", icon: Users },
            { title: "Training", href: "/guards/trainings", icon: FileText },
            { title: "Compliance", href: "/workforce/compliance", icon: Shield },
            { title: "Housing", href: "/workforce/housing", icon: Building2 },
        ],
    },
    {
        title: "Payroll",
        icon: DollarSign,
        children: [
            { title: "Operations", href: "/payroll/operations", icon: DollarSign },
            { title: "Loans", href: "/payroll/operations/loan", icon: DollarSign },
            { title: "Salary", href: "/payroll/operations/salary-v2", icon: DollarSign },
            { title: "Reports", href: "/payroll/reports", icon: FileText },
            { title: "Settings", href: "/payroll/settings", icon: Settings },
        ],
    },
    {
        title: "Clients",
        icon: Building2,
        children: [
            { title: "Directory", href: "/clients", icon: Building2 },
            { title: "Enrollment", href: "/clients/new", icon: Building2 },
            { title: "Branches", href: "/clients/branches", icon: MapPin },
            { title: "Contracts/Billing", href: "/clients/contracts-billing", icon: DollarSign },
        ],
    },
    {
        title: "Inventory",
        icon: Package,
        children: [
            { title: "Overview", href: "/inventory", icon: LayoutDashboard },
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
        title: "Users & Access",
        icon: Users,
        children: [
            { title: "Users", href: "/users", icon: Users },
            { title: "Roles", href: "/users/roles", icon: Settings },
            { title: "Permissions", href: "/users/permissions", icon: Settings },
            { title: "Assignments & Transfers", href: "/users-access/assignments", icon: Users },
        ],
    },
    {
        title: "Reports & Analytics",
        icon: BarChart3,
        children: [
            { title: "Scheduled", href: "/reports/scheduled", icon: FileText },
            { title: "Operational Reports", href: "/reports", icon: FileText },
            { title: "AI/Prompt Reports", href: "/reports/ai", icon: Sparkles },
            { title: "Generated Reports List", href: "/reports/generated", icon: FileText },
        ],
    },
    {
        title: "System",
        icon: Settings,
        children: [
            { title: "Settings", href: "/system/settings", icon: Settings },
            { title: "Imports", href: "/imports", icon: Upload },
            { title: "Requisitions", href: "/requisitions", icon: ClipboardList },
            { title: "Audit", href: "/audit", icon: History },
            { title: "Devices", href: "/settings/fingerprint-device", icon: Settings },
        ],
    },
]

export function Sidebar() {
    const [openSections, setOpenSections] = useState<string[]>(["Dashboard", "Workforce", "Clients"])
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
