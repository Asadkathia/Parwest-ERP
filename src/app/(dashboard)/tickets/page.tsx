import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { hasAction } from "@/lib/api/permissions"
import { deriveRegionalScope } from "@/lib/access/scope"
import TicketListManager from "@/components/tickets/TicketListManager"

export default async function TicketsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "TICKETING", "CREATE")
  const scope = deriveRegionalScope(session)

  const regions = await prisma.region
    .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => [] as { id: string; name: string }[])
  const pickerRegions = scope?.regionId
    ? regions.filter((r) => r.id === scope.regionId)
    : regions

  return (
    <div className="space-y-6">
      <TicketListManager
        canCreate={canCreate}
        regions={pickerRegions}
        locked={Boolean(scope?.regionId)}
      />
    </div>
  )
}
