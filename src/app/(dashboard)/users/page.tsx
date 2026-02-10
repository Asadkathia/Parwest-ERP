import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Search, Users as UsersIcon } from "lucide-react"

export default async function UsersPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const users = await prisma.user.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
            role: true,
        },
    })

    const stats = {
        total: await prisma.user.count(),
        active: await prisma.user.count({ where: { status: "ACTIVE" } }),
        inactive: await prisma.user.count({ where: { status: "INACTIVE" } }),
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Users</h1>
                    <p className="text-gray-600 mt-1">Manage system users and their permissions</p>
                </div>
                <Link
                    href="/users/new"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <Plus className="h-5 w-5" />
                    Add User
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-white rounded-lg border p-6">
                    <div className="flex items-center gap-3">
                        <UsersIcon className="h-8 w-8 text-blue-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Users</p>
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
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg border p-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            className="w-full pl-10 pr-4 py-2 border rounded-md"
                        />
                    </div>
                    <select className="border rounded-md px-4 py-2">
                        <option value="">All Roles</option>
                    </select>
                    <select className="border rounded-md px-4 py-2">
                        <option value="">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg border">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Last Login
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium">{user.name}</td>
                                    <td className="px-6 py-4 text-sm">{user.email}</td>
                                    <td className="px-6 py-4 text-sm">{user.role?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span
                                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.status === "ACTIVE"
                                                ? "bg-green-100 text-green-800"
                                                : "bg-gray-100 text-gray-800"
                                                }`}
                                        >
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        —
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <Link
                                            href={`/users/${user.id}`}
                                            className="text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
