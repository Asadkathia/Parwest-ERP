import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import EndDeploymentForm from "./form"
import SectionTitle from "@/components/ui/section-title"

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
            <SectionTitle title="Revoke Deployment" subtitle={`Revoke deployment for ${deployment.guard.name} at ${deployment.client.name}`} />
            <EndDeploymentForm deployment={deployment} />
        </div>
    )
}
