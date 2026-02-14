import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import DeploymentForm from "./form"
import SectionTitle from "@/components/ui/section-title"

export default async function NewDeploymentPage() {
    const session = await auth()
    if (!session) redirect("/login")

    // Fetch guards, clients, and regional offices for dropdowns
    const [guards, clients, regionalOffices] = await Promise.all([
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
            where: { status: "ACTIVE" },
            include: {
                branches: {
                    orderBy: { name: "asc" },
                },
            },
            orderBy: { name: "asc" },
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

    return (
        <div className="space-y-6">
            <SectionTitle title="New Deployment" subtitle="Assign a guard to a client location" />

            <DeploymentForm guards={guards} clients={clients} regionalOffices={regionalOffices} />
        </div>
    )
}
