import UiDocScreen from "@/components/parity/UiDocScreen"
import { payrollOperationLinks } from "@/lib/parity/screenConfigs"

export default function PayrollOperationsPage() {
  return (
    <UiDocScreen
      title="Payroll Operations"
      description="Frontend parity screen for payroll operational workflows from UI docs."
      links={payrollOperationLinks}
      sections={[
        {
          title: "Operation Overview",
          fields: [
            { label: "Month", type: "month" },
            { label: "Region", type: "select" },
            { label: "Select Client", type: "select" },
            { label: "Branch", type: "select" },
          ],
        },
      ]}
      actions={["Open Operation", "Clear"]}
    />
  )
}
