import UiDocScreen from "@/components/parity/UiDocScreen"

export default function TicketPrerequisitesPage() {
  return (
    <UiDocScreen
      title="Ticketing Prerequisites"
      tabs={["Categories", "Priorities", "Statuses"]}
      sections={[
        {
          title: "Categories",
          fields: [
            { label: "Name", required: true },
            { label: "Description", type: "textarea" },
            { label: "Color", placeholder: "#RRGGBB" },
          ],
        },
        {
          title: "Priorities",
          fields: [
            { label: "Name", required: true },
            { label: "Color", placeholder: "#RRGGBB" },
          ],
        },
        {
          title: "Statuses",
          fields: [
            { label: "Name", required: true },
            { label: "Color", placeholder: "#RRGGBB" },
          ],
        },
      ]}
      actions={["Save", "Update", "Delete"]}
      table={{ columns: ["Type", "Name", "Color", "Action"] }}
    />
  )
}
