import UiDocScreen from "@/components/parity/UiDocScreen"

export default function UserTypesPage() {
  return (
    <UiDocScreen
      title="Settings: User Types"
      description="Manage roles such as Super User, Admin, Supervisor, Manager."
      sections={[{ title: "User Type", fields: [{ label: "Role Name", required: true }, { label: "Description", type: "textarea" }] }]}
      actions={["Create", "Update", "Delete"]}
      table={{ columns: ["Role", "Description", "Action"] }}
    />
  )
}
