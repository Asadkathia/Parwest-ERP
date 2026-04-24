import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import DeploymentEditForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function EditDeploymentPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "GUARDS", "UPDATE")) redirect("/deployments")

    const { id } = await params

    const [deployment, clients, regionalOffices] = await Promise.all([
        prisma.deployment.findUnique({
            where: { id },
            include: {
                guard: true,
                client: {
                    include: {
                        branches: true,
                    },
                },
                branch: true,
                regionalOffice: true,
            },
        }),
        prisma.client.findMany({
            where: { status: "ACTIVE" },
            orderBy: { name: "asc" },
            include: {
                branches: {
                    orderBy: { name: "asc" },
                },
            },
        }),
        prisma.regionalOffice.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                seriesCode: true,
            },
        }),
    ])

    if (!deployment) notFound()

    return (
        <div className="space-y-6">
            <SectionTitle title="Change Deployment" subtitle={`Update deployment for ${deployment.guard.name}`} />

            <DeploymentEditForm
                deployment={deployment}
                clients={clients}
                regionalOffices={regionalOffices}
            />
        </div>
    )
}
