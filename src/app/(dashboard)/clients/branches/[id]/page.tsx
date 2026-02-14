import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit, Building, MapPin, Phone, Mail, User, Calendar } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import StatusChip from "@/components/ui/status-chip"
import DataTable from "@/components/shared/DataTable"

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

  const activeDeployments = branch.deployments.filter((d) => d.status === "ACTIVE")

  return (
    <div className="space-y-6">
      <SectionTitle
        title={branch.name}
        subtitle={branch.client.name}
        action={
          <div className="flex items-center gap-2">
            <Link href={`/clients/${branch.clientId}`} className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Link href={`/clients/branches/${branch.id}/edit`} className="ui-btn ui-btn-primary inline-flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Branch
            </Link>
          </div>
        }
      />

      <Card>
        <CardBody className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Branch Code</p>
            <p className="mt-2 text-base font-semibold text-[var(--text)]">{branch.code || "—"}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">City</p>
            <p className="mt-2 text-base font-semibold text-[var(--text)]">{branch.city || "—"}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Province</p>
            <p className="mt-2 text-base font-semibold text-[var(--text)]">{branch.province || "—"}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Active Deployments</p>
            <p className="mt-2 text-base font-semibold text-emerald-700">{activeDeployments.length}</p>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location Information
              </h3>
            </CardHeader>
            <CardBody className="space-y-4">
              {branch.address ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Address</p>
                  <p className="text-sm font-medium text-[var(--text)]">{branch.address}</p>
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">City</p>
                  <p className="text-sm font-medium text-[var(--text)]">{branch.city || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Province</p>
                  <p className="text-sm font-medium text-[var(--text)]">{branch.province || "—"}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </h3>
            </CardHeader>
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Contact Person</p>
                <p className="text-sm font-medium text-[var(--text)]">{branch.contactPerson || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Phone</p>
                <p className="text-sm font-medium text-[var(--text)] inline-flex items-center gap-2">
                  {branch.contactPhone ? <Phone className="h-4 w-4 text-[var(--text-muted)]" /> : null}
                  {branch.contactPhone || "—"}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Email</p>
                {branch.contactEmail ? (
                  <a href={`mailto:${branch.contactEmail}`} className="text-sm font-medium text-[var(--brand)] inline-flex items-center gap-2 hover:underline">
                    <Mail className="h-4 w-4" />
                    {branch.contactEmail}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-[var(--text)]">—</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text)]">Deployments ({branch.deployments.length})</h3>
              <Link href={`/deployments/new?clientId=${branch.clientId}&branchId=${branch.id}`} className="text-sm text-[var(--brand)] hover:underline">
                + Add Deployment
              </Link>
            </CardHeader>
            <CardBody>
              <DataTable
                rows={branch.deployments}
                columns={[
                  {
                    key: "guard",
                    header: "Guard",
                    render: (deployment) => (
                      <Link href={`/guards/${deployment.guard.id}`} className="font-medium text-[var(--brand)] hover:underline">
                        {deployment.guard.name}
                      </Link>
                    ),
                  },
                  { key: "parwestId", header: "Parwest ID", render: (deployment) => deployment.guard.parwestId },
                  { key: "designation", header: "Designation", render: (deployment) => deployment.designation || "—" },
                  {
                    key: "status",
                    header: "Status",
                    render: (deployment) => (
                      <StatusChip label={deployment.status} variant={deployment.status === "ACTIVE" ? "success" : "warning"} />
                    ),
                  },
                  { key: "date", header: "Since", render: (deployment) => formatDate(deployment.deploymentDate) },
                  {
                    key: "view",
                    header: "View",
                    render: (deployment) => (
                      <Link href={`/deployments/${deployment.id}`} className="text-[var(--brand)] hover:underline">
                        Open
                      </Link>
                    ),
                  },
                ]}
                getRowKey={(row) => row.id}
                emptyText="No deployments at this branch yet."
                searchable={false}
                density="compact"
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <Building className="h-4 w-4" />
                Client
              </h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Name</p>
                <Link href={`/clients/${branch.client.id}`} className="text-sm font-medium text-[var(--brand)] hover:underline">
                  {branch.client.name}
                </Link>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Type</p>
                <p className="text-sm font-medium text-[var(--text)]">{branch.client.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Status</p>
                <StatusChip label={branch.client.status} variant={branch.client.status === "ACTIVE" ? "success" : "warning"} />
              </div>
              {branch.isHeadOffice ? <StatusChip label="Head Office" variant="success" /> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)]">Quick Stats</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Total Deployments</span>
                <span className="font-semibold text-[var(--text)]">{branch.deployments.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Active</span>
                <span className="font-semibold text-emerald-700">{activeDeployments.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Inactive</span>
                <span className="font-semibold text-[var(--text)]">{branch.deployments.length - activeDeployments.length}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Information
              </h3>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div>
                <p className="text-[var(--text-muted)]">Created</p>
                <p className="font-medium text-[var(--text)]">{formatDate(branch.createdAt)}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)]">Last Updated</p>
                <p className="font-medium text-[var(--text)]">{formatDate(branch.updatedAt)}</p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
