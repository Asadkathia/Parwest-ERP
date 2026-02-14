import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { moduleHubScreens, reportLinks } from "@/lib/parity/screenConfigs"

export default function ReportsPage() {
  return <ConfiguredInteractiveScreen config={moduleHubScreens.reportsHub} links={reportLinks} />
}
