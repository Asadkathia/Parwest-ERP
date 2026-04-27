import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import GuardEditForm from "./form"
import { buildManagerScopeWhere, deriveManagerScope } from "@/lib/access/scope"

export default async function EditGuardPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "GUARDS", "UPDATE")) redirect("/guards")

    const { id } = await params

    const scope = deriveManagerScope(session)
    const lockedRegionId = scope?.regionId ?? null
    const lockedRegionalOfficeId =
        scope && scope.regionalOfficeIds.length === 1 ? scope.regionalOfficeIds[0] : null

    const regionWhere = scope?.regionId ? { id: scope.regionId } : {}
    const officeWhere = buildManagerScopeWhere(scope, { regionId: "regionId", regionalOfficeId: "id" })

    const [guard, regions, regionalOffices, currentAssignment] = await Promise.all([
        prisma.guard.findUnique({
            where: { id },
        }),
        prisma.region.findMany({
            where: regionWhere,
            orderBy: { name: "asc" },
        }),
        prisma.regionalOffice.findMany({
            where: officeWhere,
            include: { region: true },
            orderBy: { name: "asc" },
        }),
        prisma.guardSupervisorAssignment.findFirst({
            where: { guardId: id, status: "ACTIVE" },
            select: { supervisorId: true },
        }),
    ])

    if (!guard) notFound()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Edit Guard</h1>
                <p className="text-gray-600 mt-1">Update guard information for {guard.name}</p>
            </div>

            <GuardEditForm
                guard={guard}
                regions={regions}
                regionalOffices={regionalOffices}
                currentSupervisorId={currentAssignment?.supervisorId ?? null}
                lockedRegionId={lockedRegionId}
                lockedRegionalOfficeId={lockedRegionalOfficeId}
            />
        </div>
    )
}
