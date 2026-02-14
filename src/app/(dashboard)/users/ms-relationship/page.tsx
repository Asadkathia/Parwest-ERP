import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { userLinks, userScreens } from "@/lib/parity/screenConfigs"

export default function UsersMsRelationshipPage() {
  return <ConfiguredInteractiveScreen config={userScreens["ms-relationship"]} links={userLinks} />
}
