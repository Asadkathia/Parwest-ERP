import { notFound } from "next/navigation"
import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { inventoryLinks, inventoryScreens } from "@/lib/parity/screenConfigs"
import InventoryCategoryManager from "@/components/inventory/InventoryCategoryManager"
import InventoryVendorManager from "@/components/inventory/InventoryVendorManager"
import InventorySearchManager from "@/components/inventory/InventorySearchManager"
import InventoryStockInManager from "@/components/inventory/InventoryStockInManager"
import InventoryAssignItemManager from "@/components/inventory/InventoryAssignItemManager"
import InventoryCondemnedManager from "@/components/inventory/InventoryCondemnedManager"
import InventoryConditionsManager from "@/components/inventory/InventoryConditionsManager"
import InventoryDemandManager from "@/components/inventory/InventoryDemandManager"

export default async function InventoryScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const config = inventoryScreens[screen]

  if (!config) {
    notFound()
  }

  if (screen === "categories") {
    return <InventoryCategoryManager />
  }
  if (screen === "vendors") {
    return <InventoryVendorManager />
  }
  if (screen === "search") {
    return <InventorySearchManager />
  }
  if (screen === "stock-in") {
    return <InventoryStockInManager />
  }
  if (screen === "assign-item") {
    return <InventoryAssignItemManager />
  }
  if (screen === "condemned") {
    return <InventoryCondemnedManager />
  }
  if (screen === "conditions") {
    return <InventoryConditionsManager />
  }
  if (screen === "demand") {
    return <InventoryDemandManager />
  }

  return <ConfiguredInteractiveScreen config={config} links={inventoryLinks} />
}
