import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import DeploymentForm from "./form"
import SectionTitle from "@/components/ui/section-title"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"

export default async function NewDeploymentPage() {
    const session = await auth()
    if (!session) redirect("/login")

    // Fetch guards, clients, and regional offices for dropdowns
    let guards: Array<{ id: string; parwestId: string; name: string; cnic: string }> = []
    let clients: Array<{ id: string; name: string; branches: Array<{ id: string; name: string; address: string | null }> }> = []
    let regionalOffices: Array<{ id: string; name: string; seriesCode: string }> = []
    let dbWarning = ""

    try {
        ;[guards, clients, regionalOffices] = await Promise.all([
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
                        select: {
                            id: true,
                            name: true,
                            address: true,
                        },
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
    } catch (error) {
        if (isPrismaMissingSchemaError(error)) {
            dbWarning = "Database schema is not fully migrated yet. Lookup data is temporarily unavailable."
        } else {
            dbWarning = `Unable to load deployment lookup data: ${toErrorMessage(error, "Unknown database error")}`
        }
        console.error("NewDeploymentPage lookup query failed:", error)
    }

    return (
        <div className="space-y-6">
            <SectionTitle title="New Deployment" subtitle="Assign a guard to a client location" />
            {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

            <DeploymentForm guards={guards} clients={clients} regionalOffices={regionalOffices} />
        </div>
    )
}
