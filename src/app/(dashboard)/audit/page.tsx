import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { FileText } from "lucide-react"
import { isSuperAdmin } from "@/lib/api/permissions"
import { deriveRegionalScope } from "@/lib/access/scope"
import AuditLogManager from "@/components/audit/AuditLogManager"
import { Card, CardContent } from "@/components/shadcn/card"

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
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-base font-medium">Select a region to view audit logs.</p>
              <p className="text-sm text-muted-foreground">
                Audit log entries carry a target region. Choose a region from the topbar to load its activity.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <AuditLogManager regionId={effectiveRegionId} regions={pickerRegions} locked={locked} />
      )}
    </div>
  )
}
