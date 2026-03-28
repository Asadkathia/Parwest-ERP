import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Users as UsersIcon, UserCheck, UserX } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import UsersTable from "@/components/users/UsersTable"

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect("/login")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session.user as any)?.role === "Admin"

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

  try {
    const [rows, total, active, inactive] = await Promise.all([
      prisma.user.findMany({
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
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "INACTIVE" } }),
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
          <Link href="/users/new" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add User
          </Link>
        }
      />
      {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

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
        isAdmin={isAdmin}
      />
    </div>
  )
}