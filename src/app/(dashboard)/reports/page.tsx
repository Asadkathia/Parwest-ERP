import UiDocScreen from "@/components/parity/UiDocScreen"
import { reportLinks } from "@/lib/parity/screenConfigs"

export default function ReportsPage() {
  return (
    <UiDocScreen
      title="Reports"
      description="Frontend route hub for all documented report screens."
      links={reportLinks}
      sections={[{ title: "Report Hub", fields: [{ label: "Date From", type: "date" }, { label: "Date To", type: "date" }, { label: "Region", type: "select" }] }]}
      actions={["Generate", "Export"]}
    />
  )
}
