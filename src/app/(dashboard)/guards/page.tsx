import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Shield, ShieldCheck, Clock3, ShieldX } from "lucide-react"
import { hasAction } from "@/lib/api/permissions"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import FilterBar from "@/components/ui/filter-bar"
import StatusChip from "@/components/ui/status-chip"
import GuardAvatar from "@/components/guards/GuardAvatar"
import GuardsFilterBar from "@/components/guards/GuardsFilterBar"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { applyManagerScope, deriveManagerScope } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { Suspense } from "react"

export default async function GuardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; officeId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const canCreateGuard = hasAction(session, "GUARDS", "CREATE")

  const { q = "", status = "", officeId = "" } = await searchParams

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
    regionalOfficeName: string | null
    photoUrl?: string | null
  }> = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, pending: 0, inactive: 0 }
  const mockMode = isRuntimeMockEnabled()
  const scope = deriveManagerScope(session)

  let offices: { id: string; name: string }[] = []

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
    if (officeId) where.regionalOfficeId = officeId
    // Apply manager scope restrictions
    if (scope?.regionId) where.regionId = scope.regionId
    if (scope?.regionalOfficeIds?.length) where.regionalOfficeId = scope.regionalOfficeIds[0]

    const [guardRows, total, active, pending, inactive, officeRows] = await Promise.all([
      prisma.guard.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          regionalOffice: { select: { name: true } },
          supervisorAssignments: {
            where: { status: "ACTIVE" },
            take: 1,
            include: { supervisor: { select: { name: true } } },
          },
        },
      }),
      prisma.guard.count({ where: scope?.regionId ? { regionId: scope.regionId } : scope?.regionalOfficeIds?.length ? { regionalOfficeId: { in: scope.regionalOfficeIds } } : {} }),
      prisma.guard.count({ where: { status: "ACTIVE", ...(scope?.regionId ? { regionId: scope.regionId } : scope?.regionalOfficeIds?.length ? { regionalOfficeId: { in: scope.regionalOfficeIds } } : {}) } }),
      prisma.guard.count({ where: { status: "PENDING", ...(scope?.regionId ? { regionId: scope.regionId } : scope?.regionalOfficeIds?.length ? { regionalOfficeId: { in: scope.regionalOfficeIds } } : {}) } }),
      prisma.guard.count({ where: { status: "INACTIVE", ...(scope?.regionId ? { regionId: scope.regionId } : scope?.regionalOfficeIds?.length ? { regionalOfficeId: { in: scope.regionalOfficeIds } } : {}) } }),
      prisma.regionalOffice.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ])

    guards = guardRows.map((guard) => ({
      id: guard.id,
      parwestId: guard.parwestId,
      name: guard.name,
      cnic: guard.cnic,
      phone: guard.phone || null,
      status: guard.status,
      regionId: guard.regionId || null,
      regionalOfficeId: guard.regionalOfficeId || null,
      supervisorName: guard.supervisorAssignments?.[0]?.supervisor?.name ?? null,
      regionalOfficeName: guard.regionalOffice?.name ?? null,
      photoUrl: guard.photoUrl ?? null,
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

  if (scope) {
    dbWarning = dbWarning
      ? `${dbWarning} Manager scope active: showing data for your region/regional office only.`
      : "Manager scope active: showing data for your region/regional office only."
  }

  const statusColor = (s: string): import("@/components/ui/status-chip").ChipVariant => {
    if (s === "ACTIVE") return "success"
    if (s === "PRESENT") return "success"
    if (s === "PENDING") return "warning"
    return "neutral"
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Guards"
        subtitle="Manage security guards and their information"
        action={
          canCreateGuard ? (
            <Link href="/guards/new" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Guard
            </Link>
          ) : null
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
        <Suspense>
          <GuardsFilterBar offices={offices} />
        </Suspense>
      </FilterBar>

      <div className="text-xs text-gray-500 -mt-4">
        {guards.length} guard{guards.length !== 1 ? "s" : ""} found
        {q || status || officeId ? " (filtered)" : ""}
      </div>

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
                  <td className="px-6 py-4 text-sm text-[var(--text)]">{guard.regionalOfficeName || "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusChip label={guard.status} variant={statusColor(guard.status)} />
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