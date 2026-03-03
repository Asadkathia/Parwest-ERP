import { NextResponse } from "next/server"
import { badRequest, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { getImportJob, toErrorCsv } from "@/lib/imports/workflow"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session) return unauthorized()

  const { jobId } = await params
  if (!jobId) return badRequest("jobId is required")

  const job = getImportJob(jobId)
  if (!job) {
    return badRequest("Import job not found")
  }

  const format = new URL(request.url).searchParams.get("format") || "json"
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

  return NextResponse.json({
    success: true,
    data: {
      jobId,
      totalErrors: job.errors.length,
      errors: job.errors,
    },
  })
}
