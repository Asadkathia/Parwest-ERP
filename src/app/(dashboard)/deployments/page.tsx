import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, MapPin } from "lucide-react"

export default async function DeploymentsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const deployments = await prisma.deployment.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
            guard: true,
            branch: {
                include: {
                    client: true,
                },
            },
            client: true,
        },
    })

    const stats = {
        total: await prisma.deployment.count(),
        active: await prisma.deployment.count({ where: { status: "ACTIVE" } }),
        inactive: await prisma.deployment.count({ where: { status: "INACTIVE" } }),
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Deployments</h1>
                    <p className="text-gray-600 mt-1">Manage guard deployments to client locations</p>
                </div>
                <Link
                    href="/deployments/new"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <Plus className="h-5 w-5" />
                    New Deployment
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-white rounded-lg border p-6">
                    <div className="flex items-center gap-3">
                        <MapPin className="h-8 w-8 text-blue-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Deployments</p>
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

            {/* Deployments Table */}
            <div className="bg-white rounded-lg border">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Guard
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Client
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Branch
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Start Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    End Date
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
                            {deployments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <MapPin className="h-12 w-12 text-gray-400" />
                                            <p className="text-lg font-medium">No deployments found</p>
                                            <p className="text-sm">Create your first deployment to assign guards to clients</p>
                                            <Link
                                                href="/deployments/new"
                                                className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                                            >
                                                <Plus className="h-5 w-5" />
                                                New Deployment
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                deployments.map((deployment) => (
                                    <tr key={deployment.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium">{deployment.guard?.name}</td>
                                        <td className="px-6 py-4 text-sm">{deployment.client?.name}</td>
                                        <td className="px-6 py-4 text-sm">{deployment.branch?.name || "—"}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {new Date(deployment.deploymentDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            —
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${deployment.status === "ACTIVE"
                                                    ? "bg-green-100 text-green-800"
                                                    : deployment.status === "PENDING"
                                                        ? "bg-orange-100 text-orange-800"
                                                        : "bg-gray-100 text-gray-800"
                                                    }`}
                                            >
                                                {deployment.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <Link
                                                href={`/deployments/${deployment.id}`}
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
