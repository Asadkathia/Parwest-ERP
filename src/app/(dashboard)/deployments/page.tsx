import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, MapPin, Activity, PauseCircle, Clock, RefreshCw, ShieldOff } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { applyManagerScope, deriveManagerScope } from "@/lib/access/scope"

type DeploymentRow = {
  id: string
  status: string
  shiftType: string
  designation: string
  deploymentDate: Date
  endDate: Date | null
  deploymentType: string | null
  deploymentNature: string | null
  deployedByName: string | null
  regionalOfficeId: string
  guard: { id: string; parwestId: string; name: string; phone: string | null; photoUrl: string | null }
  client: { id: string; name: string }
  branch: { id: string; name: string; city: string | null } | null
  regionalOffice: { id: string; name: string }
}

export default async function DeploymentsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  let deployments: DeploymentRow[] = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, inactive: 0 }
  const scope = deriveManagerScope(session)

  try {
    const [rows, total, active, inactive] = await Promise.all([
      prisma.deployment.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          guard: {
            select: { id: true, parwestId: true, name: true, phone: true, photoUrl: true },
          },
          client: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, city: true } },
          regionalOffice: { select: { id: true, name: true } },
        },
      }),
      prisma.deployment.count(),
      prisma.deployment.count({ where: { status: "ACTIVE" } }),
      prisma.deployment.count({ where: { status: "INACTIVE" } }),
    ])
    deployments = rows as DeploymentRow[]
    stats.total = total
    stats.active = active
    stats.inactive = inactive
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      dbWarning = "Database schema is not fully migrated yet. Deployment data is unavailable."
    } else {
      dbWarning = `Unable to load deployment data (${toErrorMessage(error, "Unknown database error")}).`
    }
    console.error("DeploymentsPage query failed:", error)
  }

  deployments = applyManagerScope(deployments, scope, {
    regionalOfficeId: (row) => row.regionalOfficeId,
  }) as DeploymentRow[]

  if (scope) {
    dbWarning = dbWarning
      ? `${dbWarning} Manager scope: showing your region only.`
      : "Manager scope: showing your region only."
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Deployments"
        subtitle="Manage guard deployments to client locations"
        action={
          <Link href="/guards/deploy" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Deploy Guard
          </Link>
        }
      />
      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Deployments" value={stats.total} icon={<MapPin className="h-5 w-5" />} tone="brand" />
        <StatCard label="Active" value={stats.active} icon={<Activity className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={stats.inactive} icon={<PauseCircle className="h-5 w-5" />} tone="warning" />
      </div>

      <section className="ui-card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Guard</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Client · Branch</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Shift</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Designation</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Start Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">End Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {deployments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                  <p className="text-base font-medium text-[var(--text)]">No deployments found.</p>
                </td>
              </tr>
            ) : (
              deployments.map((dep) => (
                <tr key={dep.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                  {/* Guard */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {dep.guard.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={dep.guard.photoUrl}
                          alt={dep.guard.name}
                          className="h-8 w-8 rounded-full object-cover border border-[var(--border)] shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[var(--brand)]/10 border border-[var(--border)] flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[var(--brand)]">
                            {dep.guard.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">{dep.guard.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{dep.guard.parwestId}</p>
                      </div>
                    </div>
                  </td>

                  {/* Client · Branch */}
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[var(--text)]">{dep.client.name}</p>
                    {dep.branch ? (
                      <p className="text-xs text-[var(--text-muted)]">
                        {dep.branch.name}{dep.branch.city ? `, ${dep.branch.city}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">—</p>
                    )}
                  </td>

                  {/* Shift */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      dep.shiftType === "DAY"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200"
                    }`}>
                      <Clock className="h-3 w-3" />
                      {dep.shiftType}
                    </span>
                  </td>

                  {/* Designation */}
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{dep.designation || "—"}</td>

                  {/* Start Date */}
                  <td className="px-4 py-3 text-sm text-[var(--text)] whitespace-nowrap">
                    {new Date(dep.deploymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>

                  {/* End Date */}
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">
                    {dep.endDate
                      ? new Date(dep.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusChip
                      label={dep.status}
                      variant={dep.status === "ACTIVE" ? "success" : dep.status === "PENDING" ? "warning" : "neutral"}
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/deployments/${dep.id}`}
                        className="text-xs text-[var(--brand)] hover:underline font-medium"
                      >
                        View
                      </Link>
                      {dep.status === "ACTIVE" ? (
                        <>
                          <span className="text-[var(--border)]">·</span>
                          <Link
                            href={`/deployments/${dep.id}/edit`}
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--brand)] font-medium inline-flex items-center gap-1"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Change
                          </Link>
                          <span className="text-[var(--border)]">·</span>
                          <Link
                            href={`/deployments/${dep.id}/end`}
                            className="text-xs text-red-500 hover:text-red-700 font-medium inline-flex items-center gap-1"
                          >
                            <ShieldOff className="h-3 w-3" />
                            Revoke
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}