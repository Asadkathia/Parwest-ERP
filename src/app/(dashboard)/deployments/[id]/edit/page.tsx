import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import DeploymentEditForm from "./form"

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
            <div>
                <h1 className="text-3xl font-bold">Edit Deployment</h1>
                <p className="text-gray-600 mt-1">
                    Update deployment information for {deployment.guard.name}
                </p>
            </div>

            <DeploymentEditForm
                deployment={deployment}
                guards={guards}
                clients={clients}
                regionalOffices={regionalOffices}
            />
        </div>
    )
}
