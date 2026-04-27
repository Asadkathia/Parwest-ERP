import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import Link from "next/link"
import { Plus, Building2, Building, Users, Ban } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import FilterBar from "@/components/ui/filter-bar"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { applyManagerScope, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"
import { Suspense } from "react"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const canCreateClient = hasAction(session, "CLIENTS", "CREATE")
  const isSuperAdminUser = isSuperAdmin(session)
  const { regionId = "" } = await searchParams
  const needsRegionGate = isSuperAdminUser && !regionId

  const regions = await prisma.region
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])

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

  if (!needsRegionGate) try {
    // Resolve the active regionId filter: explicit URL param (SuperAdmin picker)
    // or the user's scoped region (regional users). If a regional user tries
    // to override their scope via the URL param, ignore the param and pin to
    // their assigned region — keeps the UI usable while preventing leakage.
    const requestedRegionId = regionId || undefined
    const paramDenied = managerScopeDenied(scope, { regionId: requestedRegionId })
    const activeRegionId = paramDenied
      ? scope?.regionId ?? undefined
      : requestedRegionId || scope?.regionId || undefined
    const regionFilter = activeRegionId ? { regionId: activeRegionId } : {}

    const [clientRows, total, active, inactive, totalBranches] = await Promise.all([
      prisma.client.findMany({
        where: regionFilter,
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
      prisma.client.count({ where: regionFilter }),
      prisma.client.count({ where: { status: "ACTIVE", ...regionFilter } }),
      prisma.client.count({ where: { status: "INACTIVE", ...regionFilter } }),
      prisma.branch.count({ where: activeRegionId ? { client: { regionId: activeRegionId } } : {} }),
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
      ? `${dbWarning} Scope: showing clients for your assigned region only.`
      : "Scope: showing clients for your assigned region only."
  }

  // Regional users see only their own region in the picker.
  const pickerRegions = scope?.regionId
    ? regions.filter((r) => r.id === scope.regionId)
    : regions

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Clients"
        subtitle="Manage clients and their branch locations"
        action={
          canCreateClient ? (
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
          ) : null
        }
      />
      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

      {needsRegionGate ? (
        <div className="ui-card p-10 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-base font-medium text-[var(--text)]">Select a region to view clients.</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Clients are region-scoped.</p>
        </div>
      ) : (
        <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Clients" value={stats.total} icon={<Users className="h-5 w-5" />} tone="brand" />
        <StatCard label="Active" value={stats.active} icon={<Building2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={stats.inactive} icon={<Ban className="h-5 w-5" />} tone="warning" />
        <StatCard label="Total Branches" value={stats.totalBranches} icon={<Building className="h-5 w-5" />} tone="brand" />
      </div>

      <FilterBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Suspense>
            <RegionUrlPicker
              regions={pickerRegions}
              locked={Boolean(scope?.regionId)}
              includeGlobalOption={!scope?.regionId}
            />
          </Suspense>
          <input type="text" placeholder="Search by client name or code..." className="ui-input" />
          <select className="ui-select">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
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
        </>
      )}
    </div>
  )
}
