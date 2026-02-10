import UiDocScreen from "@/components/parity/UiDocScreen"

export default function SettingsOfficesPage() {
  return (
    <UiDocScreen
      title="Settings: Regional Offices"
      sections={[
        {
          title: "Regional Office",
          fields: [
            { label: "Office Name", required: true },
            { label: "Office Head" },
            { label: "Series Code", required: true },
            { label: "Phone" },
            { label: "Mobile" },
            { label: "Fax" },
            { label: "Region", type: "select", required: true },
          ],
        },
      ]}
      actions={["Create", "Update", "Delete"]}
      table={{ columns: ["Office", "Series Code", "Region", "Office Head", "Action"] }}
    />
  )
}
