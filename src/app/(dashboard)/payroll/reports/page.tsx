import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { payrollScreens, reportLinks } from "@/lib/parity/screenConfigs"

export default function PayrollReportsPage() {
  return <ConfiguredInteractiveScreen config={payrollScreens.reportsHub} links={reportLinks} />
}
