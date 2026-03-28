import TicketDetail from "@/components/tickets/TicketDetail"

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <TicketDetail paramsPromise={params} />
}