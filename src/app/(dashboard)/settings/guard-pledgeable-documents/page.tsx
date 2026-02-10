import UiDocScreen from "@/components/parity/UiDocScreen"

export default function GuardPledgeableDocumentsPage() {
  return (
    <UiDocScreen
      title="Settings: Guard Pledgeable Document Types"
      sections={[{ title: "Document Type", fields: [{ label: "Name", required: true }, { label: "Description", type: "textarea" }] }]}
      actions={["Create", "Update", "Delete"]}
      table={{ columns: ["Document Type", "Description", "Action"] }}
    />
  )
}
