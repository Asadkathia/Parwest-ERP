import { badRequest, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { getImportJob } from "@/lib/imports/workflow"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { jobId } = await params
    if (!jobId) return badRequest("jobId is required")

    const job = getImportJob(jobId)
    if (!job) {
      return badRequest("Import job not found")
    }

    return ok(job)
  } catch (error) {
    console.error("Error fetching import job:", error)
    return internalServerError("Failed to fetch import job")
  }
}
