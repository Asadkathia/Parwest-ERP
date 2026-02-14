import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { payrollScreens } from "@/lib/parity/screenConfigs"

export default function PayrollSettingsPage() {
  return <ConfiguredInteractiveScreen config={payrollScreens.settingsHub} />
}
