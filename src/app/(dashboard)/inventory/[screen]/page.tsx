import { notFound } from "next/navigation"
import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { inventoryLinks, inventoryScreens } from "@/lib/parity/screenConfigs"

export default async function InventoryScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const config = inventoryScreens[screen]

  if (!config) {
    notFound()
  }

  return <ConfiguredInteractiveScreen config={config} links={inventoryLinks} />
}
