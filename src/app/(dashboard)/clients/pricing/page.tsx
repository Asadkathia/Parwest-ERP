import UiDocScreen from "@/components/parity/UiDocScreen"

export default function ClientsPricingPage() {
  return (
    <UiDocScreen
      title="Client Pricing"
      description="Contractual pricing and billing configurations."
      sections={[
        {
          title: "Pricing Configuration",
          fields: [
            { label: "Client", type: "select", required: true },
            { label: "Guard Type", type: "select", required: true },
            { label: "Rate", type: "number", required: true },
            { label: "Effective From", type: "date" },
          ],
        },
      ]}
      actions={["Save", "Update"]}
      table={{ columns: ["Client", "Guard Type", "Rate", "Effective From", "Action"] }}
    />
  )
}
