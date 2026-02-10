import UiDocScreen from "@/components/parity/UiDocScreen"

export default function SystemSettingsPage() {
  return (
    <UiDocScreen
      title="System Settings"
      description="Frontend placeholder for global system settings."
      sections={[
        {
          title: "General",
          fields: [
            { label: "Application Name" },
            { label: "Timezone", type: "select" },
            { label: "Default Currency", type: "select" },
          ],
        },
      ]}
      actions={["Save Settings"]}
    />
  )
}
