import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import SectionTitle from "@/components/ui/section-title"
import SystemReportList from "@/components/reports/SystemReportList"
import { mockGeneratedReports, mockReportTemplates } from "@/lib/mockData"

export default async function GeneratedReportsListPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle title="Generated Reports List" subtitle="System-generated templates and recent outputs." />
      <SystemReportList templates={mockReportTemplates} generated={mockGeneratedReports} />
    </div>
  )
}
