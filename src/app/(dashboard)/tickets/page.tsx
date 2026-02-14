import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { ticketScreens } from "@/lib/parity/screenConfigs"

export default function TicketsPage() {
  return (
    <ConfiguredInteractiveScreen
      config={ticketScreens.listing}
      links={[
        { label: "Create Ticket", href: "/tickets/new" },
        { label: "Prerequisites", href: "/tickets/prerequisites" },
      ]}
    />
  )
}
