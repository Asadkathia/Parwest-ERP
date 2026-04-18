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
import { applyManagerScope, deriveManagerScope } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"

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
    regionName: string | null
    branchCount: number
    contractCount: number
    currentRates: { guardType: string; rate: number }[]
  }> = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, inactive: 0, totalBranches: 0 }
  const mockMode = isRuntimeMockEnabled()
  const scope = deriveManagerScope(session)

  try {
    const [clientRows, total, active, inactive, totalBranches] = await Promise.all([
      prisma.client.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          region: { select: { name: true } },
          _count: { select: { branches: true, contracts: true } },
          contracts: {
            where: { isActive: true },
            select: {
              rates: {
                where: { isCurrentRate: true },
                select: { guardType: true, rate: true },
              },
            },
          },
        },
      }),
      prisma.client.count(),
      prisma.client.count({ where: { status: "ACTIVE" } }),
      prisma.client.count({ where: { status: "INACTIVE" } }),
      prisma.branch.count(),
    ])
    clients = clientRows.map((c) => {
      const ratesByType = new Map<string, number>()
      for (const contract of c.contracts) {
        for (const r of contract.rates) {
          const prev = ratesByType.get(r.guardType)
          if (prev == null || Number(r.rate) > prev) ratesByType.set(r.guardType, Number(r.rate))
        }
      }
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        city: c.city,
        status: c.status,
        regionId: c.regionId,
        regionName: c.region?.name ?? null,
        branchCount: c._count.branches,
        contractCount: c._count.contracts,
        currentRates: Array.from(ratesByType.entries()).map(([guardType, rate]) => ({
          guardType,
          rate,
        })),
      }
    })
    stats.total = total
    stats.active = active
    stats.inactive = inactive
    stats.totalBranches = totalBranches
    if (mockMode) {
      dbWarning = "Mock mode enabled: showing client data via runtime adapter."
    }
  } catch (error) {
    clients = []
    stats.total = 0
    stats.active = 0
    stats.inactive = 0
    stats.totalBranches = 0

    if (isPrismaMissingSchemaError(error)) {
      dbWarning = "Database schema is not fully migrated yet. Client data is unavailable."
    } else {
      dbWarning = `Unable to load client data (${toErrorMessage(error, "Unknown database error")}).`
    }
    console.error("ClientsPage query failed:", error)
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
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/clients/new?mode=branch" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Branch Client
            </Link>
            <Link href="/clients/new?mode=branchless" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Branchless Client
            </Link>
          </div>
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
        <table className="w-full min-w-[1200px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">City</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Branches</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Region</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Contracts</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Current Rates</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-muted)]">
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
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{client.regionName || "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text)]">
                    {client.contractCount === 0 ? (
                      <span className="text-[var(--text-muted)]">None</span>
                    ) : (
                      client.contractCount
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {client.currentRates.length === 0 ? (
                      <span className="text-[var(--text-muted)]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {client.currentRates.slice(0, 3).map((r, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 bg-[var(--surface-muted)] rounded px-2 py-0.5 text-xs"
                          >
                            <span className="font-medium">{r.guardType}</span>
                            <span className="text-[var(--text-muted)]">·</span>
                            <span>PKR {r.rate.toLocaleString()}</span>
                          </span>
                        ))}
                        {client.currentRates.length > 3 && (
                          <span className="text-xs text-[var(--text-muted)]">
                            +{client.currentRates.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
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
