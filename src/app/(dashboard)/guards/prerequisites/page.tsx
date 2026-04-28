import { auth } from "@/lib/auth"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import PrerequisitesManager from "./manager"
import { isPrismaMissingSchemaError, toErrorMessage } from "@/lib/prisma-errors"

export default async function PrerequisitesPage() {
    const session = await auth()
    if (!session) redirect("/login")

    let regions: Array<{ id: string; name: string }> = []
    let dbWarning = ""
    try {
        regions = await prisma.region.findMany({ orderBy: { name: "asc" } })
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
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Prerequisites Management"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage regions and regional offices for the guard management system"}</p></div></div>
            {dbWarning ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{dbWarning}</AlertDescription></Alert> : null}

            <PrerequisitesManager regions={regions} />
        </div>
    )
}