import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, Edit, Mail, Building, FileText, Plus } from "lucide-react"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import SectionTitle from "@/components/ui/section-title"
import StatusChip from "@/components/ui/status-chip"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"

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

  const totalDeployments = client.branches.reduce((sum, branch) => sum + branch.deployments.length, 0)

  return (
    <div className="space-y-6">
      <SectionTitle
        title={client.name}
        subtitle="Client profile overview, branches, assignments, and compliance metadata"
        action={
          <div className="flex items-center gap-2">
            <Link href="/clients" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Link href={`/clients/${client.id}/branches/new`} className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Branch
            </Link>
            <Link href={`/clients/${client.id}/edit`} className="ui-btn ui-btn-primary inline-flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Client
            </Link>
          </div>
        }
      />

      <Card>
        <CardBody className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              {client.logoUrl ? (
                <img
                  src={client.logoUrl}
                  alt={client.name}
                  className="h-16 w-16 rounded-[var(--radius-md)] object-cover border border-[var(--border)]"
                />
              ) : (
                <div className="h-16 w-16 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]" />
              )}
              <div>
                <h1 className="text-2xl font-semibold text-[var(--text)]">{client.name}</h1>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{client.type}</p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <StatusChip label={client.status} variant={client.status === "ACTIVE" ? "success" : "warning"} />
              <ActionButton variant="secondary">Upload Picture</ActionButton>
              <button type="button" className="text-sm text-[var(--brand)] hover:underline">
                Change Status
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Total Branches</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{client.branches.length}</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Active Deployments</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{totalDeployments}</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Region</p>
              <p className="mt-2 text-base font-medium text-[var(--text)]">{client.region?.name || "—"}</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">City</p>
              <p className="mt-2 text-base font-medium text-[var(--text)]">{client.city || "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <Building className="h-4 w-4" />
                Branches ({client.branches.length})
              </h2>
              <Link href={`/clients/${client.id}/branches/new`} className="text-sm text-[var(--brand)] hover:underline">
                + Add Branch
              </Link>
            </CardHeader>
            <CardBody>
              {client.branches.length > 0 ? (
                <div className="space-y-3">
                  {client.branches.map((branch) => (
                    <div key={branch.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium text-[var(--text)]">{branch.name}</p>
                          <p className="text-sm text-[var(--text-muted)]">{branch.address || "—"}</p>
                          {branch.contactPerson ? (
                            <p className="text-sm text-[var(--text-muted)]">
                              Contact: {branch.contactPerson}
                              {branch.contactPhone ? ` • ${branch.contactPhone}` : ""}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <StatusChip
                              label={`${branch.deployments.length} deployment${branch.deployments.length !== 1 ? "s" : ""}`}
                              variant="neutral"
                            />
                            {branch.isHeadOffice ? <StatusChip label="Head Office" variant="success" /> : null}
                          </div>
                        </div>
                        <Link href={`/clients/branches/${branch.id}`} className="text-sm text-[var(--brand)] hover:underline">
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center">
                  <p className="text-sm text-[var(--text-muted)]">No branches added yet.</p>
                  <div className="mt-3">
                    <Link href={`/clients/${client.id}/branches/new`} className="ui-btn ui-btn-primary inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add First Branch
                    </Link>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-[var(--text)]">Assigned Guards</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Real-time assigned/deployed guard snapshot for this client.</p>
            </CardHeader>
            <CardBody>
              <DataTable
                rows={[]}
                columns={[
                  { key: "guard", header: "Guard" },
                  { key: "shift", header: "Shift" },
                  { key: "contact", header: "Contact" },
                  { key: "startDate", header: "Start Date" },
                ]}
                getRowKey={(_row, index) => String(index)}
                emptyText="Assigned guards will appear here."
                searchable={false}
                density="compact"
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {client.email ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Email</p>
                  <p className="text-sm font-medium text-[var(--text)] break-all">{client.email}</p>
                </div>
              ) : null}
              {client.headOfficeAddress ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Head Office</p>
                  <p className="text-sm font-medium text-[var(--text)]">{client.headOfficeAddress}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tax & Legal
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">NTN</p>
                <p className="text-sm font-medium text-[var(--text)]">{client.ntn || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">STRN</p>
                <p className="text-sm font-medium text-[var(--text)]">{client.strn || "—"}</p>
              </div>
              {client.contractUrl ? (
                <a href={client.contractUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--brand)] hover:underline">
                  View Contract Document
                </a>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-[var(--text)]">Metadata</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Branchless</p>
                <p className="text-sm font-medium text-[var(--text)]">{client.isBranchless ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Created</p>
                <p className="text-sm font-medium text-[var(--text)]">{formatDate(client.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Last Updated</p>
                <p className="text-sm font-medium text-[var(--text)]">{formatDate(client.updatedAt)}</p>
              </div>
              <div className="pt-2">
                <Link href="/clients/pricing" className="text-sm text-[var(--brand)] hover:underline">
                  Configure Pricing
                </Link>
              </div>
              <div>
                <Link href="/inventory/assign-item" className="text-sm text-[var(--brand)] hover:underline">
                  Open Inventory Assignment
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
