import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Building, MapPin, Building2, BriefcaseBusiness } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import StatusChip from "@/components/ui/status-chip"
import { deriveBranchModel } from "@/lib/branches/model"

export default async function BranchesPage({ searchParams }: { searchParams?: Promise<{ type?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const params = (await searchParams) || {}

  const branches = await prisma.branch.findMany({
    include: {
      client: true,
      deployments: {
        where: { status: "ACTIVE" },
      },
    },
    orderBy: { name: "asc" },
  })

  const filteredBranches = branches.filter((branch) => {
    if (!params.type || params.type === "ALL") return true
    return deriveBranchModel(branch.client?.type) === params.type
  })

  const stats = {
    total: branches.length,
    headOffices: branches.filter((b) => b.isHeadOffice).length,
    cities: new Set(branches.map((b) => b.city).filter(Boolean)).size,
    withDeployments: branches.filter((b) => (b.deployments?.length || 0) > 0).length,
    islamic: branches.filter((b) => deriveBranchModel(b.client?.type) === "ISLAMIC").length,
    conventional: branches.filter((b) => deriveBranchModel(b.client?.type) === "CONVENTIONAL").length,
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="All Branches"
        subtitle="Manage all client branches across the system"
      />

      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "All", type: "ALL" },
          { label: "Islamic", type: "ISLAMIC" },
          { label: "Conventional", type: "CONVENTIONAL" },
        ].map((item) => (
          <Link
            key={item.type}
            href={item.type === "ALL" ? "/clients/branches" : `/clients/branches?type=${item.type}`}
            className={`ui-chip ${(params.type || "ALL") === item.type ? "ui-chip-success" : "ui-chip-neutral"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Branches" value={stats.total} icon={<Building className="h-5 w-5" />} tone="brand" />
        <StatCard label="Head Offices" value={stats.headOffices} icon={<Building2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Cities" value={stats.cities} icon={<MapPin className="h-5 w-5" />} tone="warning" />
        <StatCard label="With Deployments" value={stats.withDeployments} icon={<BriefcaseBusiness className="h-5 w-5" />} tone="danger" />
        <StatCard label="Islamic Branches" value={stats.islamic} icon={<Building className="h-5 w-5" />} tone="success" />
        <StatCard label="Conventional Branches" value={stats.conventional} icon={<Building2 className="h-5 w-5" />} tone="brand" />
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
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Branch Model</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Deployments</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredBranches.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-muted)]">
                  No branches found. Branches will appear here once clients add them.
                </td>
              </tr>
            ) : (
              filteredBranches.map((branch) => (
                <tr key={branch.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-6 py-4 text-sm">
                    {branch.client?.id ? (
                      <Link href={`/clients/${branch.clientId}`} className="font-medium text-[var(--brand)] hover:underline">
                        {branch.client.name || "Unknown Client"}
                      </Link>
                    ) : (
                      <span className="text-[var(--text-muted)]">Unknown Client</span>
                    )}
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
                  <td className="px-6 py-4 text-sm">{branch.client?.type || "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <StatusChip
                      label={deriveBranchModel(branch.client?.type)}
                      variant={deriveBranchModel(branch.client?.type) === "ISLAMIC" ? "warning" : "neutral"}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <StatusChip label={String(branch.deployments?.length || 0)} variant="neutral" />
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
