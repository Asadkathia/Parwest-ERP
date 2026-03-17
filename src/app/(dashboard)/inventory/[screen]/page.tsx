import { redirect } from "next/navigation"

export default async function InventoryScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const compatibilityMap: Record<string, string> = {
    categories: "categories",
    vendors: "vendors",
    conditions: "conditions",
    demand: "demands-send",
    "stock-in": "purchases",
    "assign-item": "inventory-assignments",
    condemned: "adjustments",
    search: "inventories",
  }
  redirect(`/store-inventory/${compatibilityMap[screen] || screen}`)
}
