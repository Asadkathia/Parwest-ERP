import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { auditScreens } from "@/lib/parity/screenConfigs"

export default function AuditPage() {
  return <ConfiguredInteractiveScreen config={auditScreens.search} />
}
