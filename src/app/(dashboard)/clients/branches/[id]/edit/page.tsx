import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import BranchEditForm from "./form"
export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const branch = await prisma.branch.findUnique({
        where: { id },
        include: {
            client: true,
        },
    })

    if (!branch) notFound()

    // Count active deployments so the form can pre-flight a status=INACTIVE
    // change against the workflow rule (Ticket 32).
    const activeDeploymentCount = await prisma.deployment.count({
        where: { branchId: id, status: "ACTIVE" },
    })

    // Current ACTIVE supervisor assignment (Bug #41). Multiple rows may exist
    // historically; only the latest ACTIVE one is the canonical assignment.
    const currentSupervisor = await prisma.clientSupervisorAssignment.findFirst({
        where: { branchId: id, status: "ACTIVE" },
        orderBy: { effectiveDate: "desc" },
        select: { supervisorId: true },
    })

    // Resolve names for the currently-assigned manager / operations manager /
    // supervisor up-front so the dropdowns always have a label for the current
    // selection, even if the user has since changed role or region.
    const assignedUserIds = [
        branch.assignedManagerId,
        branch.operationsManagerId,
        currentSupervisor?.supervisorId ?? null,
    ].filter((v): v is string => Boolean(v))
    const initialUsers = assignedUserIds.length > 0
        ? await prisma.user.findMany({
              where: { id: { in: assignedUserIds } },
              select: { id: true, name: true },
          })
        : []

    return (
        <div className="space-y-6">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Edit Branch"}</h2><p className="mt-1 text-sm text-muted-foreground">{(`Update branch information for ${branch.name}`)}</p></div></div>

            <BranchEditForm
                branch={branch}
                activeDeploymentCount={activeDeploymentCount}
                currentSupervisorId={currentSupervisor?.supervisorId ?? null}
                clientRegionId={branch.client?.regionId ?? null}
                initialUsers={initialUsers.map((u) => ({ id: u.id, name: u.name ?? "" }))}
            />
        </div>
    )
}
