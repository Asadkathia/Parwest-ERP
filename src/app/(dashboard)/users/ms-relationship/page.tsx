import UiDocScreen from "@/components/parity/UiDocScreen"

export default function UsersMsRelationshipPage() {
  return (
    <UiDocScreen
      title="M/S Relationship"
      description="Assign Managers to Supervisors."
      sections={[
        {
          title: "Assign Relationship",
          fields: [
            { label: "Manager", type: "select", required: true },
            { label: "Supervisor", type: "select", required: true },
            { label: "Effective Date", type: "date" },
          ],
        },
      ]}
      actions={["Assign", "Clear"]}
      table={{ columns: ["Manager", "Supervisor", "Effective Date", "Action"] }}
    />
  )
}
