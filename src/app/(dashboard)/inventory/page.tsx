import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { inventoryLinks, moduleHubScreens } from "@/lib/parity/screenConfigs"

export default function InventoryDashboardPage() {
  return <ConfiguredInteractiveScreen config={moduleHubScreens.inventoryDashboard} links={inventoryLinks} />
}
