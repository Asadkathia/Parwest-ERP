import UiDocScreen from "@/components/parity/UiDocScreen"

export default function ClientTypesLocationsPage() {
  return (
    <UiDocScreen
      title="Client Types & Locations"
      description="Master data tables for client types, document types, and client locations."
      tabs={["All Client Types", "Client's Document Types", "Client Locations"]}
      sections={[
        {
          title: "Manage Type / Document / Location",
          fields: [
            { label: "Name", required: true },
            { label: "Unique Key" },
            { label: "City", type: "select" },
          ],
        },
      ]}
      actions={["Add", "Update", "Delete"]}
      table={{ columns: ["Type", "Name", "Created By", "Created On", "Action"] }}
    />
  )
}
