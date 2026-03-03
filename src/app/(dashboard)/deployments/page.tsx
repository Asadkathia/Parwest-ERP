import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, MapPin, Activity, PauseCircle } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import FilterBar from "@/components/ui/filter-bar"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { applyManagerScope, deriveManagerScope } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"

export default async function DeploymentsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  let deployments: Array<{
    id: string
    guardId: string
    clientId: string
    branchId: string | null
    deploymentDate: Date
    status: "ACTIVE" | "PENDING" | "INACTIVE" | string
    regionId?: string | null
    regionalOfficeId?: string | null
  }> = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, inactive: 0 }
  const mockMode = isRuntimeMockEnabled()
  const scope = deriveManagerScope(session)

  try {
    const [rows, total, active, inactive] = await Promise.all([
      prisma.deployment.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      prisma.deployment.count(),
      prisma.deployment.count({ where: { status: "ACTIVE" } }),
      prisma.deployment.count({ where: { status: "INACTIVE" } }),
    ])
    deployments = rows
    stats.total = total
    stats.active = active
    stats.inactive = inactive
    if (mockMode) {
      dbWarning = "Mock mode enabled: showing deployment data via runtime adapter."
    }
  } catch (error) {
    deployments = []
    stats.total = 0
    stats.active = 0
    stats.inactive = 0

    if (isPrismaMissingSchemaError(error)) {
      dbWarning = "Database schema is not fully migrated yet. Deployment data is unavailable."
    } else {
      dbWarning = `Unable to load deployment data (${toErrorMessage(error, "Unknown database error")}).`
    }
    console.error("DeploymentsPage query failed:", error)
  }

  deployments = applyManagerScope(deployments, scope, {
    regionId: (row) => row.regionId,
    regionalOfficeId: (row) => row.regionalOfficeId,
  })
  if (scope) {
    dbWarning = dbWarning
      ? `${dbWarning} Manager scope active: showing deployments for your region/regional office only.`
      : "Manager scope active: showing deployments for your region/regional office only."
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Deployments"
        subtitle="Manage guard deployments to client locations"
        action={
          <Link href="/deployments/new" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Deployment
          </Link>
        }
      />
      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Deployments" value={stats.total} icon={<MapPin className="h-5 w-5" />} tone="brand" />
        <StatCard label="Active" value={stats.active} icon={<Activity className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={stats.inactive} icon={<PauseCircle className="h-5 w-5" />} tone="warning" />
      </div>

      <FilterBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" className="ui-input" placeholder="Search by guard, client, branch..." />
          <select className="ui-select">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select className="ui-select">
            <option value="">All Clients</option>
          </select>
        </div>
      </FilterBar>

      <section className="ui-card overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Guard</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Branch</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Start Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">End Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {deployments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)]">
                  <p className="text-base font-medium text-[var(--text)]">No deployments found.</p>
                </td>
              </tr>
            ) : (
              deployments.map((deployment) => (
                <tr key={deployment.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{deployment.guardId || "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{deployment.clientId || "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{deployment.branchId || "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{new Date(deployment.deploymentDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">—</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusChip
                      label={deployment.status}
                      variant={deployment.status === "ACTIVE" ? "success" : deployment.status === "PENDING" ? "warning" : "neutral"}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/deployments/${deployment.id}`} className="text-[var(--brand)] hover:underline font-medium">
                      View
                    </Link>
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
