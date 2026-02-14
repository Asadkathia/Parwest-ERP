import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { importLinks, moduleHubScreens } from "@/lib/parity/screenConfigs"

export default function ImportsPage() {
  return <ConfiguredInteractiveScreen config={moduleHubScreens.importsHub} links={importLinks} />
}
