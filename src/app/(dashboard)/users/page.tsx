import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import { buildManagerScopeWhere, deriveRegionalScope } from "@/lib/access/scope"
import Link from "next/link"
import { Plus, Users as UsersIcon, UserCheck, UserX } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import UsersTable from "@/components/users/UsersTable"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"
import { Suspense } from "react"

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const superAdmin = isSuperAdmin(session)
  const scope = deriveRegionalScope(session)
  const canCreateUser = hasAction(session, "USERS", "CREATE")
  const canUpdateUser = hasAction(session, "USERS", "UPDATE")
  const canDeleteUser = hasAction(session, "USERS", "DELETE")

  const { regionId: urlRegionId = "" } = await searchParams
  const needsRegionGate = superAdmin && !urlRegionId

  const regions = await prisma.region
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])

  // Regional users see only their own region in the picker.
  const pickerRegions = scope?.regionId
    ? regions.filter((r) => r.id === scope.regionId)
    : regions

  type UserRow = {
    id: string
    name: string
    email: string
    status: string
    lastLoginAt: Date | null
    role: { name: string } | null
  }

  let users: UserRow[] = []
  let dbWarning = ""
  const stats = { total: 0, active: 0, inactive: 0 }

  if (!needsRegionGate) try {
    // Resolve the active regionId filter: explicit URL param (SuperAdmin picker)
    // or the user's scoped region (regional users via scope helpers).
    const scopeWhere = buildManagerScopeWhere(scope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" })
    const regionWhere = urlRegionId && superAdmin ? { regionId: urlRegionId } : {}
    const where = { ...scopeWhere, ...regionWhere }

    const [rows, total, active, inactive] = await Promise.all([
      prisma.user.findMany({
        where,
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          lastLoginAt: true,
          role: { select: { name: true } },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { status: "ACTIVE", ...where } }),
      prisma.user.count({ where: { status: "INACTIVE", ...where } }),
    ])
    users = rows
    stats.total = total
    stats.active = active
    stats.inactive = inactive
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) {
      dbWarning = "Database schema is not fully migrated yet. User data is temporarily unavailable."
    } else {
      dbWarning = `Unable to load user data: ${toErrorMessage(error, "Unknown database error")}`
    }
    console.error("UsersPage query failed:", error)
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Users"
        subtitle="Manage system users and their permissions"
        action={
          canCreateUser ? (
            <Link href="/users/new" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Link>
          ) : null
        }
      />
      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

      <section className="ui-card p-5">
        <Suspense>
          <RegionUrlPicker regions={pickerRegions} locked={Boolean(scope?.regionId)} />
        </Suspense>
      </section>

      {needsRegionGate ? (
        <div className="ui-card p-10 text-center">
          <UsersIcon className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-base font-medium text-[var(--text)]">Select a region to view users.</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Users are region-scoped. Choose a region above to load its users.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Total Users" value={stats.total} icon={<UsersIcon className="h-5 w-5" />} tone="brand" />
            <StatCard label="Active" value={stats.active} icon={<UserCheck className="h-5 w-5" />} tone="success" />
            <StatCard label="Inactive" value={stats.inactive} icon={<UserX className="h-5 w-5" />} tone="warning" />
          </div>

          <UsersTable
            initialUsers={users.map((u) => ({
              ...u,
              lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
            }))}
            isAdmin={superAdmin}
            canUpdate={canUpdateUser}
            canDelete={canDeleteUser}
          />
        </>
      )}
    </div>
  )
}