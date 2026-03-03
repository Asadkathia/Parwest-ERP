import { notFound } from "next/navigation"
import ConfiguredInteractiveScreen from "@/components/parity/ConfiguredInteractiveScreen"
import OperationalReportScreen from "@/components/reports/OperationalReportScreen"
import { isOperationalReportScreen } from "@/lib/reports/bindings"
import { reportLinks, reportScreens } from "@/lib/parity/screenConfigs"

export default async function ReportScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params
  const config = reportScreens[screen]

  if (!config) {
    notFound()
  }

  if (isOperationalReportScreen(screen)) {
    return <OperationalReportScreen screen={screen} config={config} links={reportLinks} />
  }

  return <ConfiguredInteractiveScreen config={config} links={reportLinks} />
}
