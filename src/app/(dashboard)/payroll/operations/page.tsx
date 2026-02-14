import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { payrollOperationLinks, payrollScreens } from "@/lib/parity/screenConfigs"

export default function PayrollOperationsPage() {
  return <ConfiguredInteractiveScreen config={payrollScreens.operationsHub} links={payrollOperationLinks} />
}
