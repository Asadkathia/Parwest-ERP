import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { userLinks, userScreens } from "@/lib/parity/screenConfigs"

export default function UsersSwitchSupervisorPage() {
  return <ConfiguredInteractiveScreen config={userScreens["switch-supervisor"]} links={userLinks} />
}
