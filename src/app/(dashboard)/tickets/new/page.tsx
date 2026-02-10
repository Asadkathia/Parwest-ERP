import UiDocScreen from "@/components/parity/UiDocScreen"

export default function NewTicketPage() {
  return (
    <UiDocScreen
      title="Create Ticket"
      description="Frontend-only ticket creation flow."
      sections={[
        {
          title: "Ticket Form",
          fields: [
            { label: "Subject", required: true },
            { label: "Description", type: "textarea", required: true },
            { label: "Category", type: "select", required: true },
            { label: "Priority", type: "select", required: true },
            { label: "Assign To", type: "select" },
          ],
        },
      ]}
      actions={["Submit", "Reset"]}
    />
  )
}
