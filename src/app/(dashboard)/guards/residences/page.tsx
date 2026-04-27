import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import ResidencesManager from "./manager"

export default async function ResidencesPage() {
    const session = await auth()
    if (!session) redirect("/login")

    const scope = deriveManagerScope(session)
    const regions = await prisma.region
        .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
        .catch(() => [] as { id: string; name: string }[])
    const pickerRegions = scope?.regionId
        ? regions.filter((r) => r.id === scope.regionId)
        : regions
    const regionLocked = Boolean(scope?.regionId)

    return (
        <div className="space-y-6">
            <ResidencesManager regions={pickerRegions} regionLocked={regionLocked} />
        </div>
    )
}
