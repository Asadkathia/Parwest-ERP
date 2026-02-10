"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
    ChevronDown,
    Menu,
    X,
} from "lucide-react"
import { useState } from "react"

interface NavItem {
    title: string
    href?: string
    icon: React.ComponentType<{ className?: string }>
    children?: NavItem[]
}

const navItems: NavItem[] = [
    {
        title: "Dashboard",
        icon: LayoutDashboard,
        children: [
            { title: "Home", href: "/dashboard", icon: LayoutDashboard },
            { title: "Online Users", href: "/dashboard/online-users", icon: Users },
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
            { title: "Salary", href: "/payroll/operations/salary", icon: DollarSign },
            { title: "UnPaid Salaries", href: "/payroll/operations/unpaid-salaries", icon: DollarSign },
            { title: "Reports", href: "/payroll/reports", icon: FileText },
            { title: "Settings", href: "/payroll/settings", icon: Settings },
            { title: "Loans", href: "/payroll/loans", icon: DollarSign },
        ],
    },
    {
        title: "Clients",
        icon: Building2,
        children: [
            { title: "All Clients", href: "/clients", icon: Building2 },
            { title: "Add Client", href: "/clients/new", icon: Building2 },
            { title: "Search Client", href: "/clients/search", icon: Search },
            { title: "Search Client V2", href: "/clients/search-v2", icon: Search },
            { title: "Types & Locations", href: "/clients/types-locations", icon: Settings },
            { title: "Black Listed", href: "/clients/blacklist", icon: Building2 },
            { title: "Export Branches", href: "/clients/export-branches", icon: FileText },
            { title: "Invoice Prerequisites", href: "/clients/invoice-prerequisites", icon: Settings },
            { title: "Invoiced Billings", href: "/clients/invoiced-billings", icon: DollarSign },
            { title: "Branches", href: "/clients/branches", icon: MapPin },
            { title: "Pricing", href: "/clients/pricing", icon: DollarSign },
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
            { title: "System Settings", href: "/settings/system", icon: Settings },
        ],
    },
    {
        title: "Reports",
        href: "/reports",
        icon: FileText,
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
    const pathname = usePathname()
    const [openSections, setOpenSections] = useState<string[]>(["Dashboard", "Guards", "Clients"])
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    const toggleSection = (title: string) => {
        setOpenSections((prev) =>
            prev.includes(title)
                ? prev.filter((item) => item !== title)
                : [...prev, title]
        )
    }

    const isActive = (href: string) => {
        return pathname === href || pathname.startsWith(href + "/")
    }

    const sidebarContent = (
        <div className="flex h-full flex-col">
            <div className="flex h-16 items-center border-b px-6">
                <h2 className="text-lg font-semibold">Parwest ERP</h2>
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-1">
                    {navItems.map((item) => (
                        <li key={item.title}>
                            {item.children ? (
                                <div>
                                    <button
                                        onClick={() => toggleSection(item.title)}
                                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100"
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="h-5 w-5" />
                                            <span>{item.title}</span>
                                        </div>
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 transition-transform",
                                                openSections.includes(item.title) && "rotate-180"
                                            )}
                                        />
                                    </button>
                                    {openSections.includes(item.title) && (
                                        <ul className="ml-4 mt-1 space-y-1 border-l pl-4">
                                            {item.children.map((child) => (
                                                <li key={child.title}>
                                                    <Link
                                                        href={child.href!}
                                                        className={cn(
                                                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-100",
                                                            isActive(child.href!) &&
                                                            "bg-blue-50 text-blue-600 font-medium"
                                                        )}
                                                        onClick={() => setIsMobileOpen(false)}
                                                    >
                                                        <child.icon className="h-4 w-4" />
                                                        <span>{child.title}</span>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                <Link
                                    href={item.href!}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100",
                                        isActive(item.href!) &&
                                        "bg-blue-50 text-blue-600 font-medium"
                                    )}
                                    onClick={() => setIsMobileOpen(false)}
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span>{item.title}</span>
                                </Link>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    )

    return (
        <>
            {/* Mobile toggle button */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="fixed left-4 top-4 z-50 rounded-md bg-white p-2 shadow-md lg:hidden"
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
                    "fixed left-0 top-0 z-40 h-screen w-64 border-r bg-white transition-transform lg:translate-x-0",
                    isMobileOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {sidebarContent}
            </aside>
        </>
    )
}
