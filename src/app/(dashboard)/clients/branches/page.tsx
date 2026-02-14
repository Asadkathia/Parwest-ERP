import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Building, MapPin, Building2, BriefcaseBusiness } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import StatusChip from "@/components/ui/status-chip"

export default async function BranchesPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const branches = await prisma.branch.findMany({
    include: {
      client: true,
      deployments: {
        where: { status: "ACTIVE" },
      },
    },
    orderBy: { name: "asc" },
  })

  const stats = {
    total: branches.length,
    headOffices: branches.filter((b) => b.isHeadOffice).length,
    cities: new Set(branches.map((b) => b.city).filter(Boolean)).size,
    withDeployments: branches.filter((b) => b.deployments.length > 0).length,
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="All Branches"
        subtitle="Manage all client branches across the system"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Branches" value={stats.total} icon={<Building className="h-5 w-5" />} tone="brand" />
        <StatCard label="Head Offices" value={stats.headOffices} icon={<Building2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Cities" value={stats.cities} icon={<MapPin className="h-5 w-5" />} tone="warning" />
        <StatCard label="With Deployments" value={stats.withDeployments} icon={<BriefcaseBusiness className="h-5 w-5" />} tone="danger" />
      </div>

      <section className="ui-card overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Branch Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Code</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">City</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Province</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Deployments</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {branches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                  No branches found. Branches will appear here once clients add them.
                </td>
              </tr>
            ) : (
              branches.map((branch) => (
                <tr key={branch.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/clients/${branch.clientId}`} className="font-medium text-[var(--brand)] hover:underline">
                      {branch.client.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text)]">{branch.name}</span>
                      {branch.isHeadOffice ? <StatusChip label="Head Office" variant="success" /> : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{branch.code || "—"}</td>
                  <td className="px-6 py-4 text-sm">{branch.city || "—"}</td>
                  <td className="px-6 py-4 text-sm">{branch.province || "—"}</td>
                  <td className="px-6 py-4 text-sm">{branch.client.type}</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusChip label={String(branch.deployments.length)} variant="neutral" />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link href={`/clients/branches/${branch.id}`} className="text-[var(--brand)] hover:underline">
                      View Branch
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
