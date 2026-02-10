import UiDocScreen from "@/components/parity/UiDocScreen"

export default function ClientExportBranchesPage() {
  return (
    <UiDocScreen
      title="Export Client Branches"
      sections={[
        {
          title: "Basic Information",
          fields: [
            { label: "Select Manager", type: "select" },
            { label: "Select Client", type: "select" },
          ],
        },
      ]}
      actions={["Submit", "Export Excel"]}
      table={{ columns: ["Name", "Supervisor", "Manager"] }}
    />
  )
}
