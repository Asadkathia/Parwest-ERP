import { badRequest, internalServerError, ok, unauthorized } from "@/lib/api/response"
import { auth } from "@/lib/auth"
import { readImportPayload, validateImport } from "@/lib/imports/workflow"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ module: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { module } = await params
    const payload = await readImportPayload(request)
    if (!payload.rows.length) {
      return badRequest("No import rows supplied. Provide JSON rows[] or multipart file.")
    }

    const validation = validateImport(module, payload)
    if (!validation) {
      return badRequest(`Unsupported module '${module}'. Supported modules: users, guards, clients, inventory.`)
    }

    return ok(validation)
  } catch (error) {
    console.error("Error validating import:", error)
    return internalServerError("Failed to validate import file")
  }
}
