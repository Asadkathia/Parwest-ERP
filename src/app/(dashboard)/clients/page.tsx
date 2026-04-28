import { auth } from "@/lib/auth"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import Link from "next/link"
import { Plus, Building2, Building, Users, Ban, AlertCircle } from "lucide-react"
import StatCard from "@/components/shadcn/parwest-stat-card"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import ClientsListClient, {
  type ClientListRow,
} from "@/components/clients/ClientsListClient"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { applyManagerScope, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    regionId?: string
    q?: string
    status?: string
    type?: string
  }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const canCreateClient = hasAction(session, "CLIENTS", "CREATE")
  const {
    regionId = "",
    q = "",
    status: statusParam = "",
    type: typeParam = "",
  } = await searchParams

  let clients: ClientListRow[] = []
  let typeOptions: { value: string; label: string }[] = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, inactive: 0, totalBranches: 0 }
  const mockMode = isRuntimeMockEnabled()
  const scope = deriveManagerScope(session)

  try {
    // Resolve the active regionId filter: explicit URL param (driven by the
    // global topbar region picker) or the user's scoped region (regional
    // users). If a regional user tries to override their scope via the URL
    // param, ignore the param and pin to their assigned region — keeps the
    // UI usable while preventing leakage.
    const requestedRegionId = regionId || undefined
    const paramDenied = managerScopeDenied(scope, { regionId: requestedRegionId })
    const activeRegionId = paramDenied
      ? scope?.regionId ?? undefined
      : requestedRegionId || scope?.regionId || undefined

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}
    if (activeRegionId) where.regionId = activeRegionId
    if (statusParam) where.status = statusParam
    if (typeParam) where.type = typeParam
    if (q.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: "insensitive" } },
      ]
    }

    const countWhere = activeRegionId ? { regionId: activeRegionId } : {}

    const [clientRows, total, active, inactive, totalBranches, clientTypes] = await Promise.all([
      prisma.client.findMany({
        where,
        take: 200,
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
      prisma.client.count({ where: countWhere }),
      prisma.client.count({ where: { status: "ACTIVE", ...countWhere } }),
      prisma.client.count({ where: { status: "INACTIVE", ...countWhere } }),
      prisma.branch.count({ where: activeRegionId ? { client: { regionId: activeRegionId } } : {} }),
      prisma.clientType.findMany({
        orderBy: { label: "asc" },
        select: { name: true, label: true },
      }),
    ])
    typeOptions = clientTypes.map((t) => ({ value: t.name, label: t.label }))
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

  return (
    <div className="space-y-6">
      {/* TODO(phase-5): replace SectionTitle with shadcn header primitive
          when section-title is migrated module-wide. */}
      <div className="mb-4 flex items-start justify-between gap-4 flex flex-wrap items-center gap-2"><div><h2 className="text-xl font-bold tracking-tight">{"Clients"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage clients and their branch locations"}</p></div><div className="flex shrink-0 items-center gap-2">{(canCreateClient ? (
            <PermissionGate module="CLIENTS" action="CREATE" mode="hide">
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
            </PermissionGate>
          ) : null)}</div></div>
      {/* TODO(phase-5): replace InlineAlert with shadcn `Alert` when this
          legacy banner is migrated module-wide. */}
      {dbWarning ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{dbWarning}</AlertDescription></Alert> : null}

      {/* TODO(phase-5): swap StatCard for shadcn KPI card primitive
          when StatCard is migrated module-wide. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Clients" value={stats.total} icon={<Users className="h-5 w-5" />} tone="brand" />
        <StatCard label="Active" value={stats.active} icon={<Building2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={stats.inactive} icon={<Ban className="h-5 w-5" />} tone="warning" />
        <StatCard label="Total Branches" value={stats.totalBranches} icon={<Building className="h-5 w-5" />} tone="brand" />
      </div>

      <ClientsListClient
        clients={clients}
        canCreateClient={canCreateClient}
        typeOptions={typeOptions}
      />
    </div>
  )
}
