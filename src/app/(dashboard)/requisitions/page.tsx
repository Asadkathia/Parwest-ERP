import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { requisitionScreens } from "@/lib/parity/screenConfigs"

export default function RequisitionsPage() {
  return <ConfiguredInteractiveScreen config={requisitionScreens.approvals} />
}
