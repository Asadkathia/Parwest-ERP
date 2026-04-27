import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import { deriveManagerScope } from "@/lib/access/scope"
import BranchForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function NewBranchPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "CLIENTS", "CREATE")) redirect("/clients")

    const { id } = await params

    const scope = deriveManagerScope(session)
    const viewerRegionId = scope?.regionId ?? null
    const viewerRegionalOfficeId = scope?.regionalOfficeIds.length === 1 ? scope.regionalOfficeIds[0] : null

    const [client, regions] = await Promise.all([
        prisma.client.findUnique({
            where: { id },
            select: { id: true, name: true, regionId: true, regionalOfficeId: true, assignedManagerId: true },
        }),
        prisma.region.findMany({
            where: viewerRegionId ? { id: viewerRegionId } : undefined,
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }).catch(() => []),
    ])

    if (!client) notFound()

    return (
        <div className="space-y-6">
            <SectionTitle title="Add New Branch" subtitle={`Add a new branch for ${client.name}`} />
            <BranchForm
                clientId={client.id}
                clientName={client.name}
                regions={regions}
                defaultRegionId={client.regionId}
                defaultRegionalOfficeId={client.regionalOfficeId}
                defaultManagerId={client.assignedManagerId}
                isSuperAdmin={isSuperAdmin(session)}
                viewerRegionId={viewerRegionId}
                viewerRegionalOfficeId={viewerRegionalOfficeId}
            />
        </div>
    )
}
