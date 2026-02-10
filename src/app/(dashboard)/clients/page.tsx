import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Search, Building2 } from "lucide-react"

export default async function ClientsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const clients = await prisma.client.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
            region: true,
            _count: {
                select: { branches: true },
            },
        },
    })

    const stats = {
        total: await prisma.client.count(),
        active: await prisma.client.count({ where: { status: "ACTIVE" } }),
        inactive: await prisma.client.count({ where: { status: "INACTIVE" } }),
        totalBranches: await prisma.branch.count(),
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Clients</h1>
                    <p className="text-gray-600 mt-1">Manage clients and their branch locations</p>
                </div>
                <Link
                    href="/clients/new"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <Plus className="h-5 w-5" />
                    Add Client
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <div className="bg-white rounded-lg border p-6">
                    <div className="flex items-center gap-3">
                        <Building2 className="h-8 w-8 text-blue-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Clients</p>
                            <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg border p-6">
                    <p className="text-sm font-medium text-gray-600">Active</p>
                    <h3 className="text-2xl font-bold mt-2 text-green-600">{stats.active}</h3>
                </div>
                <div className="bg-white rounded-lg border p-6">
                    <p className="text-sm font-medium text-gray-600">Inactive</p>
                    <h3 className="text-2xl font-bold mt-2 text-gray-600">{stats.inactive}</h3>
                </div>
                <div className="bg-white rounded-lg border p-6">
                    <p className="text-sm font-medium text-gray-600">Total Branches</p>
                    <h3 className="text-2xl font-bold mt-2 text-blue-600">{stats.totalBranches}</h3>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg border p-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by client name or code..."
                            className="w-full pl-10 pr-4 py-2 border rounded-md"
                        />
                    </div>
                    <select className="border rounded-md px-4 py-2">
                        <option value="">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                    <select className="border rounded-md px-4 py-2">
                        <option value="">All Regions</option>
                    </select>
                </div>
            </div>

            {/* Clients Table */}
            <div className="bg-white rounded-lg border">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    City
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Branches
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Region
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {clients.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Building2 className="h-12 w-12 text-gray-400" />
                                            <p className="text-lg font-medium">No clients found</p>
                                            <p className="text-sm">Get started by adding your first client</p>
                                            <Link
                                                href="/clients/new"
                                                className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                                            >
                                                <Plus className="h-5 w-5" />
                                                Add Client
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                clients.map((client) => (
                                    <tr key={client.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium">{client.name}</td>
                                        <td className="px-6 py-4 text-sm">{client.type}</td>
                                        <td className="px-6 py-4 text-sm">{client.city || "—"}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="inline-flex items-center gap-1">
                                                <Building2 className="h-4 w-4" />
                                                {client._count.branches}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">{client.region?.name || "—"}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${client.status === "ACTIVE"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-gray-100 text-gray-800"
                                                    }`}
                                            >
                                                {client.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <Link
                                                href={`/clients/${client.id}`}
                                                className="text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
