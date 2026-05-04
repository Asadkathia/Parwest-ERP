import { NextRequest } from "next/server"
import { ok } from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { error } = await requireReportsAccess()
  if (error) return error

  const url = new URL(req.url)
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200)
  const reportKey = url.searchParams.get("reportKey") ?? undefined
  const status = url.searchParams.get("status") ?? undefined
  const requestedById = url.searchParams.get("requestedById") ?? undefined
  const fromStr = url.searchParams.get("from")
  const toStr = url.searchParams.get("to")

  const where: Record<string, unknown> = {}
  if (reportKey) where.reportKey = reportKey
  if (status) where.status = status
  if (requestedById) where.requestedById = requestedById
  if (fromStr || toStr) {
    where.createdAt = {
      ...(fromStr ? { gte: new Date(fromStr) } : {}),
      ...(toStr ? { lte: new Date(toStr) } : {}),
    }
  }

  const rows = await prisma.reportRun.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      reportKey: true,
      format: true,
      status: true,
      rowCount: true,
      fileSize: true,
      createdAt: true,
      finishedAt: true,
      error: true,
      requestedBy: { select: { name: true, email: true } },
    },
  })
  return ok(rows)
}
