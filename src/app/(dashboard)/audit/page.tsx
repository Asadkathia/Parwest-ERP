import UiDocScreen from "@/components/parity/UiDocScreen"

export default function AuditPage() {
  return (
    <UiDocScreen
      title="Audit Search"
      description="System-wide activity tracking and compliance log."
      sections={[
        {
          title: "Audit Filters",
          fields: [
            { label: "Date From", type: "date" },
            { label: "Date To", type: "date" },
            { label: "User Name" },
            { label: "Event", type: "select" },
            { label: "Module", type: "select" },
            { label: "IP Address" },
          ],
        },
      ]}
      actions={["Search", "Clear"]}
      table={{ columns: ["Date", "User Name", "Event", "Module", "IP Address", "Description"] }}
    />
  )
}
