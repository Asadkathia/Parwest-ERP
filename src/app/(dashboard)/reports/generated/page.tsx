import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import OperationalReportScreen from "@/components/reports/OperationalReportScreen"
import { reportLinks, reportScreens } from "@/lib/parity/screenConfigs"

export default async function GeneratedReportsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return <OperationalReportScreen screen="scheduled" config={reportScreens.scheduled} links={reportLinks} />
}
