import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { moduleHubScreens } from "@/lib/parity/screenConfigs"

export default function NewTicketPage() {
  return <ConfiguredInteractiveScreen config={moduleHubScreens.ticketNew} />
}
