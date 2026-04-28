import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import GuardEnrollmentForm from "./form"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { AlertCircle } from "lucide-react"
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
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Add New Guard"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Enroll a new security guard into the system"}</p></div></div>
            {dbWarning ? (
                <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{dbWarning}</AlertDescription>
                </Alert>
            ) : null}

            <GuardEnrollmentForm
                regionalOffices={regionalOffices}
                currentUserName={session.user?.name || "System User"}
                lockedRegionalOfficeId={lockedRegionalOfficeId}
                lockedRegionId={scope?.regionId ?? null}
            />
        </div>
    )
}
