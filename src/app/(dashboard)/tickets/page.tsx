import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import TicketListManager from "@/components/tickets/TicketListManager"

export default async function TicketsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const canCreate = hasAction(session, "TICKETING", "CREATE")
  return <TicketListManager canCreate={canCreate} />
}
