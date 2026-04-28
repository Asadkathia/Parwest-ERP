import { auth } from "@/lib/auth"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import { deriveManagerScope } from "@/lib/access/scope"
import ClientEnrollmentForm from "./form"
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

    const scope = deriveManagerScope(session)
    const viewerRegionId = scope?.regionId ?? null
    const viewerRegionalOfficeId = scope?.regionalOfficeIds.length === 1 ? scope.regionalOfficeIds[0] : null

    let regions: Array<{ id: string; name: string }> = []
    let dbWarning = ""
    try {
        regions = await prisma.region.findMany({
            where: viewerRegionId ? { id: viewerRegionId } : undefined,
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
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Add New Client"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Enroll a new client into the system"}</p></div></div>
            {dbWarning ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{dbWarning}</AlertDescription></Alert> : null}

            <ClientEnrollmentForm
                regions={regions}
                initialBranchless={initialBranchless}
                isSuperAdmin={isSuperAdmin(session)}
                viewerRegionId={viewerRegionId}
                viewerRegionalOfficeId={viewerRegionalOfficeId}
            />
        </div>
    )
}
