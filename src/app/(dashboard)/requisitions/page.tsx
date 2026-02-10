import UiDocScreen from "@/components/parity/UiDocScreen"

export default function RequisitionsPage() {
  return (
    <UiDocScreen
      title="Requisitions"
      description="Guard Approval By HO with Pending / Accepted / Rejected tabs."
      tabs={["Pending", "Accepted", "Rejected"]}
      sections={[
        {
          title: "Guard Approval Filters",
          fields: [
            { label: "Secure Ops ID" },
            { label: "Name" },
            { label: "Current Status", type: "select" },
            { label: "Over Age", type: "select", options: ["Yes", "No"] },
          ],
        },
      ]}
      actions={["Approve", "Reject", "Export Excel"]}
      table={{ columns: ["Secure Ops ID", "Name", "Current Status", "Over Age", "Pic", "Action"] }}
    />
  )
}
