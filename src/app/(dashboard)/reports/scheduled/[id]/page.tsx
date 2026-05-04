import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { ScheduledReportForm } from "@/components/reports/ScheduledReportForm"

export default async function EditSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const row = await prisma.scheduledReport.findUnique({ where: { id } })
  if (!row) notFound()
  return (
    <ScheduledReportForm
      existing={{
        id: row.id,
        reportKey: row.reportKey,
        cron: row.cron,
        timezone: row.timezone,
        recipients: row.recipients,
        formats: row.formats,
        active: row.active,
        paramsJson: (row.paramsJson as Record<string, unknown>) ?? {},
      }}
    />
  )
}
