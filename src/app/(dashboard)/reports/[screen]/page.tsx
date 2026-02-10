import { notFound } from "next/navigation"
import UiDocScreen from "@/components/parity/UiDocScreen"
import { reportLinks, reportScreens } from "@/lib/parity/screenConfigs"

export default async function ReportScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const config = reportScreens[screen]

  if (!config) {
    notFound()
  }

  return <UiDocScreen {...config} links={reportLinks} />
}
