import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit, Building, MapPin, Phone, Mail, User } from "lucide-react"

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const branch = await prisma.branch.findUnique({
        where: { id },
        include: {
            client: true,
            deployments: {
                include: {
                    guard: true,
                },
                orderBy: { createdAt: "desc" },
            },
        },
    })

    if (!branch) notFound()

    const formatDate = (date: Date | null) => {
        if (!date) return "—"
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return "bg-green-100 text-green-800"
            case "INACTIVE":
                return "bg-gray-100 text-gray-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    const activeDeployments = branch.deployments.filter((d) => d.status === "ACTIVE")

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href={`/clients/${branch.clientId}`}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to {branch.client.name}
                    </Link>
                    <h1 className="text-3xl font-bold">{branch.name}</h1>
                    <p className="text-gray-600 mt-1">{branch.client.name}</p>
                </div>
                <div className="flex items-center gap-3">
                    {branch.isHeadOffice && (
                        <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                            Head Office
                        </span>
                    )}
                    <Link
                        href={`/clients/branches/${branch.id}/edit`}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                        <Edit className="h-4 w-4" />
                        Edit Branch
                    </Link>
                </div>
            </div>

            {/* Summary Card */}
            <div className="bg-white rounded-lg border p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <p className="text-sm text-gray-600">Branch Code</p>
                        <p className="font-medium mt-1 text-lg">{branch.code || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">City</p>
                        <p className="font-medium mt-1 text-lg">{branch.city || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Province</p>
                        <p className="font-medium mt-1 text-lg">{branch.province || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Active Deployments</p>
                        <p className="font-medium mt-1 text-lg text-green-600">{activeDeployments.length}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Location Information */}
                    <div className="bg-white rounded-lg border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <MapPin className="h-5 w-5 text-gray-600" />
                            <h3 className="text-lg font-semibold">Location Information</h3>
                        </div>
                        <div className="space-y-4">
                            {branch.address && (
                                <div>
                                    <p className="text-sm text-gray-600">Address</p>
                                    <p className="font-medium mt-1">{branch.address}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">City</p>
                                    <p className="font-medium mt-1">{branch.city || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Province</p>
                                    <p className="font-medium mt-1">{branch.province || "—"}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-white rounded-lg border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <User className="h-5 w-5 text-gray-600" />
                            <h3 className="text-lg font-semibold">Contact Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">Contact Person</p>
                                <p className="font-medium mt-1">{branch.contactPerson || "—"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Phone</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {branch.contactPhone ? (
                                        <>
                                            <Phone className="h-4 w-4 text-gray-400" />
                                            <p className="font-medium">{branch.contactPhone}</p>
                                        </>
                                    ) : (
                                        <p className="font-medium">—</p>
                                    )}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-sm text-gray-600">Email</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {branch.contactEmail ? (
                                        <>
                                            <Mail className="h-4 w-4 text-gray-400" />
                                            <a
                                                href={`mailto:${branch.contactEmail}`}
                                                className="font-medium text-blue-600 hover:text-blue-800"
                                            >
                                                {branch.contactEmail}
                                            </a>
                                        </>
                                    ) : (
                                        <p className="font-medium">—</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Deployments */}
                    <div className="bg-white rounded-lg border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Deployments ({branch.deployments.length})</h3>
                            <Link
                                href={`/deployments/new?clientId=${branch.clientId}&branchId=${branch.id}`}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                + Add Deployment
                            </Link>
                        </div>
                        {branch.deployments.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                                <p>No deployments at this branch yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {branch.deployments.map((deployment) => (
                                    <div
                                        key={deployment.id}
                                        className="flex items-center justify-between p-4 border rounded-md hover:bg-gray-50"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <Link
                                                    href={`/guards/${deployment.guard.id}`}
                                                    className="font-medium text-blue-600 hover:text-blue-800"
                                                >
                                                    {deployment.guard.name}
                                                </Link>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(deployment.status)}`}>
                                                    {deployment.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                                <span>{deployment.guard.parwestId}</span>
                                                {deployment.designation && <span>• {deployment.designation}</span>}
                                                <span>• Since {formatDate(deployment.deploymentDate)}</span>
                                            </div>
                                        </div>
                                        <Link
                                            href={`/deployments/${deployment.id}`}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            View
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Client Information */}
                    <div className="bg-white rounded-lg border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Building className="h-5 w-5 text-gray-600" />
                            <h3 className="text-lg font-semibold">Client</h3>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-gray-600">Name</p>
                                <Link
                                    href={`/clients/${branch.client.id}`}
                                    className="font-medium text-blue-600 hover:text-blue-800 mt-1 block"
                                >
                                    {branch.client.name}
                                </Link>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Type</p>
                                <p className="font-medium mt-1">{branch.client.type}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Status</p>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium inline-block mt-1 ${getStatusColor(branch.client.status)}`}>
                                    {branch.client.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white rounded-lg border p-6">
                        <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Total Deployments</span>
                                <span className="font-bold text-lg">{branch.deployments.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Active</span>
                                <span className="font-bold text-lg text-green-600">{activeDeployments.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Inactive</span>
                                <span className="font-bold text-lg text-gray-600">
                                    {branch.deployments.length - activeDeployments.length}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="bg-white rounded-lg border p-6">
                        <h3 className="text-lg font-semibold mb-4">Information</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gray-600">Created</p>
                                <p className="font-medium mt-1">{formatDate(branch.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Last Updated</p>
                                <p className="font-medium mt-1">{formatDate(branch.updatedAt)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
