import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import DeploymentEditForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function EditDeploymentPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session) redirect("/login")

    const { id } = await params

    const [deployment, guards, clients, regionalOffices] = await Promise.all([
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
        prisma.guard.findMany({
            where: { status: "ACTIVE" },
            orderBy: { name: "asc" },
            select: {
                id: true,
                parwestId: true,
                name: true,
                cnic: true,
            },
        }),
        prisma.client.findMany({
            where: { status: "Active" },
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
