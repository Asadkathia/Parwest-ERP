import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction, isSuperAdmin } from "@/lib/api/permissions"
import { deriveRegionalScope } from "@/lib/access/scope"
import DeploymentsListClient from "@/components/deployments/DeploymentsListClient"

export default async function DeploymentsPage() {
    const session = await auth()
    if (!session) redirect("/login")

    // Deployments are semantically part of GUARDS (no dedicated DEPLOYMENTS module in MODULES).
    const canCreate = hasAction(session, "GUARDS", "CREATE")
    const canUpdate = hasAction(session, "GUARDS", "UPDATE")
    const canDelete = hasAction(session, "GUARDS", "DELETE")

    const scope = deriveRegionalScope(session)

    // For regional users we only need their own region/office info; for SuperAdmin
    // we need the full lists so they can pick one. Both fetched so the picker has
    // friendly labels even when the value is locked.
    const [regions, offices] = await Promise.all([
        prisma.region.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.regionalOffice
            .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, regionId: true } })
            .catch(() => []),
    ])

    // If the user is a regional admin whose session is missing a region, they
    // should see nothing rather than a picker with the option to browse
    // everything. deriveRegionalScope already returns an impossible region in
    // that case, so the API guard catches it, but we can hide the picker too.
    const scopedRegionId = scope?.regionId ?? null
    const scopedOfficeId = scope?.regionalOfficeIds[0] ?? null

    return (
        <DeploymentsListClient
            regions={isSuperAdmin(session) ? regions : regions.filter((r) => r.id === scopedRegionId)}
            offices={isSuperAdmin(session) ? offices : offices.filter((o) => scopedOfficeId ? o.id === scopedOfficeId : o.regionId === scopedRegionId)}
            scopedRegionId={scopedRegionId}
            scopedOfficeId={scopedOfficeId}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
        />
    )
}
