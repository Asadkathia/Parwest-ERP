import { notFound } from "next/navigation"
import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import { reportLinks, reportScreens } from "@/lib/parity/screenConfigs"

export default async function ReportScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const config = reportScreens[screen]

  if (!config) {
    notFound()
  }

  return <ConfiguredInteractiveScreen config={config} links={reportLinks} />
}
