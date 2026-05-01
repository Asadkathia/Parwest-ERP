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

    return (
        <div className="space-y-6">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Edit Branch"}</h2><p className="mt-1 text-sm text-muted-foreground">{(`Update branch information for ${branch.name}`)}</p></div></div>

            <BranchEditForm branch={branch} activeDeploymentCount={activeDeploymentCount} />
        </div>
    )
}
