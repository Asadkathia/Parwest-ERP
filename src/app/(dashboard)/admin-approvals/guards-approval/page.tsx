import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ShieldAlert } from "lucide-react"
import { isSuperAdmin } from "@/lib/api/permissions"
import { deriveRegionalScope } from "@/lib/access/scope"
import GuardsApprovalClient from "./GuardsApprovalClient"

export default async function GuardsApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ regionId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const superAdmin = isSuperAdmin(session)
  const scope = deriveRegionalScope(session)

  const { regionId: urlRegionId = "" } = await searchParams
  const needsRegionGate = superAdmin && !urlRegionId

  const regions = await prisma.region
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])

  const pickerRegions = scope?.regionId
    ? regions.filter((r) => r.id === scope.regionId)
    : regions

  const effectiveRegionId = scope?.regionId ?? (superAdmin ? urlRegionId : "")
  const locked = Boolean(scope?.regionId)

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Guards Approval"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage guard age limits and review age approval requests."}</p></div></div>

      {needsRegionGate ? (
        <>
          <GuardsApprovalClient regionId={effectiveRegionId} regions={pickerRegions} locked={locked} />
          <div className="ui-card p-10 text-center">
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-base font-medium text-[var(--text)]">Select a region to view approvals.</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Guard age approvals concern guards assigned to a specific region. Choose a region above to load its queue.
            </p>
          </div>
        </>
      ) : (
        <GuardsApprovalClient regionId={effectiveRegionId} regions={pickerRegions} locked={locked} />
      )}
    </div>
  )
}
