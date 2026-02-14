import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { userLinks, userScreens } from "@/lib/parity/screenConfigs"

export default function UsersSearchPage() {
  return <ConfiguredInteractiveScreen config={userScreens.search} links={userLinks} />
}
