import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import ClientEnrollmentForm from "./form"
import SectionTitle from "@/components/ui/section-title"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"

export default async function NewClientPage({
    searchParams,
}: {
    searchParams?: Promise<{ mode?: string }>
}) {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "CLIENTS", "CREATE")) redirect("/clients")
    const params = searchParams ? await searchParams : undefined
    const mode = params?.mode === "branch" ? "branch" : "branchless"
    const initialBranchless = mode !== "branch"

    let regions: Array<{ id: string; name: string }> = []
    let dbWarning = ""
    try {
        regions = await prisma.region.findMany({
            orderBy: { name: "asc" },
        })
    } catch (error) {
        if (isPrismaMissingSchemaError(error)) {
            dbWarning = "Database schema is not fully migrated yet. Region data is temporarily unavailable."
        } else {
            dbWarning = `Unable to load region data: ${toErrorMessage(error, "Unknown database error")}`
        }
        console.error("NewClientPage lookup query failed:", error)
    }

    return (
        <div className="space-y-6">
            <SectionTitle title="Add New Client" subtitle="Enroll a new client into the system" />
            {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

            <ClientEnrollmentForm regions={regions} initialBranchless={initialBranchless} />
        </div>
    )
}
