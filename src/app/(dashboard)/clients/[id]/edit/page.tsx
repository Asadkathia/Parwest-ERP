import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import { deriveManagerScope } from "@/lib/access/scope"
import ClientEditForm from "./form"
export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "CLIENTS", "UPDATE")) redirect("/clients")

    const { id } = await params

    const scope = deriveManagerScope(session)
    const viewerRegionId = scope?.regionId ?? null
    const viewerRegionalOfficeId = scope?.regionalOfficeIds.length === 1 ? scope.regionalOfficeIds[0] : null

    const [client, regions, supervisorAssignment] = await Promise.all([
        prisma.client.findUnique({ where: { id } }),
        prisma.region.findMany({
            where: viewerRegionId ? { id: viewerRegionId } : undefined,
            orderBy: { name: "asc" },
        }),
        prisma.clientSupervisorAssignment.findFirst({
            where: { clientId: id, branchId: null, status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            select: { supervisorId: true },
        }).catch(() => null),
    ])

    if (!client) notFound()

    return (
        <div className="space-y-6">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Edit Client"}</h2><p className="mt-1 text-sm text-muted-foreground">{(`Update client information for ${client.name}`)}</p></div></div>

            <ClientEditForm
                client={client}
                regions={regions}
                currentSupervisorId={supervisorAssignment?.supervisorId ?? null}
                isSuperAdmin={isSuperAdmin(session)}
                viewerRegionId={viewerRegionId}
                viewerRegionalOfficeId={viewerRegionalOfficeId}
            />
        </div>
    )
}
