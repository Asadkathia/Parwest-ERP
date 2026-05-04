import { NextRequest } from "next/server"
import {
  ok,
  badRequest,
  notFound,
  internalServerError,
} from "@/lib/api/response"
import { requireReportsAccess } from "@/lib/reports/access"
import { getReport } from "@/lib/reports/registry"
import { runReport } from "@/lib/reports/runner"
import { deriveManagerScope } from "@/lib/access/scope"
import { prisma } from "@/lib/db"
import type { ReportFormat } from "@/lib/reports/types"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportKey: string }> }
) {
  const { error, session } = await requireReportsAccess()
  if (error) return error

  const { reportKey } = await params
  const def = await getReport(reportKey)
  if (!def) return notFound("Unknown report")

  const body = (await req.json().catch(() => ({}))) as {
    format?: ReportFormat
    params?: unknown
  }
  const format = (body.format ?? "xlsx") as ReportFormat
  if (!["csv", "xlsx", "pdf"].includes(format)) {
    return badRequest("Invalid format — must be csv, xlsx, or pdf")
  }

  try {
    const scope = deriveManagerScope(session)
    const userId = (session.user as { id?: string }).id ?? ""
    const result = await runReport({
      definition: def,
      rawParams: body.params ?? {},
      format,
      ctx: { userId, scope, prisma },
    })
    return ok({
      runId: result.runId,
      downloadUrl: `/api/reports/library/${result.runId}/download`,
      rowCount: result.rowCount,
    })
  } catch (e) {
    return internalServerError(
      e instanceof Error ? e.message : "Run failed"
    )
  }
}
