import { NextRequest } from "next/server"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, ok } from "@/lib/api/response"
import { emitInventoryV2Audit, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { getMasterConfig, isValidMasterResource } from "@/lib/inventory/store-v2-masters"

function parseParams(request: NextRequest) {
  const pathname = new URL(request.url).pathname
  const parts = pathname.split("/").filter(Boolean)
  return {
    id: parts[parts.length - 1] ?? "",
    resource: parts[parts.length - 2] ?? "",
  }
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { id, resource } = parseParams(request)
  if (!isValidMasterResource(resource)) return notFound("Master resource not found.")

  try {
    const config = getMasterConfig(resource)
    const row = await config.delegate.findUnique({
      where: { id },
      include: config.include,
    })
    if (!row) return notFound("Master record not found.")

    return ok(row)
  } catch (error) {
    console.error(`store-inventory v2 masters GET by id (${resource}/${id}) failed`, error)
    return internalServerError("Failed to fetch master record.")
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id, resource } = parseParams(request)
  if (!isValidMasterResource(resource)) return notFound("Master resource not found.")

  try {
    const body = (await request.json()) as Record<string, unknown>
    const config = getMasterConfig(resource)
    const data = config.buildUpdateData(body)
    if (Object.keys(data).length === 0) return badRequest("No valid fields provided for update.")

    const updated = await config.delegate.update({
      where: { id },
      data,
      include: config.include,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "MASTER_UPDATED",
      description: `Updated ${resource} record ${id}`,
      request,
    })

    return ok(updated)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Master record not found.")
    if (code === "P2002") return conflict("A record with the same unique value already exists.")
    if (code === "P2003") return badRequest("Related record does not exist.")

    console.error(`store-inventory v2 masters PATCH (${resource}/${id}) failed`, error)
    return internalServerError("Failed to update master record.")
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id, resource } = parseParams(request)
  if (!isValidMasterResource(resource)) return notFound("Master resource not found.")

  try {
    await getMasterConfig(resource).delegate.delete({ where: { id } })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "MASTER_DELETED",
      description: `Deleted ${resource} record ${id}`,
      request,
    })

    return ok({ id })
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Master record not found.")
    if (code === "P2003") return conflict("Record is still referenced and cannot be deleted.")

    console.error(`store-inventory v2 masters DELETE (${resource}/${id}) failed`, error)
    return internalServerError("Failed to delete master record.")
  }
}
