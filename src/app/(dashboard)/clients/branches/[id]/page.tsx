import { auth } from "@/lib/auth"
import { Card, CardContent, CardHeader } from "@/components/shadcn/card"
import { Badge } from "@/components/shadcn/badge"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import Link from "next/link"
import { ArrowLeft, Edit, Building, MapPin, Phone, Mail, User, Calendar } from "lucide-react"
import { deriveBranchModel } from "@/lib/branches/model"
import BranchDeleteButton from "@/components/clients/BranchDeleteButton"

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

  const managerScope = deriveManagerScope(session)
  if (managerScope && managerScopeDenied(managerScope, { regionId: branch.client?.regionId ?? null })) {
    notFound()
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const deployments = branch.deployments || []
  const activeDeployments = deployments.filter((d) => d.status === "ACTIVE")
  const branchModel = deriveBranchModel(branch.client?.type)

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4 flex items-center gap-2"><div><h2 className="text-xl font-bold tracking-tight">{(branch.name)}</h2><p className="mt-1 text-sm text-muted-foreground">{(branch.client.name)}</p></div><div className="flex shrink-0 items-center gap-2">{(<div className="flex items-center gap-2">
            <Link href={`/clients/${branch.clientId}`} className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <Link href={`/clients/branches/${branch.id}/edit`} className="ui-btn ui-btn-primary inline-flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Branch
            </Link>
            <BranchDeleteButton
              branchId={branch.id}
              clientId={branch.clientId}
              branchName={branch.name}
              activeDeploymentCount={activeDeployments.length}
            />
          </div>)}</div></div>

      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Branch Model</p>
            <div className="mt-2">
              <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{branchModel}</Badge>
            </div>
          </div>
        </CardContent>
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
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </h3>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text)]">Deployments ({deployments.length})</h3>
              <Link href={`/deployments/new?clientId=${branch.clientId}&branchId=${branch.id}`} className="text-sm text-[var(--brand)] hover:underline">
                + Add Deployment
              </Link>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Guard</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Parwest ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Designation</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Since</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {deployments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-muted)]">
                          No deployments at this branch yet.
                        </td>
                      </tr>
                    ) : (
                      deployments.map((deployment) => {
                        const guard = deployment.guard
                        return (
                        <tr key={deployment.id} className="hover:bg-[var(--surface-muted)]">
                          <td className="px-6 py-4 text-sm">
                            {guard?.id ? (
                              <Link href={`/guards/${guard.id}`} className="font-medium text-[var(--brand)] hover:underline">
                                {guard.name || "Unknown Guard"}
                              </Link>
                            ) : (
                              <span className="text-[var(--text-muted)]">Unknown Guard</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">{guard?.parwestId || "—"}</td>
                          <td className="px-6 py-4 text-sm">{deployment.designation || "—"}</td>
                          <td className="px-6 py-4 text-sm">
                            <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{deployment.status}</Badge>
                          </td>
                          <td className="px-6 py-4 text-sm">{formatDate(deployment.deploymentDate)}</td>
                          <td className="px-6 py-4 text-sm">
                            <Link href={`/deployments/${deployment.id}`} className="text-[var(--brand)] hover:underline">
                              Open
                            </Link>
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
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
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Name</p>
                {branch.client?.id ? (
                  <Link href={`/clients/${branch.client.id}`} className="text-sm font-medium text-[var(--brand)] hover:underline">
                    {branch.client.name || "Unknown Client"}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-[var(--text)]">Unknown Client</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Type</p>
                <p className="text-sm font-medium text-[var(--text)]">{branch.client?.type || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Status</p>
                <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{branch.client?.status || "UNKNOWN"}</Badge>
              </div>
              {branch.isHeadOffice ? <Badge className={"font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-transparent"}>{"Head Office"}</Badge> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)]">Quick Stats</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Total Deployments</span>
                <span className="font-semibold text-[var(--text)]">{deployments.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Active</span>
                <span className="font-semibold text-emerald-700">{activeDeployments.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Inactive</span>
                <span className="font-semibold text-[var(--text)]">{deployments.length - activeDeployments.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Information
              </h3>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-[var(--text-muted)]">Created</p>
                <p className="font-medium text-[var(--text)]">{formatDate(branch.createdAt)}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)]">Last Updated</p>
                <p className="font-medium text-[var(--text)]">{formatDate(branch.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
