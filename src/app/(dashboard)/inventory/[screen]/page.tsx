import { notFound } from "next/navigation"
import UiDocScreen from "@/components/parity/UiDocScreen"
import { inventoryLinks, inventoryScreens } from "@/lib/parity/screenConfigs"

export default async function InventoryScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const config = inventoryScreens[screen]

  if (!config) {
    notFound()
  }

  return <UiDocScreen {...config} links={inventoryLinks} />
}
