import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Search } from "lucide-react"

export default async function GuardsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const guards = await prisma.guard.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
            regionalOffice: true,
            region: true,
        },
    })

    const stats = {
        total: await prisma.guard.count(),
        active: await prisma.guard.count({ where: { status: "ACTIVE" } }),
        pending: await prisma.guard.count({ where: { status: "PENDING" } }),
        inactive: await prisma.guard.count({ where: { status: "INACTIVE" } }),
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Guards</h1>
                    <p className="text-gray-600 mt-1">Manage security guards and their information</p>
                </div>
                <Link
                    href="/guards/new"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <Plus className="h-5 w-5" />
                    Add Guard
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <div className="bg-white rounded-lg border p-6">
                    <p className="text-sm font-medium text-gray-600">Total Guards</p>
                    <h3 className="text-2xl font-bold mt-2">{stats.total}</h3>
                </div>
                <div className="bg-white rounded-lg border p-6">
                    <p className="text-sm font-medium text-gray-600">Active</p>
                    <h3 className="text-2xl font-bold mt-2 text-green-600">{stats.active}</h3>
                </div>
                <div className="bg-white rounded-lg border p-6">
                    <p className="text-sm font-medium text-gray-600">Pending</p>
                    <h3 className="text-2xl font-bold mt-2 text-orange-600">{stats.pending}</h3>
                </div>
                <div className="bg-white rounded-lg border p-6">
                    <p className="text-sm font-medium text-gray-600">Inactive</p>
                    <h3 className="text-2xl font-bold mt-2 text-gray-600">{stats.inactive}</h3>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg border p-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, CNIC, or Parwest ID..."
                            className="w-full pl-10 pr-4 py-2 border rounded-md"
                        />
                    </div>
                    <select className="border rounded-md px-4 py-2">
                        <option value="">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="PENDING">Pending</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="TERMINATED">Terminated</option>
                    </select>
                    <select className="border rounded-md px-4 py-2">
                        <option value="">All Regions</option>
                    </select>
                </div>
            </div>

            {/* Guards Table */}
            <div className="bg-white rounded-lg border">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Parwest ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    CNIC
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Phone
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
                            {guards.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <p className="text-lg font-medium">No guards found</p>
                                            <p className="text-sm">Get started by adding your first guard</p>
                                            <Link
                                                href="/guards/new"
                                                className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                                            >
                                                <Plus className="h-5 w-5" />
                                                Add Guard
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                guards.map((guard) => (
                                    <tr key={guard.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium">{guard.parwestId}</td>
                                        <td className="px-6 py-4 text-sm">{guard.name}</td>
                                        <td className="px-6 py-4 text-sm">{guard.cnic}</td>
                                        <td className="px-6 py-4 text-sm">{guard.phone || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{guard.region?.name || "—"}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${guard.status === "ACTIVE"
                                                        ? "bg-green-100 text-green-800"
                                                        : guard.status === "PENDING"
                                                            ? "bg-orange-100 text-orange-800"
                                                            : "bg-gray-100 text-gray-800"
                                                    }`}
                                            >
                                                {guard.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <Link
                                                href={`/guards/${guard.id}`}
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
