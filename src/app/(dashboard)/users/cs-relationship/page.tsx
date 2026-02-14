import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { userLinks, userScreens } from "@/lib/parity/screenConfigs"

export default function UsersCsRelationshipPage() {
  return <ConfiguredInteractiveScreen config={userScreens["cs-relationship"]} links={userLinks} />
}
