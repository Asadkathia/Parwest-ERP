import { auth } from "@/lib/auth"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Shield, ShieldCheck, Clock3, ShieldX, AlertCircle } from "lucide-react"
import { hasAction } from "@/lib/api/permissions"
import StatCard from "@/components/shadcn/parwest-stat-card"
import GuardsListClient, {
  type GuardListRow,
} from "@/components/guards/GuardsListClient"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { applyManagerScope, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"

export default async function GuardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    officeId?: string
    regionId?: string
    designation?: string
  }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const canCreateGuard = hasAction(session, "GUARDS", "CREATE")

  const {
    q = "",
    status = "",
    officeId = "",
    regionId: regionIdParam = "",
    designation = "",
  } = await searchParams

  let guards: GuardListRow[] = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, pending: 0, inactive: 0 }
  const mockMode = isRuntimeMockEnabled()
  const scope = deriveManagerScope(session)

  let offices: { id: string; name: string }[] = []
  let designationOptions: { value: string; label: string }[] = []

  // If a regional user manually puts a different region in the URL, ignore it
  // and fall back to their scoped region.
  const paramDenied = managerScopeDenied(scope, { regionId: regionIdParam || undefined })
  const activeRegionId = paramDenied
    ? scope?.regionId ?? undefined
    : regionIdParam || scope?.regionId || undefined

  try {
    // Build where clause from filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}
    if (q.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: "insensitive" } },
        { cnic: { contains: q.trim(), mode: "insensitive" } },
        { parwestId: { contains: q.trim(), mode: "insensitive" } },
      ]
    }
    if (status) where.status = status
    if (designation) where.designation = designation
    if (officeId) where.regionalOfficeId = officeId
    if (activeRegionId) where.regionId = activeRegionId
    // Apply manager scope restrictions (overrides URL params for regional users).
    // SERVER-SIDE region scope enforcement — do NOT move to client.
    if (scope?.regionId) where.regionId = scope.regionId
    if (scope?.regionalOfficeIds?.length) where.regionalOfficeId = { in: scope.regionalOfficeIds }

    const [guardRows, total, active, pending, inactive, officeRows, designationTypes, distinctDesignations] = await Promise.all([
      prisma.guard.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        // Explicitly exclude `photoUrl` from the list query — it stores a
        // base64 blob and is perf-critical (see CLAUDE.md gotcha).
        select: {
          id: true,
          parwestId: true,
          name: true,
          cnic: true,
          phone: true,
          status: true,
          designation: true,
          salary: true,
          regionId: true,
          regionalOfficeId: true,
          regionalOffice: { select: { name: true } },
          supervisorAssignments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              supervisor: { select: { name: true } },
            },
          },
          deployments: {
            where: { status: "ACTIVE" },
            take: 1,
            orderBy: { deploymentDate: "desc" },
            select: {
              client: { select: { name: true } },
            },
          },
        },
      }),
      prisma.guard.count({ where: scope?.regionId ? { regionId: scope.regionId } : scope?.regionalOfficeIds?.length ? { regionalOfficeId: { in: scope.regionalOfficeIds } } : activeRegionId ? { regionId: activeRegionId } : {} }),
      prisma.guard.count({ where: { status: "ACTIVE", ...(scope?.regionId ? { regionId: scope.regionId } : scope?.regionalOfficeIds?.length ? { regionalOfficeId: { in: scope.regionalOfficeIds } } : activeRegionId ? { regionId: activeRegionId } : {}) } }),
      prisma.guard.count({ where: { status: "PENDING", ...(scope?.regionId ? { regionId: scope.regionId } : scope?.regionalOfficeIds?.length ? { regionalOfficeId: { in: scope.regionalOfficeIds } } : activeRegionId ? { regionId: activeRegionId } : {}) } }),
      prisma.guard.count({ where: { status: "INACTIVE", ...(scope?.regionId ? { regionId: scope.regionId } : scope?.regionalOfficeIds?.length ? { regionalOfficeId: { in: scope.regionalOfficeIds } } : activeRegionId ? { regionId: activeRegionId } : {}) } }),
      prisma.regionalOffice.findMany({
        where: activeRegionId ? { regionId: activeRegionId } : {},
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      // Canonical designation lookup (admin-managed table)
      prisma.guardDesignationType.findMany({
        where: { isActive: true },
        select: { name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      // Plus any designations actually present on guards in this scope —
      // covers historical / freeform values like "Security Guard"
      // (the default seeded by guard-create.ts) that may not exist in
      // the lookup table.
      prisma.guard.findMany({
        where: scope?.regionId
          ? { regionId: scope.regionId, designation: { not: null } }
          : scope?.regionalOfficeIds?.length
            ? { regionalOfficeId: { in: scope.regionalOfficeIds }, designation: { not: null } }
            : activeRegionId
              ? { regionId: activeRegionId, designation: { not: null } }
              : { designation: { not: null } },
        select: { designation: true },
        distinct: ["designation"],
      }),
    ])

    const designationSet = new Set<string>()
    for (const t of designationTypes) {
      if (t.name?.trim()) designationSet.add(t.name)
    }
    for (const g of distinctDesignations) {
      if (g.designation?.trim()) designationSet.add(g.designation)
    }
    designationOptions = Array.from(designationSet)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }))

    guards = guardRows.map((guard) => ({
      id: guard.id,
      parwestId: guard.parwestId,
      name: guard.name,
      cnic: guard.cnic,
      phone: guard.phone || null,
      status: guard.status,
      designation: guard.designation ?? null,
      salary: typeof guard.salary === "number" ? guard.salary : null,
      regionId: guard.regionId || null,
      regionalOfficeId: guard.regionalOfficeId || null,
      supervisorName: guard.supervisorAssignments?.[0]?.supervisor?.name ?? null,
      regionalOfficeName: guard.regionalOffice?.name ?? null,
      clientName: guard.deployments?.[0]?.client?.name ?? null,
    }))
    offices = officeRows
    stats.total = total
    stats.active = active
    stats.pending = pending
    stats.inactive = inactive
    if (mockMode) {
      dbWarning = "Mock mode enabled: showing guard data via runtime adapter."
    }
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

  guards = applyManagerScope(guards, scope, {
    regionId: (row) => row.regionId,
    regionalOfficeId: (row) => row.regionalOfficeId,
  })

  // Regional users only see their own office in the dropdown.
  if (scope?.regionalOfficeIds.length) {
    offices = offices.filter((o) => scope.regionalOfficeIds.includes(o.id))
  }

  if (scope) {
    dbWarning = dbWarning
      ? `${dbWarning} Scope: showing guards for your assigned region/office only.`
      : "Scope: showing guards for your assigned region/office only."
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Guards</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage security guards and their information</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canCreateGuard ? (
            <Link href="/guards/new" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Guard
            </Link>
          ) : null}
        </div>
      </div>

      {dbWarning ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{dbWarning}</AlertDescription></Alert> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Guards" value={stats.total} icon={<Shield className="h-5 w-5" />} tone="brand" />
        <StatCard label="Active" value={stats.active} icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Pending" value={stats.pending} icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Inactive" value={stats.inactive} icon={<ShieldX className="h-5 w-5" />} tone="danger" />
      </div>

      <GuardsListClient
        guards={guards}
        offices={offices}
        hideOfficePicker={Boolean(scope?.regionalOfficeIds?.length === 1)}
        canCreateGuard={canCreateGuard}
        designationOptions={designationOptions}
      />
    </div>
  )
}
