import UiDocScreen from "@/components/parity/UiDocScreen"

export default function TicketsPage() {
  return (
    <UiDocScreen
      title="Ticketing Listing"
      description="All tickets listing with documented filters and columns."
      links={[
        { label: "Create Ticket", href: "/tickets/new" },
        { label: "Prerequisites", href: "/tickets/prerequisites" },
      ]}
      sections={[
        {
          title: "Search Filters",
          fields: [
            { label: "Category", type: "select" },
            { label: "Priority", type: "select" },
            { label: "Status", type: "select" },
            { label: "Supervisor", type: "select" },
            { label: "Created Date", type: "date" },
          ],
        },
      ]}
      actions={["Search", "Clear"]}
      table={{ columns: ["ID", "Subject", "Sender", "Category", "Priority", "Status", "Assigned To", "Created At"] }}
    />
  )
}
