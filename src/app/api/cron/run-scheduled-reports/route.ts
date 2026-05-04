import { NextRequest } from "next/server"
import { ok, unauthorized } from "@/lib/api/response"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { prisma } from "@/lib/db"
import { getReport } from "@/lib/reports/registry"
import { runReport } from "@/lib/reports/runner"
import { nextRunAt } from "@/lib/reports/schedule"
import { sendReportEmail, isEmailConfigured } from "@/lib/reports/email"
import { contentTypeFor } from "@/lib/reports/storage"
import type { ReportFormat } from "@/lib/reports/types"

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return unauthorized("Unauthorized")
  const now = new Date()
  const due = await prisma.scheduledReport.findMany({
    where: { active: true, nextRunAt: { lte: now } },
    take: 25,
    orderBy: [{ priority: "desc" }, { nextRunAt: "asc" }],
  })

  const results: Array<{ id: string; ok: boolean; runs?: number; error?: string }> =
    []

  for (const sched of due) {
    const def = await getReport(sched.reportKey)
    if (!def) {
      results.push({ id: sched.id, ok: false, error: "Unknown reportKey" })
      continue
    }
    try {
      const ctx = {
        userId: sched.createdById,
        scope: null,
        prisma,
      }
      const runs = await Promise.all(
        sched.formats.map((f) =>
          runReport({
            definition: def,
            rawParams: sched.paramsJson,
            format: f.toLowerCase() as ReportFormat,
            ctx,
            scheduledId: sched.id,
          })
        )
      )

      const managers = sched.managerIds.length
        ? await prisma.user.findMany({
            where: { id: { in: sched.managerIds } },
            select: { email: true },
          })
        : []
      const recipients = [
        ...sched.recipients,
        ...(managers.map((m) => m.email).filter(Boolean) as string[]),
      ]

      if (isEmailConfigured() && recipients.length) {
        await sendReportEmail({
          recipients,
          subject: `${def.title} — ${now.toISOString().slice(0, 10)}`,
          body: `Automated report attached.`,
          attachments: runs.map((r, i) => {
            const ext = sched.formats[i].toLowerCase() as "csv" | "xlsx" | "pdf"
            return {
              fileKey: r.fileKey,
              filename: `${def.key}-${now.toISOString().slice(0, 10)}.${ext}`,
              contentType: contentTypeFor(ext),
            }
          }),
        })
      }

      const next = nextRunAt(sched.cron, sched.timezone, now)
      await prisma.scheduledReport.update({
        where: { id: sched.id },
        data: { lastRunAt: now, nextRunAt: next },
      })
      results.push({ id: sched.id, ok: true, runs: runs.length })
    } catch (e) {
      results.push({
        id: sched.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return ok({ processed: results.length, results })
}
