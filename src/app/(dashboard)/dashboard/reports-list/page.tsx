import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SectionTitle from "@/components/ui/section-title"
import SystemReportList from "@/components/reports/SystemReportList"
import { mockGeneratedReports, mockReportTemplates } from "@/lib/mockData"

export default async function ReportsListPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Reports List"
        subtitle="System-generated report templates and recent generated outputs"
      />
      <SystemReportList templates={mockReportTemplates} generated={mockGeneratedReports} />
    </div>
  )
}
