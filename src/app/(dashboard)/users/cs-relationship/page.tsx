import UiDocScreen from "@/components/parity/UiDocScreen"

export default function UsersCsRelationshipPage() {
  return (
    <UiDocScreen
      title="C/S Relationship"
      description="Assign client branches to supervisors."
      sections={[
        {
          title: "Assign Client Branch",
          fields: [
            { label: "Client", type: "select", required: true },
            { label: "Branch", type: "select", required: true },
            { label: "Supervisor", type: "select", required: true },
            { label: "Effective Date", type: "date" },
          ],
        },
      ]}
      actions={["Assign", "Clear"]}
      table={{ columns: ["Client", "Branch", "Supervisor", "Effective Date", "Action"] }}
    />
  )
}
