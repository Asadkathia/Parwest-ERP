import { DashboardKpis } from "@/components/reports/DashboardKpis"
import { DashboardCharts } from "@/components/reports/DashboardCharts"
import { PinnedReports } from "@/components/reports/PinnedReports"
import { RecentRuns } from "@/components/reports/RecentRuns"

export default function ReportsDashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardKpis />
      <DashboardCharts />
      <div className="grid gap-4 md:grid-cols-2">
        <PinnedReports />
        <RecentRuns />
      </div>
    </div>
  )
}
