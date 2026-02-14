import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { dashboardScreens } from "@/lib/parity/screenConfigs"

export default function OnlineUsersPage() {
  return <ConfiguredInteractiveScreen config={dashboardScreens["online-users"]} />
}
