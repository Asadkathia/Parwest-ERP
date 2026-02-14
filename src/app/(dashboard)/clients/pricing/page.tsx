import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { moduleHubScreens } from "@/lib/parity/screenConfigs"

export default function ClientsPricingPage() {
  return <ConfiguredInteractiveScreen config={moduleHubScreens.clientPricing} />
}
