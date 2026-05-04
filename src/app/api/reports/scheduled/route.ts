import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, badRequest } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"
import { nextRunAt } from "@/lib/reports/schedule"
import { getReport } from "@/lib/reports/registry"

const createSchema = z.object({
  reportKey: z.string(),
  paramsJson: z.record(z.string(), z.any()).default({}),
  formats: z.array(z.enum(["CSV", "XLSX", "PDF"])).min(1),
  cron: z.string(),
  timezone: z.string().default("Asia/Karachi"),
  recipients: z.array(z.string().email()),
  managerIds: z.array(z.string()).default([]),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
})

export async function GET() {
  const { error } = await requireReportsAccess()
  if (error) return error
  const rows = await prisma.scheduledReport.findMany({
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
    include: { createdBy: { select: { name: true, email: true } } },
  })
  return ok(rows)
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireReportsAccess()
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.message)
  if (!(await getReport(parsed.data.reportKey))) {
    return badRequest("Unknown reportKey")
  }

  const next = nextRunAt(parsed.data.cron, parsed.data.timezone)
  const userId = (session.user as { id?: string }).id ?? ""
  const row = await prisma.scheduledReport.create({
    data: {
      reportKey: parsed.data.reportKey,
      paramsJson: parsed.data.paramsJson,
      formats: parsed.data.formats,
      cron: parsed.data.cron,
      timezone: parsed.data.timezone,
      recipients: parsed.data.recipients,
      managerIds: parsed.data.managerIds,
      priority: parsed.data.priority,
      active: parsed.data.active,
      createdById: userId,
      nextRunAt: next,
    },
  })
  return ok(row)
}
