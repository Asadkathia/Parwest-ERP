import UiDocScreen from "@/components/parity/UiDocScreen"
import { payrollReportExports, reportLinks } from "@/lib/parity/screenConfigs"

export default function PayrollReportsPage() {
  return (
    <UiDocScreen
      title="Payroll Reports"
      description="Export and analytics tools listed in payroll report submenu."
      links={reportLinks}
      sections={[
        {
          title: "Export Set",
          fields: payrollReportExports.map((name) => ({ label: name, type: "checkbox" })),
        },
      ]}
      actions={["Run Selected Report", "Export"]}
      table={{ columns: ["Report", "Frequency", "Last Run", "Status", "Action"] }}
    />
  )
}
