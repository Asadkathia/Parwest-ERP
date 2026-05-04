import { NextRequest } from "next/server"
import { z } from "zod"
import { ok, badRequest, notFound } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"
import { nextRunAt } from "@/lib/reports/schedule"

const patchSchema = z.object({
  active: z.boolean().optional(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
  recipients: z.array(z.string().email()).optional(),
  managerIds: z.array(z.string()).optional(),
  formats: z.array(z.enum(["CSV", "XLSX", "PDF"])).optional(),
  paramsJson: z.record(z.string(), z.any()).optional(),
  priority: z.number().int().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireReportsAccess()
  if (error) return error
  const { id } = await params
  const row = await prisma.scheduledReport.findUnique({ where: { id } })
  if (!row) return notFound("Schedule not found")
  return ok(row)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireReportsAccess()
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.message)

  const { id } = await params
  const existing = await prisma.scheduledReport.findUnique({ where: { id } })
  if (!existing) return notFound("Schedule not found")

  const cron = parsed.data.cron ?? existing.cron
  const tz = parsed.data.timezone ?? existing.timezone
  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.cron || parsed.data.timezone) {
    data.nextRunAt = nextRunAt(cron, tz)
  }
  const row = await prisma.scheduledReport.update({ where: { id }, data })
  return ok(row)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireReportsAccess()
  if (error) return error
  const { id } = await params
  await prisma.scheduledReport.delete({ where: { id } })
  return ok({ deleted: true })
}
