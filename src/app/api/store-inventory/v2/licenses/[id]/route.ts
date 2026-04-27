import { NextRequest } from "next/server"
import { badRequest, conflict, forbidden, internalServerError, notFound, ok } from "@/lib/api/response"
import { getPrismaCode } from "@/lib/prisma-errors"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, ensureClientInScope, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"
import type { ManagerScope } from "@/lib/access/scope"

async function ensureLicenseInScope(licenseId: string, scope: ManagerScope | null): Promise<Response | null> {
  if (!scope) return null
  const license = await prisma.storeInventoryLicense.findUnique({
    where: { id: licenseId },
    select: { clientId: true },
  })
  if (!license) return notFound("License not found.")
  if (!license.clientId) {
    // Unattached licenses: deny regional users; SuperAdmin already returns null above.
    return forbidden("Forbidden: license is not attached to a client in your region.")
  }
  return ensureClientInScope(license.clientId, scope)
}

type Params = { params: Promise<{ id: string }> }

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value == null || value === "") return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  return date
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id } = await params

  try {
    const body = (await request.json()) as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (body.validity != null) data.validity = asText(body.validity)
    if (body.licenseNumber != null) data.licenseNumber = asText(body.licenseNumber)
    if (body.clientId != null) data.clientId = asText(body.clientId)
    if (body.weaponNumber != null) data.weaponNumber = asText(body.weaponNumber)
    if (body.weaponTypeId != null) data.weaponTypeId = asText(body.weaponTypeId)
    if (body.calibreId != null) data.calibreId = asText(body.calibreId)
    if (body.issueDate !== undefined) data.issueDate = parseDate(body.issueDate)
    if (body.expiryDate !== undefined) data.expiryDate = parseDate(body.expiryDate)
    if (body.attachmentName != null) data.attachmentName = asText(body.attachmentName)

    if (Object.keys(data).length === 0) return badRequest("No valid fields provided for update.")

    const denied = await ensureLicenseInScope(id, session.scope)
    if (denied) return denied

    // Reassigning to a different client must also stay within scope.
    if (body.clientId != null) {
      const newClientId = asText(body.clientId)
      if (newClientId) {
        const targetDenied = await ensureClientInScope(newClientId, session.scope)
        if (targetDenied) return targetDenied
      } else if (session.scope) {
        return forbidden("Forbidden: cannot detach license from client.")
      }
    }

    const updated = await prisma.storeInventoryLicense.update({
      where: { id },
      data,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "LICENSE_UPDATED",
      description: `Updated inventory license ${id}`,
      request,
    })

    return ok(updated)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("License not found.")
    if (code === "P2002") return conflict("License number already exists.")
    if (code === "P2003") return badRequest("Related reference does not exist.")

    console.error(`store-inventory v2 licenses PATCH (${id}) failed`, error)
    return internalServerError("Failed to update license.")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id } = await params

  try {
    const denied = await ensureLicenseInScope(id, session.scope)
    if (denied) return denied

    await prisma.storeInventoryLicense.delete({ where: { id } })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "LICENSE_DELETED",
      description: `Deleted inventory license ${id}`,
      request,
    })

    return ok({ id })
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("License not found.")

    console.error(`store-inventory v2 licenses DELETE (${id}) failed`, error)
    return internalServerError("Failed to delete license.")
  }
}
