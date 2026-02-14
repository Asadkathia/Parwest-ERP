import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import GuardEnrollmentForm from "./form"
import SectionTitle from "@/components/ui/section-title"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"

export default async function NewGuardPage() {
    const session = await auth()
    if (!session) redirect("/login")

    let regions: Array<{ id: string; name: string }> = []
    let regionalOffices: Array<{ id: string; name: string; region: { id: string; name: string } }> = []
    let dbWarning = ""

    try {
        ;[regions, regionalOffices] = await Promise.all([
            prisma.region.findMany({ orderBy: { name: "asc" } }),
            prisma.regionalOffice.findMany({
                include: { region: true },
                orderBy: { name: "asc" },
            }),
        ])
    } catch (error) {
        if (isPrismaMissingSchemaError(error)) {
            dbWarning = "Database schema is not fully migrated yet. Dropdown data is temporarily unavailable."
        } else {
            dbWarning = `Unable to load region data: ${toErrorMessage(error, "Unknown database error")}`
        }
        console.error("NewGuardPage lookup query failed:", error)
    }

    return (
        <div className="space-y-6">
            <SectionTitle title="Add New Guard" subtitle="Enroll a new security guard into the system" />
            {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

            <GuardEnrollmentForm regions={regions} regionalOffices={regionalOffices} />
        </div>
    )
}
