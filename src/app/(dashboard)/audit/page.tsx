import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { FileText } from "lucide-react"
import { isSuperAdmin } from "@/lib/api/permissions"
import { deriveRegionalScope } from "@/lib/access/scope"
import AuditLogManager from "@/components/audit/AuditLogManager"

export default async function AuditPage({
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

  // Effective regionId to pass to the client manager. Regional users are
  // auto-scoped; SuperAdmin reads from URL.
  const effectiveRegionId = scope?.regionId ?? (superAdmin ? urlRegionId : "")
  const locked = Boolean(scope?.regionId)

  return (
    <div className="space-y-6">
      {needsRegionGate ? (
        <>
          <AuditLogManager regionId={effectiveRegionId} regions={pickerRegions} locked={locked} />
          <div className="ui-card p-10 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-base font-medium text-[var(--text)]">Select a region to view audit logs.</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Audit log entries carry a target region. Choose a region above to load its activity.
            </p>
          </div>
        </>
      ) : (
        <AuditLogManager regionId={effectiveRegionId} regions={pickerRegions} locked={locked} />
      )}
    </div>
  )
}
