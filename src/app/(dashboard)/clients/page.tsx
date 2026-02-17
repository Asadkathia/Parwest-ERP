import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Building2, Building, Users, Ban } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import FilterBar from "@/components/ui/filter-bar"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { isMockEnabled } from "@/lib/mockData"
import { mockClientsList } from "@/lib/mockData/clients"
import { applyManagerScope, deriveManagerScope } from "@/lib/access/scope"

export default async function ClientsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  let clients: Array<{
    id: string
    name: string
    type: string
    city: string | null
    status: string
    regionId: string | null
    branchCount: number
  }> = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, inactive: 0, totalBranches: 0 }
  const mockMode = isMockEnabled()
  const scope = deriveManagerScope(session)

  if (mockMode) {
    clients = mockClientsList.slice(0, 20)
    stats.total = clients.length
    stats.active = clients.filter((c) => c.status === "ACTIVE").length
    stats.inactive = clients.filter((c) => c.status === "INACTIVE").length
    stats.totalBranches = clients.reduce((sum, c) => sum + c.branchCount, 0)
    dbWarning = "Mock mode enabled: showing client fallback data."
  } else {
    try {
      const [clientRows, total, active, inactive, totalBranches] = await Promise.all([
        prisma.client.findMany({
          take: 20,
          orderBy: { createdAt: "desc" },
        }),
        prisma.client.count(),
        prisma.client.count({ where: { status: "ACTIVE" } }),
        prisma.client.count({ where: { status: "INACTIVE" } }),
        prisma.branch.count(),
      ])
      clients = clientRows.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        city: c.city,
        status: c.status,
        regionId: c.regionId,
        branchCount: 0,
      }))
      stats.total = total
      stats.active = active
      stats.inactive = inactive
      stats.totalBranches = totalBranches
    } catch (error) {
      clients = mockClientsList.slice(0, 20)
      stats.total = clients.length
      stats.active = clients.filter((c) => c.status === "ACTIVE").length
      stats.inactive = clients.filter((c) => c.status === "INACTIVE").length
      stats.totalBranches = clients.reduce((sum, c) => sum + c.branchCount, 0)

      if (isPrismaMissingSchemaError(error)) {
        dbWarning = "Database schema is not fully migrated yet. Showing fallback client mock data."
      } else {
        dbWarning = `Unable to load client data (${toErrorMessage(error, "Unknown database error")}). Showing fallback mock data.`
      }
      console.error("ClientsPage query failed:", error)
    }
  }

  clients = applyManagerScope(clients, scope, {
    regionId: (row) => row.regionId,
  })
  if (scope) {
    dbWarning = dbWarning
      ? `${dbWarning} Manager scope active: showing clients for your region only.`
      : "Manager scope active: showing clients for your region only."
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Clients"
        subtitle="Manage clients and their branch locations"
        action={
          <Link href="/clients/new" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        }
      />
      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Clients" value={stats.total} icon={<Users className="h-5 w-5" />} tone="brand" />
        <StatCard label="Active" value={stats.active} icon={<Building2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={stats.inactive} icon={<Ban className="h-5 w-5" />} tone="warning" />
        <StatCard label="Total Branches" value={stats.totalBranches} icon={<Building className="h-5 w-5" />} tone="brand" />
      </div>

      <FilterBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Search by client name or code..." className="ui-input" />
          <select className="ui-select">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
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
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">City</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Branches</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Region</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)]">
                  <p className="text-base font-medium text-[var(--text)]">No clients found.</p>
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-6 py-4 text-sm font-medium text-[var(--text)]">{client.name}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{client.type}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{client.city || "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{client.branchCount}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{client.regionId || "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusChip label={client.status} variant={client.status === "ACTIVE" ? "success" : "warning"} />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/clients/${client.id}`} className="text-[var(--brand)] hover:underline font-medium">
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
