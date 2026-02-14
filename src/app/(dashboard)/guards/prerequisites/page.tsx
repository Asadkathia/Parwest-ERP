import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import PrerequisitesManager from "./manager"
import SectionTitle from "@/components/ui/section-title"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"

export default async function PrerequisitesPage() {
    const session = await auth()
    if (!session) redirect("/login")

    let regions: Array<{ id: string; name: string }> = []
    let regionalOffices: Array<{
        id: string
        name: string
        seriesCode: string
        regionId: string
        region: { id: string; name: string }
    }> = []
    let dbWarning = ""
    try {
        ;[regions, regionalOffices] = await Promise.all([
            prisma.region.findMany({
                orderBy: { name: "asc" },
            }),
            prisma.regionalOffice.findMany({
                select: {
                    id: true,
                    name: true,
                    seriesCode: true,
                    regionId: true,
                    region: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
        ])
    } catch (error) {
        if (isPrismaMissingSchemaError(error)) {
            dbWarning = "Database schema is not fully migrated yet. Prerequisite lookup data is temporarily unavailable."
        } else {
            dbWarning = `Unable to load prerequisites lookup data: ${toErrorMessage(error, "Unknown database error")}`
        }
        console.error("PrerequisitesPage lookup query failed:", error)
    }

    return (
        <div className="space-y-6">
            <SectionTitle
                title="Prerequisites Management"
                subtitle="Manage regions and regional offices for the guard management system"
            />
            {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

            <PrerequisitesManager regions={regions} regionalOffices={regionalOffices} />
        </div>
    )
}
