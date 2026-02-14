import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { moduleHubScreens } from "@/lib/parity/screenConfigs"

export default function SystemSettingsPage() {
  return <ConfiguredInteractiveScreen config={moduleHubScreens.systemSettings} />
}
