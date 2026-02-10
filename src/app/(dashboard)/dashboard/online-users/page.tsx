import UiDocScreen from "@/components/parity/UiDocScreen"

export default function OnlineUsersPage() {
  return (
    <UiDocScreen
      title="Online Users"
      description="Current active users view from dashboard module."
      sections={[
        {
          title: "Online Snapshot",
          fields: [
            { label: "Online Users Count", type: "number" },
          ],
        },
      ]}
      table={{ columns: ["User", "Role", "Regional Office", "Last Activity", "Session ID"] }}
    />
  )
}
