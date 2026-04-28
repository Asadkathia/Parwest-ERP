import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import TicketListManager from "@/components/tickets/TicketListManager"

export default async function TicketsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "TICKETING", "CREATE")

  // Region scoping is enforced server-side in /api/tickets via
  // buildManagerScopeWhere on the sender relation — no need to derive scope here.
  return (
    <div className="space-y-6">
      <TicketListManager canCreate={canCreate} />
    </div>
  )
}
