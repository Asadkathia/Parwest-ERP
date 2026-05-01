/**
 * Parwest ERP — All Branches list page (Phase 4B follow-up reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * Server component that fetches scoped branch rows and hands them to the
 * shadcn DataTable client wrapper. Filter contract is preserved:
 *   ?type=ISLAMIC|CONVENTIONAL  ?status=ACTIVE|INACTIVE  ?regionId=...
 *
 * Region scope comes from `deriveManagerScope(session)` — overridable region
 * filtering is provided by the global topbar region picker (the inline
 * `RegionUrlPicker` from the legacy page is intentionally removed).
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { Building, MapPin, Building2, BriefcaseBusiness } from "lucide-react"
import StatCard from "@/components/shadcn/parwest-stat-card"
import { deriveBranchModel } from "@/lib/branches/model"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import BranchesListClient, { type BranchListRow } from "@/components/clients/BranchesListClient"

export default async function BranchesPage({
    searchParams,
}: {
    searchParams?: Promise<{ type?: string; status?: string; regionId?: string }>
}) {
    const session = await auth()
    if (!session) redirect("/login")
    const params = (await searchParams) || {}

    const scope = deriveManagerScope(session)
    const paramDenied = managerScopeDenied(scope, { regionId: params.regionId })
    const activeRegionId = paramDenied
        ? scope?.regionId ?? undefined
        : params.regionId || scope?.regionId || undefined

    const branches = await prisma.branch.findMany({
        where: activeRegionId ? { client: { is: { regionId: activeRegionId } } } : {},
        include: {
            client: {
                include: { region: { select: { name: true } } },
            },
            deployments: {
                where: { status: "ACTIVE" },
            },
        },
        orderBy: { name: "asc" },
    })

    const filteredByType = branches.filter((branch) => {
        if (!params.type || params.type === "ALL") return true
        return deriveBranchModel(branch.client?.type) === params.type
    })

    const filteredRows: BranchListRow[] = filteredByType
        .filter((branch) => {
            if (!params.status) return true
            return (branch.status ?? "").toUpperCase() === params.status.toUpperCase()
        })
        .map((branch) => ({
            id: branch.id,
            clientId: branch.clientId,
            clientName: branch.client?.name ?? "Unknown Client",
            name: branch.name,
            code: branch.code,
            address: branch.address,
            city: branch.city,
            province: branch.province,
            regionName: branch.client?.region?.name ?? null,
            branchModel: deriveBranchModel(branch.client?.type) as "CONVENTIONAL" | "ISLAMIC",
            deploymentCount: branch.deployments?.length ?? 0,
            isHeadOffice: branch.isHeadOffice,
            status: branch.status ?? "ACTIVE",
        }))

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
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"All Branches"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage all client branches across the system"}</p></div></div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total Branches" value={stats.total} icon={<Building className="h-5 w-5" />} tone="brand" />
                <StatCard label="Head Offices" value={stats.headOffices} icon={<Building2 className="h-5 w-5" />} tone="success" />
                <StatCard label="Cities" value={stats.cities} icon={<MapPin className="h-5 w-5" />} tone="warning" />
                <StatCard label="With Deployments" value={stats.withDeployments} icon={<BriefcaseBusiness className="h-5 w-5" />} tone="danger" />
                <StatCard label="Islamic Branches" value={stats.islamic} icon={<Building className="h-5 w-5" />} tone="success" />
                <StatCard label="Conventional Branches" value={stats.conventional} icon={<Building2 className="h-5 w-5" />} tone="brand" />
            </div>

            <BranchesListClient branches={filteredRows} />
        </div>
    )
}
