import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import GuardEnrollmentForm from "./form"
import SectionTitle from "@/components/ui/section-title"
import InlineAlert from "@/components/ui/inline-alert"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"
import { buildManagerScopeWhere, deriveManagerScope } from "@/lib/access/scope"

export default async function NewGuardPage() {
    const session = await auth()
    if (!session) redirect("/login")
    if (!hasAction(session, "GUARDS", "CREATE")) redirect("/guards")

    const scope = deriveManagerScope(session)
    const lockedRegionalOfficeId =
        scope && scope.regionalOfficeIds.length === 1 ? scope.regionalOfficeIds[0] : null

    let regionalOffices: Array<{ id: string; name: string; region: { id: string; name: string } }> = []
    let dbWarning = ""

    try {
        regionalOffices = await prisma.regionalOffice.findMany({
            where: buildManagerScopeWhere(scope, { regionId: "regionId", regionalOfficeId: "id" }),
            include: { region: true },
            orderBy: { name: "asc" },
        })
    } catch (error) {
        if (isPrismaMissingSchemaError(error)) {
            dbWarning = "Database schema is not fully migrated yet. Regional office dropdown is temporarily unavailable."
        } else {
            dbWarning = `Unable to load regional office data: ${toErrorMessage(error, "Unknown database error")}`
        }
        console.error("NewGuardPage lookup query failed:", error)
    }

    return (
        <div className="space-y-6">
            <SectionTitle title="Add New Guard" subtitle="Enroll a new security guard into the system" />
            {dbWarning ? <InlineAlert type="error" message={dbWarning} /> : null}

            <GuardEnrollmentForm
                regionalOffices={regionalOffices}
                currentUserName={session.user?.name || "System User"}
                lockedRegionalOfficeId={lockedRegionalOfficeId}
                lockedRegionId={scope?.regionId ?? null}
            />
        </div>
    )
}
