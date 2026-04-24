import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasAction } from "@/lib/api/permissions"
import TicketDetail from "@/components/tickets/TicketDetail"

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const canUpdate = hasAction(session, "TICKETING", "UPDATE")
  return <TicketDetail paramsPromise={params} canUpdate={canUpdate} />
}