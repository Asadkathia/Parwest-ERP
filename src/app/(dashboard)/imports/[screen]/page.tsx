import { notFound } from "next/navigation"
import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { importLinks, importScreens } from "@/lib/parity/screenConfigs"

export default async function ImportScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const config = importScreens[screen]

  if (!config) {
    notFound()
  }

  return <ConfiguredInteractiveScreen config={config} links={importLinks} />
}
