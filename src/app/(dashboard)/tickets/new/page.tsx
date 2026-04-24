import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import TicketNewManager from "@/components/tickets/TicketNewManager"

export default async function NewTicketPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!hasAction(session, "TICKETING", "CREATE")) redirect("/tickets")
  return <TicketNewManager />
}
