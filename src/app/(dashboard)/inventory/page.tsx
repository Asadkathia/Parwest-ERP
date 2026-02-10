import UiDocScreen from "@/components/parity/UiDocScreen"
import { inventoryLinks } from "@/lib/parity/screenConfigs"

export default function InventoryDashboardPage() {
  return (
    <UiDocScreen
      title="Inventory Dashboard"
      description="Asset dashboard with availability, issued, and remaining counts."
      links={inventoryLinks}
      sections={[
        {
          title: "Dashboard Cards",
          fields: [
            { label: "Total Available", type: "number" },
            { label: "Issued", type: "number" },
            { label: "Remaining", type: "number" },
          ],
        },
      ]}
      table={{ columns: ["Product Type", "Total Available", "Issued", "Remaining"] }}
    />
  )
}
