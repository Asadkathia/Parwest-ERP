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
import { CAPACITY_USAGE_RULES, countDeploymentsForRule } from "@/lib/branches/capacity"

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

  // Capacity card rows: show buckets where the role is meaningfully configured
  // — a positive limit is set, OR there's at least one deployment in that
  // bucket (so an over-capacity 0/used or a deployment under an uncapped role
  // is still surfaced). Hide the noise of 0/0 rows from branches that haven't
  // set up that role at all.
  const capacityRows = CAPACITY_USAGE_RULES.map((rule) => {
    const limit = (branch as Record<string, unknown>)[rule.field] as number | null | undefined
    const used = countDeploymentsForRule(rule, activeDeployments)
    return { rule, limit: typeof limit === "number" ? limit : null, used }
  }).filter((r) => (r.limit != null && r.limit > 0) || r.used > 0)

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
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Branch Status</p>
            <div className="mt-2">
              <Badge className={
                (branch.status === "ACTIVE")
                  ? "font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-transparent"
                  : "font-bold bg-secondary text-secondary-foreground border-transparent"
              }>{branch.status ?? "ACTIVE"}</Badge>
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
              <h3 className="text-base font-semibold text-[var(--text)] inline-flex items-center gap-2">
                <Building className="h-4 w-4" />
                Capacity
              </h3>
              <Link
                href={`/clients/branches/${branch.id}/edit#capacity`}
                className="text-sm text-[var(--brand)] hover:underline inline-flex items-center gap-1"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit Capacity
              </Link>
            </CardHeader>
            <CardContent>
              {capacityRows.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  No capacity limits configured. All roles are uncapped at this branch.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {capacityRows.map(({ rule, limit, used }) => {
                    const atCap = limit != null && used >= limit
                    const overCap = limit != null && used > limit
                    const tone = overCap
                      ? "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60"
                      : atCap
                      ? "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/60"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60"
                    return (
                      <div
                        key={rule.field}
                        className={`rounded-md border px-3 py-2 ${limit == null ? "bg-secondary text-secondary-foreground border-[var(--border)]" : tone}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                            {rule.label}
                          </span>
                          {atCap && limit != null ? (
                            <Badge className="bg-current/10 text-current border-current/30 text-[10px] font-semibold">
                              {overCap ? "OVER" : "FULL"}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-base font-semibold">
                          {used} <span className="opacity-60">/</span>{" "}
                          {limit == null ? <span className="opacity-60 text-sm">uncapped</span> : limit}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                EXTRA deployments are not counted toward the limit — they exist precisely because the cap was reached.
              </p>
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
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Client Status</p>
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
