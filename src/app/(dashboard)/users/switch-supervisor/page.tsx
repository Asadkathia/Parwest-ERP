import UiDocScreen from "@/components/parity/UiDocScreen"

export default function UsersSwitchSupervisorPage() {
  return (
    <UiDocScreen
      title="Switch Supervisor"
      description="Bulk transfer supervisors between managers or locations."
      sections={[
        {
          title: "Switch Tool",
          fields: [
            { label: "From Supervisor", type: "select", required: true },
            { label: "To Supervisor", type: "select", required: true },
            { label: "Region", type: "select" },
            { label: "Regional Office", type: "select" },
            { label: "Reason", type: "textarea" },
          ],
        },
      ]}
      actions={["Preview", "Switch"]}
    />
  )
}
