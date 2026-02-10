import UiDocScreen from "@/components/parity/UiDocScreen"

export default function UserPermissionsPage() {
  return (
    <UiDocScreen
      title="Permissions Management"
      description="Module permissions: CREATE, VIEW, UPDATE, DELETE, REQUISITIONS."
      sections={[
        {
          title: "Permission Grid",
          fields: [
            { label: "Select User", type: "select" },
            { label: "Guard - CREATE", type: "checkbox" },
            { label: "Guard - VIEW", type: "checkbox" },
            { label: "Guard - UPDATE", type: "checkbox" },
            { label: "Guard - DELETE", type: "checkbox" },
            { label: "Guard - REQUISITIONS", type: "checkbox" },
            { label: "Payroll - CREATE", type: "checkbox" },
            { label: "Payroll - VIEW", type: "checkbox" },
            { label: "Inventory - VIEW", type: "checkbox" },
            { label: "Users - VIEW", type: "checkbox" },
            { label: "Clients - VIEW", type: "checkbox" },
            { label: "Ticketing - VIEW", type: "checkbox" },
            { label: "Settings - VIEW", type: "checkbox" },
            { label: "Reports - VIEW", type: "checkbox" },
            { label: "Imports - VIEW", type: "checkbox" },
            { label: "Requisitions - VIEW", type: "checkbox" },
            { label: "Audit - VIEW", type: "checkbox" },
          ],
        },
      ]}
      actions={["Save Permissions"]}
    />
  )
}
