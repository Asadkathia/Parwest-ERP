import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import EndDeploymentForm from "./form"
export default async function EndDeploymentPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "GUARDS", "DELETE")) redirect("/deployments")

    const { id } = await params

    const deployment = await prisma.deployment.findUnique({
        where: { id },
        include: {
            guard: true,
            client: true,
            branch: true,
            regionalOffice: true,
        },
    })

    if (!deployment) notFound()

    // Redirect if deployment is already inactive
    if (deployment.status === "INACTIVE") {
        redirect(`/deployments/${id}`)
    }

    return (
        <div className="space-y-6">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Revoke Deployment"}</h2><p className="mt-1 text-sm text-muted-foreground">{(`Revoke deployment for ${deployment.guard.name} at ${deployment.client.name}`)}</p></div></div>
            <EndDeploymentForm deployment={deployment} />
        </div>
    )
}
