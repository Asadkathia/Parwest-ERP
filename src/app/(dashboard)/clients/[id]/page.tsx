import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit, Mail, MapPin, Building, Calendar, FileText, Plus } from "lucide-react"

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const client = await prisma.client.findUnique({
        where: { id },
        include: {
            region: true,
            branches: {
                include: {
                    deployments: {
                        include: {
                            guard: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            },
        },
    })

    if (!client) notFound()

    const formatDate = (date: Date | null) => {
        if (!date) return "—"
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
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

    const totalDeployments = client.branches.reduce(
        (sum, branch) => sum + branch.deployments.length,
        0
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/clients"
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        Back to Clients
                    </Link>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/clients/${client.id}/branches/new`}
                        className="flex items-center gap-2 border px-4 py-2 rounded-md hover:bg-gray-50"
                    >
                        <Plus className="h-4 w-4" />
                        Add Branch
                    </Link>
                    <Link
                        href={`/clients/${client.id}/edit`}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                        <Edit className="h-4 w-4" />
                        Edit Client
                    </Link>
                </div>
            </div>

            {/* Client Header Card */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        {client.logoUrl && (
                            <img
                                src={client.logoUrl}
                                alt={client.name}
                                className="w-16 h-16 rounded-lg object-cover border"
                            />
                        )}
                        <div>
                            <h1 className="text-3xl font-bold">{client.name}</h1>
                            <p className="text-gray-600 mt-1">{client.type}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(client.status)}`}>
                            {client.status}
                        </span>
                        <button type="button" className="border rounded-md px-3 py-1.5 text-sm hover:bg-gray-50">
                            Upload Picture
                        </button>
                        <button type="button" className="text-sm text-blue-600 hover:text-blue-700">
                            Change Status
                        </button>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t">
                    <div className="flex flex-wrap gap-2">
                        {[
                            "General Information",
                            "Assigned Guards",
                            "Extra Guards",
                            "Branches",
                            "Pricing",
                            "Inventory",
                            "Contact Information",
                        ].map((tab, index) => (
                            <button
                                key={tab}
                                type="button"
                                className={`px-3 py-1.5 text-sm rounded-full border ${index === 0 ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                    <div>
                        <p className="text-sm text-gray-600">Total Branches</p>
                        <p className="text-2xl font-bold">{client.branches.length}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Active Deployments</p>
                        <p className="text-2xl font-bold">{totalDeployments}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Region</p>
                        <p className="text-lg font-medium">{client.region?.name || "—"}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">City</p>
                        <p className="text-lg font-medium">{client.city || "—"}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Branches */}
                    <div className="bg-white rounded-lg border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Building className="h-5 w-5" />
                                Branches ({client.branches.length})
                            </h2>
                            <Link
                                href={`/clients/${client.id}/branches/new`}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                                + Add Branch
                            </Link>
                        </div>
                        {client.branches.length > 0 ? (
                            <div className="space-y-3">
                                {client.branches.map((branch) => (
                                    <div key={branch.id} className="border rounded-lg p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-medium">{branch.name}</h3>
                                                <p className="text-sm text-gray-600 mt-1">{branch.address || "—"}</p>
                                                {branch.contactPerson && (
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Contact: {branch.contactPerson}
                                                        {branch.contactPhone && ` • ${branch.contactPhone}`}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-4 mt-2">
                                                    <span className="text-sm text-gray-500">
                                                        {branch.deployments.length} guard{branch.deployments.length !== 1 ? "s" : ""}
                                                    </span>
                                                    {branch.isHeadOffice && (
                                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                            Head Office
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Link
                                                href={`/clients/branches/${branch.id}`}
                                                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                            >
                                                View
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Building className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500 mb-4">No branches added yet</p>
                                <Link
                                    href={`/clients/${client.id}/branches/new`}
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add First Branch
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-lg border p-6">
                        <h2 className="text-xl font-semibold mb-4">Assigned Guards</h2>
                        <p className="text-sm text-gray-600 mb-4">Real-time assigned/deployed guard snapshot for this client.</p>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px]">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs uppercase text-gray-600">Guard</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase text-gray-600">Shift</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase text-gray-600">Contact</th>
                                        <th className="px-3 py-2 text-left text-xs uppercase text-gray-600">Start Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">
                                            Assigned guards will appear here.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Contact Information */}
                    <div className="bg-white rounded-lg border p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Contact
                        </h2>
                        <div className="space-y-4">
                            {client.email && (
                                <div>
                                    <p className="text-sm text-gray-600">Email</p>
                                    <p className="font-medium break-all">{client.email}</p>
                                </div>
                            )}
                            {client.headOfficeAddress && (
                                <div>
                                    <p className="text-sm text-gray-600">Head Office</p>
                                    <p className="font-medium">{client.headOfficeAddress}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tax & Legal */}
                    <div className="bg-white rounded-lg border p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Tax & Legal
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-600">NTN</p>
                                <p className="font-medium">{client.ntn || "—"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">STRN</p>
                                <p className="font-medium">{client.strn || "—"}</p>
                            </div>
                            {client.contractUrl && (
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Contract</p>
                                    <a
                                        href={client.contractUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-700 text-sm"
                                    >
                                        View Document →
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border p-6">
                        <h2 className="text-xl font-semibold mb-4">Pricing</h2>
                        <p className="text-sm text-gray-600 mb-4">Contractual pricing and billing configurations.</p>
                        <Link href={`/clients/pricing`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            Configure Pricing →
                        </Link>
                    </div>

                    <div className="bg-white rounded-lg border p-6">
                        <h2 className="text-xl font-semibold mb-4">Inventory</h2>
                        <p className="text-sm text-gray-600 mb-4">Inventory assigned to this client will be listed here.</p>
                        <Link href={`/inventory/assign-item`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            Open Inventory Assignment →
                        </Link>
                    </div>

                    {/* Metadata */}
                    <div className="bg-white rounded-lg border p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Record Info
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-600">Branchless</p>
                                <p className="font-medium">{client.isBranchless ? "Yes" : "No"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Created</p>
                                <p className="font-medium">{formatDate(client.createdAt)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Last Updated</p>
                                <p className="font-medium">{formatDate(client.updatedAt)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
