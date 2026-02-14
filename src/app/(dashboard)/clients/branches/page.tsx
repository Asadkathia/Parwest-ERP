import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Building, MapPin, Building2, BriefcaseBusiness } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import DataTable from "@/components/shared/DataTable"
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

      <DataTable
        rows={branches}
        columns={[
          {
            key: "client",
            header: "Client",
            sortable: true,
            render: (branch) => (
              <Link href={`/clients/${branch.clientId}`} className="font-medium text-[var(--brand)] hover:underline">
                {branch.client.name}
              </Link>
            ),
          },
          {
            key: "name",
            header: "Branch Name",
            sortable: true,
            render: (branch) => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--text)]">{branch.name}</span>
                {branch.isHeadOffice ? <StatusChip label="Head Office" variant="success" /> : null}
              </div>
            ),
          },
          { key: "code", header: "Code", render: (branch) => branch.code || "—" },
          { key: "city", header: "City", render: (branch) => branch.city || "—", sortable: true },
          { key: "province", header: "Province", render: (branch) => branch.province || "—", sortable: true },
          { key: "clientType", header: "Type", render: (branch) => branch.client.type, sortable: true },
          {
            key: "deployments",
            header: "Deployments",
            render: (branch) => <StatusChip label={String(branch.deployments.length)} variant="neutral" />,
          },
          {
            key: "actions",
            header: "Actions",
            render: (branch) => (
              <Link href={`/clients/branches/${branch.id}`} className="text-[var(--brand)] hover:underline">
                View Branch
              </Link>
            ),
          },
        ]}
        getRowKey={(row) => row.id}
        emptyText="No branches found. Branches will appear here once clients add them."
        searchPlaceholder="Search branches..."
        stickyHeader
      />
    </div>
  )
}
