import UiDocScreen from "@/components/parity/UiDocScreen"

export default function UsersNewPage() {
  return (
    <UiDocScreen
      title="Add New User"
      description="User enrolment form from UI docs."
      sections={[
        {
          title: "User Enrolment",
          fields: [
            { label: "User's Name", required: true },
            { label: "Email", type: "email", required: true },
            { label: "User Role", type: "select", required: true },
            { label: "Select Region", type: "select" },
            { label: "Regional Office", type: "select" },
            { label: "Contact #", required: true },
            { label: "Password", required: true },
          ],
        },
      ]}
      actions={["Submit", "Reset"]}
    />
  )
}
