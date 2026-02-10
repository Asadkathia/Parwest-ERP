import UiDocScreen from "@/components/parity/UiDocScreen"

export default function ClientBlacklistPage() {
  return (
    <UiDocScreen
      title="Black Listed Clients"
      sections={[
        {
          title: "Blacklist Entry",
          fields: [
            { label: "Email #", type: "email", required: true },
            { label: "Reason", type: "textarea" },
          ],
        },
      ]}
      actions={["Add", "Search"]}
      table={{ columns: ["Email #", "Black Listed By", "Black Listed On", "Action"] }}
    />
  )
}
