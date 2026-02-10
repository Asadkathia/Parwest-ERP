import UiDocScreen from "@/components/parity/UiDocScreen"
import { importLinks } from "@/lib/parity/screenConfigs"

export default function ImportsPage() {
  return (
    <UiDocScreen
      title="Imports"
      description="Bulk operations hub for users, guards, clients, and inventory."
      links={importLinks}
      sections={[{ title: "Import Workflow", fields: [{ label: "Import Type", type: "select" }, { label: "Upload File" }] }]}
      actions={["Validate", "Import"]}
      table={{ columns: ["Import Type", "Uploaded By", "Uploaded At", "Status", "Action"] }}
    />
  )
}
