import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit, MapPin, Building, User, Calendar, FileText } from "lucide-react"

export default async function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params

  const deployment = await prisma.deployment.findUnique({
    where: { id },
    include: {
      guard: true,
      client: true,
      branch: true,
    },
  })

  if (!deployment) notFound()

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/deployments"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Deployments
          </Link>
          <h1 className="text-3xl font-bold">Deployment Details</h1>
        </div>
        <div className="flex items-center gap-3">
          {deployment.status === "ACTIVE" && (
            <Link
              href={`/deployments/${deployment.id}/end`}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              End Deployment
            </Link>
          )}
          <Link
            href={`/deployments/${deployment.id}/edit`}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <Edit className="h-4 w-4" />
            Edit Deployment
          </Link>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{deployment.guard.name}</h2>
            <p className="text-gray-600 mt-1">
              Deployed at {deployment.client.name}{deployment.branch && ` - ${deployment.branch.name}`}
            </p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(deployment.status)}`}>
            {deployment.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-sm text-gray-600">Deployment Date</p>
            <p className="font-medium mt-1">{formatDate(deployment.deploymentDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Designation</p>
            <p className="font-medium mt-1">{deployment.designation || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Guard ID</p>
            <p className="font-medium mt-1">{deployment.guard.parwestId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Branch Code</p>
            <p className="font-medium mt-1">{deployment.branch?.code || "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Guard Information */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold">Guard Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <Link
                  href={`/guards/${deployment.guard.id}`}
                  className="font-medium text-blue-600 hover:text-blue-800 mt-1 block"
                >
                  {deployment.guard.name}
                </Link>
              </div>
              <div>
                <p className="text-sm text-gray-600">Parwest ID</p>
                <p className="font-medium mt-1">{deployment.guard.parwestId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">CNIC</p>
                <p className="font-medium mt-1">{deployment.guard.cnic}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium mt-1">{deployment.guard.phone || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium mt-1">{deployment.guard.email || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`px-3 py-1 rounded-full text-sm font-medium inline-block mt-1 ${getStatusColor(deployment.guard.status)}`}>
                  {deployment.guard.status}
                </span>
              </div>
            </div>
          </div>

          {/* Client & Branch Information */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold">Client & Branch Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Client</p>
                <Link
                  href={`/clients/${deployment.client.id}`}
                  className="font-medium text-blue-600 hover:text-blue-800 mt-1 block"
                >
                  {deployment.client.name}
                </Link>
              </div>
              <div>
                <p className="text-sm text-gray-600">Client Type</p>
                <p className="font-medium mt-1">{deployment.client.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Branch Name</p>
                <p className="font-medium mt-1">{deployment.branch?.name || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Branch Code</p>
                <p className="font-medium mt-1">{deployment.branch?.code || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">City</p>
                <p className="font-medium mt-1">{deployment.branch?.city || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Province</p>
                <p className="font-medium mt-1">{deployment.branch?.province || "—"}</p>
              </div>
              {deployment.branch?.address && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Branch Address</p>
                  <p className="font-medium mt-1">{deployment.branch.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          {deployment.notes && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold">Notes</h3>
              </div>
              <p className="text-gray-700">{deployment.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Deployment Timeline */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold">Timeline</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Deployment Date</p>
                <p className="font-medium mt-1">{formatDate(deployment.deploymentDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-sm text-gray-700 mt-1">{formatDate(deployment.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-sm text-gray-700 mt-1">{formatDate(deployment.updatedAt)}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href={`/guards/${deployment.guard.id}`}
                className="block w-full text-left px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                View Guard Profile
              </Link>
              <Link
                href={`/clients/${deployment.client.id}`}
                className="block w-full text-left px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                View Client Details
              </Link>
              <button
                className="w-full text-left px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50"
              >
                End Deployment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
