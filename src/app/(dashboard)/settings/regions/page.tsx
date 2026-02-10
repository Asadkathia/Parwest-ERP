import UiDocScreen from "@/components/parity/UiDocScreen"

export default function SettingsRegionsPage() {
  return (
    <UiDocScreen
      title="Settings: Regions"
      description="Manage broad geographical regions."
      sections={[{ title: "Region", fields: [{ label: "Region Name", required: true }] }]}
      actions={["Create", "Update", "Delete"]}
      table={{ columns: ["Region", "Created At", "Action"] }}
    />
  )
}
