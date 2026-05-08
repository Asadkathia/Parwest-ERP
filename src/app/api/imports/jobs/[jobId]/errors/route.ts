import { NextResponse } from "next/server"

import { badRequest, forbidden, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { buildErrorReportXlsx } from "@/lib/imports/excel"
import { getImportJob, toErrorCsv } from "@/lib/imports/workflow"

/**
 * GET /api/imports/jobs/:jobId/errors?format=csv|xlsx|json
 *
 * The .xlsx variant returns a sheet containing only the rows that
 * failed validation/persistence, with an extra `__error_reason` column
 * — this is the "invalid rows file" the doc calls out as the canonical
 * QA hand-off.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!hasAction(session, "IMPORTS", "VIEW")) return forbidden()

  const { jobId } = await params
  if (!jobId) return badRequest("jobId is required")

  const job = await getImportJob(jobId)
  if (!job) return badRequest("Import job not found")

  const format = (new URL(request.url).searchParams.get("format") || "json").toLowerCase()

  if (format === "csv") {
    const csv = toErrorCsv(job.errors)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="import-errors-${jobId}.csv"`,
      },
    })
  }

  if (format === "xlsx") {
    // We don't have the original parsed rows here (job stores headers + errors,
    // not the data set). Build a minimal sheet keyed on the errors so QA still
    // gets a downloadable file; richer reproduction requires the upload to be
    // re-attached on the job row (Tier-future work — fileBlob).
    const buffer = await buildErrorReportXlsx({
      label: job.module + (job.subModule ? `::${job.subModule}` : ""),
      headers: job.validation.headers,
      rows: [],
      errors: job.errors,
    })
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="import-errors-${jobId}.xlsx"`,
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: { jobId, totalErrors: job.errors.length, errors: job.errors },
  })
}
