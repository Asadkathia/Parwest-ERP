import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import EndDeploymentForm from "./form"

export default async function EndDeploymentPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

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
            <div>
                <h1 className="text-3xl font-bold">End Deployment</h1>
                <p className="text-gray-600 mt-1">
                    End the deployment for {deployment.guard.name} at {deployment.client.name}
                </p>
            </div>

            <EndDeploymentForm deployment={deployment} />
        </div>
    )
}
