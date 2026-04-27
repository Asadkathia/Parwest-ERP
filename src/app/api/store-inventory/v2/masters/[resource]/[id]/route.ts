import { NextRequest } from "next/server"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, forbidden, internalServerError, notFound, ok } from "@/lib/api/response"
import { emitInventoryV2Audit, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import { getMasterConfig, isValidMasterResource } from "@/lib/inventory/store-v2-masters"
import { prisma } from "@/lib/db"
import type { ManagerScope } from "@/lib/access/scope"

/**
 * Verify a store is within the user's regional scope before mutating it.
 * Returns null if allowed (or if user is not regionally scoped), or a
 * forbidden Response if the store is outside scope.
 */
async function ensureStoreInScope(id: string, scope: ManagerScope | null): Promise<Response | null> {
  if (!scope) return null
  const store = await prisma.store.findUnique({
    where: { id },
    select: { regionalOfficeId: true, regionalOffice: { select: { regionId: true } } },
  })
  if (!store) return notFound("Master record not found.")
  if (scope.regionalOfficeIds.length > 0) {
    if (!store.regionalOfficeId || !scope.regionalOfficeIds.includes(store.regionalOfficeId)) {
      return forbidden("Forbidden: store is outside your assigned regional office.")
    }
  } else if (scope.regionId) {
    if (!store.regionalOffice || store.regionalOffice.regionId !== scope.regionId) {
      return forbidden("Forbidden: store is outside your assigned region.")
    }
  }
  return null
}

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
    if (resource === "stores") {
      const denied = await ensureStoreInScope(id, session.scope)
      if (denied) return denied
    }

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
    if (resource === "stores") {
      const denied = await ensureStoreInScope(id, session.scope)
      if (denied) return denied
    }

    const body = (await request.json()) as Record<string, unknown>
    const config = getMasterConfig(resource)
    const data = config.buildUpdateData(body)
    if (Object.keys(data).length === 0) return badRequest("No valid fields provided for update.")

    // For stores, also block reassignment to an out-of-scope regional office.
    if (resource === "stores" && session.scope && "regionalOfficeId" in data) {
      const newOfficeId = data.regionalOfficeId ? String(data.regionalOfficeId) : null
      const allowedOffices = session.scope.regionalOfficeIds
      if (allowedOffices.length > 0) {
        if (!newOfficeId || !allowedOffices.includes(newOfficeId)) {
          return forbidden("Forbidden: cannot move a store outside your assigned regional office.")
        }
      } else if (session.scope.regionId && newOfficeId) {
        const office = await prisma.regionalOffice.findUnique({
          where: { id: newOfficeId },
          select: { regionId: true },
        })
        if (!office || office.regionId !== session.scope.regionId) {
          return forbidden("Forbidden: cannot move a store outside your assigned region.")
        }
      }
    }

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
    if (resource === "stores") {
      const denied = await ensureStoreInScope(id, session.scope)
      if (denied) return denied
    }

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
