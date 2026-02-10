import UiDocScreen from "@/components/parity/UiDocScreen"

export default function UsersSearchPage() {
  return (
    <UiDocScreen
      title="Search Users"
      sections={[
        {
          title: "Filters",
          fields: [
            { label: "Name" },
            { label: "User Role", type: "select" },
          ],
        },
      ]}
      actions={["Search", "Export in Excel"]}
      table={{ columns: ["ID", "Photo", "Name", "Email", "Role", "Regional Office", "Action"] }}
    />
  )
}
