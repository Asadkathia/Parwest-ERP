import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import DeploymentForm from "./form"

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
            <div>
                <h1 className="text-3xl font-bold">New Deployment</h1>
                <p className="text-gray-600 mt-1">Assign a guard to a client location</p>
            </div>

            <DeploymentForm guards={guards} clients={clients} regionalOffices={regionalOffices} />
        </div>
    )
}
