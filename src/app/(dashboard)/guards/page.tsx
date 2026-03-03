import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Shield, ShieldCheck, Clock3, ShieldX } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import FilterBar from "@/components/ui/filter-bar"
import StatusChip from "@/components/ui/status-chip"
import GuardAvatar from "@/components/guards/GuardAvatar"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { mockGuardsList } from "@/lib/mockData/guards"
import { isMockEnabled } from "@/lib/mockData"
import { applyManagerScope, deriveManagerScope } from "@/lib/access/scope"

export default async function GuardsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  let guards: Array<{
    id: string
    parwestId: string
    name: string
    cnic: string
    phone: string | null
    status: string
    regionId: string | null
    regionalOfficeId: string | null
    supervisorName: string | null
    photoUrl?: string | null
  }> = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, pending: 0, inactive: 0 }
  const mockMode = isMockEnabled()
  const scope = deriveManagerScope(session)

  if (mockMode) {
    guards = mockGuardsList.slice(0, 20).map((guard, index) => ({
      id: guard.id,
      parwestId: guard.parwestId,
      name: guard.name,
      cnic: guard.cnic,
      phone: guard.phone || null,
      status: guard.status,
      regionId: null,
      regionalOfficeId: null,
      supervisorName: index % 2 === 0 ? "Fazal Mehdi" : "Muhammad Aslam",
      photoUrl: null,
    }))
    stats.total = guards.length
    stats.active = guards.filter((g) => g.status === "ACTIVE").length
    stats.pending = guards.filter((g) => g.status === "PENDING").length
    stats.inactive = guards.filter((g) => g.status === "INACTIVE").length
    dbWarning = "Mock mode enabled: showing guard fallback data."
  } else {
    try {
      const [guardRows, total, active, pending, inactive] = await Promise.all([
        prisma.guard.findMany({
          take: 20,
          orderBy: { createdAt: "desc" },
        }),
        prisma.guard.count(),
        prisma.guard.count({ where: { status: "ACTIVE" } }),
        prisma.guard.count({ where: { status: "PENDING" } }),
        prisma.guard.count({ where: { status: "INACTIVE" } }),
      ])
      guards = guardRows
        .map((guard) => ({ ...guard, supervisorName: null }))
        .map((guard) => ({ ...guard, regionalOfficeId: guard.regionalOfficeId || null }))
      stats.total = total
      stats.active = active
      stats.pending = pending
      stats.inactive = inactive
    } catch (error) {
      guards = []
      stats.total = 0
      stats.active = 0
      stats.pending = 0
      stats.inactive = 0

      if (isPrismaMissingSchemaError(error)) {
        dbWarning = "Database schema is not fully migrated yet. Guard data is unavailable."
      } else {
        dbWarning = `Unable to load guard data (${toErrorMessage(error, "Unknown database error")}).`
      }
      console.error("GuardsPage query failed:", error)
    }
  }

  guards = applyManagerScope(guards, scope, {
    regionId: (row) => row.regionId,
    regionalOfficeId: (row) => row.regionalOfficeId,
  })

  if (scope) {
    dbWarning = dbWarning
      ? `${dbWarning} Manager scope active: showing data for your region/regional office only.`
      : "Manager scope active: showing data for your region/regional office only."
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Guards"
        subtitle="Manage security guards and their information"
        action={
          <Link href="/guards/new" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Guard
          </Link>
        }
      />

      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Guards" value={stats.total} icon={<Shield className="h-5 w-5" />} tone="brand" />
        <StatCard label="Active" value={stats.active} icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Pending" value={stats.pending} icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Inactive" value={stats.inactive} icon={<ShieldX className="h-5 w-5" />} tone="danger" />
      </div>

      <FilterBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Search by name, CNIC, or Parwest ID..." className="ui-input" />
          <select className="ui-select">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </select>
          <select className="ui-select">
            <option value="">All Regions</option>
          </select>
        </div>
      </FilterBar>

      <section className="ui-card overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Parwest ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Photo</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">CNIC</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Supervisor</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Region</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {guards.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-muted)]">
                  <p className="text-base font-medium text-[var(--text)]">No guards found.</p>
                </td>
              </tr>
            ) : (
              guards.map((guard) => (
                <tr key={guard.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-6 py-4 text-sm font-medium text-[var(--text)]">{guard.parwestId}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">
                    <GuardAvatar guardId={guard.id} guardName={guard.name} initialUrl={guard.photoUrl} />
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{guard.name}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{guard.cnic}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{guard.phone || "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{guard.supervisorName || "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{guard.regionId || "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusChip
                      label={guard.status}
                      variant={guard.status === "ACTIVE" ? "success" : guard.status === "PENDING" ? "warning" : "neutral"}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/guards/${guard.id}`} className="text-[var(--brand)] hover:underline font-medium">
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
