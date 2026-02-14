import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { userLinks, userScreens } from "@/lib/parity/screenConfigs"

export default function UsersNewPage() {
  return <ConfiguredInteractiveScreen config={userScreens.new} links={userLinks} />
}
