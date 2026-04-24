import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { csvDownload, parseReportFormat, toCsv } from "@/lib/reports/utils"

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY"
type ScheduleStatus = "ACTIVE" | "PAUSED"

type ScheduleDefinition = {
  key: string
  reportType: string
  frequency: Frequency
  recipients: string[]
  status: ScheduleStatus
}

const SCHEDULE_DEFINITIONS: ScheduleDefinition[] = [
  {
    key: "guards.deployment",
    reportType: "Guard Deployment",
    frequency: "DAILY",
    recipients: ["ops@parwestgroup.com"],
    status: "ACTIVE",
  },
  {
    key: "guards.day-night-duty",
    reportType: "Day and Night Duty",
    frequency: "DAILY",
    recipients: ["duty@parwestgroup.com"],
    status: "ACTIVE",
  },
  {
    key: "clients.enrolled",
    reportType: "Client Enrolled",
    frequency: "WEEKLY",
    recipients: ["clients@parwestgroup.com"],
    status: "ACTIVE",
  },
  {
    key: "clients.summary",
    reportType: "Client Summary",
    frequency: "MONTHLY",
    recipients: ["finance@parwestgroup.com"],
    status: "ACTIVE",
  },
]

function addFrequency(from: Date, frequency: Frequency) {
  const date = new Date(from)
  if (frequency === "DAILY") {
    date.setUTCDate(date.getUTCDate() + 1)
    return date
  }
  if (frequency === "WEEKLY") {
    date.setUTCDate(date.getUTCDate() + 7)
    return date
  }

  date.setUTCMonth(date.getUTCMonth() + 1)
  return date
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "REPORTS", "VIEW")) return forbidden()

    const url = new URL(request.url)
    const format = parseReportFormat(url.searchParams.get("format"))
    const reportTypeFilter = (url.searchParams.get("reportType") || "").toLowerCase()
    const frequencyFilter = (url.searchParams.get("frequency") || "").toUpperCase()
    const statusFilter = (url.searchParams.get("status") || "").toUpperCase()

    const reportAuditLogs = await prisma.auditLog.findMany({
      where: {
        module: "REPORTS",
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        description: true,
        createdAt: true,
      },
    })

    const rows = SCHEDULE_DEFINITIONS.map((definition) => {
      const match = reportAuditLogs.find((entry) =>
        (entry.description || "").toLowerCase().includes(definition.key)
      )
      const lastGeneratedAt = match?.createdAt || null
      const nextRunAt = lastGeneratedAt ? addFrequency(lastGeneratedAt, definition.frequency) : null

      return {
        key: definition.key,
        reportType: definition.reportType,
        frequency: definition.frequency,
        status: definition.status,
        recipients: definition.recipients.join(";"),
        lastGeneratedAt: lastGeneratedAt ? lastGeneratedAt.toISOString() : "",
        nextRunAt: nextRunAt ? nextRunAt.toISOString() : "",
      }
    })
      .filter((row) =>
        reportTypeFilter
          ? row.reportType.toLowerCase().includes(reportTypeFilter) || row.key.toLowerCase().includes(reportTypeFilter)
          : true
      )
      .filter((row) => (frequencyFilter ? row.frequency === frequencyFilter : true))
      .filter((row) => (statusFilter ? row.status === statusFilter : true))

    if (format === "csv") {
      const csv = toCsv(rows, [
        { key: "key", label: "Schedule Key" },
        { key: "reportType", label: "Report Type" },
        { key: "frequency", label: "Frequency" },
        { key: "status", label: "Status" },
        { key: "recipients", label: "Recipients" },
        { key: "lastGeneratedAt", label: "Last Generated At" },
        { key: "nextRunAt", label: "Next Run At" },
      ])
      return csvDownload("scheduled-reports.csv", csv)
    }

    const summary = {
      totalSchedules: rows.length,
      active: rows.filter((row) => row.status === "ACTIVE").length,
      paused: rows.filter((row) => row.status === "PAUSED").length,
      generated: rows.filter((row) => Boolean(row.lastGeneratedAt)).length,
    }

    return ok({
      report: "scheduled",
      filters: {
        reportType: reportTypeFilter || null,
        frequency: frequencyFilter || null,
        status: statusFilter || null,
      },
      summary,
      rows,
    })
  } catch (error) {
    console.error("Error generating scheduled reports listing:", error)
    return internalServerError("Failed to generate scheduled reports listing.")
  }
}
