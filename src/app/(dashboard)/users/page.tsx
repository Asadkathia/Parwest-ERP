import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Users as UsersIcon, UserCheck, UserX } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import FilterBar from "@/components/ui/filter-bar"
import StatusChip from "@/components/ui/status-chip"

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const users = await prisma.user.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      role: true,
    },
  })

  const stats = {
    total: await prisma.user.count(),
    active: await prisma.user.count({ where: { status: "ACTIVE" } }),
    inactive: await prisma.user.count({ where: { status: "INACTIVE" } }),
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

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Users" value={stats.total} icon={<UsersIcon className="h-5 w-5" />} tone="brand" />
        <StatCard label="Active" value={stats.active} icon={<UserCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Inactive" value={stats.inactive} icon={<UserX className="h-5 w-5" />} tone="warning" />
      </div>

      <FilterBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Search by name or email..." className="ui-input" />
          <select className="ui-select">
            <option value="">All Roles</option>
          </select>
          <select className="ui-select">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </FilterBar>

      <section className="ui-card overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-[var(--surface-muted)]">
                <td className="px-6 py-4 text-sm font-medium text-[var(--text)]">{user.name}</td>
                <td className="px-6 py-4 text-sm text-[var(--text)]">{user.email}</td>
                <td className="px-6 py-4 text-sm text-[var(--text)]">{user.role?.name || "—"}</td>
                <td className="px-6 py-4 text-sm">
                  <StatusChip label={user.status} variant={user.status === "ACTIVE" ? "success" : "warning"} />
                </td>
                <td className="px-6 py-4 text-sm text-[var(--text-muted)]">—</td>
                <td className="px-6 py-4 text-sm">
                  <Link href={`/users/${user.id}`} className="text-[var(--brand)] hover:underline font-medium">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
