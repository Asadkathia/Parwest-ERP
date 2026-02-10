import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Building, MapPin, Building2, Search } from "lucide-react"

export default async function BranchesPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const branches = await prisma.branch.findMany({
        include: {
            client: true,
            deployments: {
                where: { status: "ACTIVE" },
            },
        },
        orderBy: { name: "asc" },
    })

    const stats = {
        total: branches.length,
        headOffices: branches.filter((b) => b.isHeadOffice).length,
        cities: new Set(branches.map((b) => b.city).filter(Boolean)).size,
        withDeployments: branches.filter((b) => b.deployments.length > 0).length,
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">All Branches</h1>
                <p className="text-gray-600 mt-1">Manage all client branches across the system</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Branches</p>
                            <p className="text-3xl font-bold mt-1">{stats.total}</p>
                        </div>
                        <Building className="h-12 w-12 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Head Offices</p>
                            <p className="text-3xl font-bold mt-1">{stats.headOffices}</p>
                        </div>
                        <Building2 className="h-12 w-12 text-green-500" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Cities</p>
                            <p className="text-3xl font-bold mt-1">{stats.cities}</p>
                        </div>
                        <MapPin className="h-12 w-12 text-purple-500" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">With Deployments</p>
                            <p className="text-3xl font-bold mt-1">{stats.withDeployments}</p>
                        </div>
                        <MapPin className="h-12 w-12 text-orange-500" />
                    </div>
                </div>
            </div>

            {/* Branches Table */}
            <div className="bg-white rounded-lg border">
                <div className="p-6 border-b">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search branches..."
                                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Client
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Branch Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Code
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    City
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Province
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Deployments
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {branches.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        <Building className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                        <p className="text-lg font-medium">No branches found</p>
                                        <p className="text-sm mt-1">Branches will appear here once clients add them</p>
                                    </td>
                                </tr>
                            ) : (
                                branches.map((branch) => (
                                    <tr key={branch.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/clients/${branch.clientId}`}
                                                className="text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                {branch.client.name}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{branch.name}</span>
                                                {branch.isHeadOffice && (
                                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                                        Head Office
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {branch.code || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {branch.city || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {branch.province || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {branch.client.type}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full font-medium">
                                                {branch.deployments.length}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <Link
                                                href={`/clients/branches/${branch.id}`}
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                View Branch
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {branches.length > 0 && (
                    <div className="px-6 py-4 border-t bg-gray-50">
                        <p className="text-sm text-gray-600">
                            Showing {branches.length} {branches.length === 1 ? "branch" : "branches"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
