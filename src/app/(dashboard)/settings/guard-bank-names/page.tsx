import UiDocScreen from "@/components/parity/UiDocScreen"

export default function GuardBankNamesPage() {
  return (
    <UiDocScreen
      title="Settings: Guard Bank Names"
      sections={[{ title: "Bank Name", fields: [{ label: "Bank Name", required: true }] }]}
      actions={["Create", "Update", "Delete"]}
      table={{ columns: ["Bank Name", "Created At", "Action"] }}
    />
  )
}
