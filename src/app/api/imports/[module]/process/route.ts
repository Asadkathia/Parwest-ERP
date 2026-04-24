import { badRequest, forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { hasAction } from "@/lib/api/permissions"
import { processImport, readImportPayload, validateImport } from "@/lib/imports/workflow"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ module: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "IMPORTS", "CREATE")) return forbidden()

    const { module } = await params
    const payload = await readImportPayload(request)
    if (!payload.rows.length) {
      return badRequest("No import rows supplied. Provide JSON rows[] or multipart file.")
    }

    const validation = validateImport(module, payload)
    if (!validation) {
      return badRequest(`Unsupported module '${module}'. Supported modules: users, guards, clients, inventory.`)
    }

    const job = await processImport(validation.module, payload, validation)
    return ok(job, 202)
  } catch (error) {
    console.error("Error processing import:", error)
    return internalServerError("Failed to process import file")
  }
}
