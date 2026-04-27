import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import TrainingsManager from "./manager"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

export default async function OnJobTrainingsPage({
    searchParams,
}: {
    searchParams: Promise<{ regionId?: string }>
}) {
    const session = await auth()
    if (!session) redirect("/login")

    const { regionId: regionIdParam = "" } = await searchParams
    const scope = deriveManagerScope(session)
    const paramDenied = managerScopeDenied(scope, { regionId: regionIdParam || undefined })
    const effectiveRegionId = paramDenied
        ? scope?.regionId ?? null
        : regionIdParam || scope?.regionId || null
    const lockedOfficeId = scope?.regionalOfficeIds.length === 1
        ? scope.regionalOfficeIds[0]
        : null

    const regions = await prisma.region
        .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
        .catch(() => [] as { id: string; name: string }[])
    const pickerRegions = scope?.regionId
        ? regions.filter((r) => r.id === scope.regionId)
        : regions
    const regionLocked = Boolean(scope?.regionId)

    return (
        <div className="space-y-6">
            <TrainingsManager
                effectiveRegionId={effectiveRegionId}
                lockedOfficeId={lockedOfficeId}
                regions={pickerRegions}
                regionLocked={regionLocked}
            />
        </div>
    )
}
