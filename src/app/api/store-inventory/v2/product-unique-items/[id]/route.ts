import { NextRequest } from "next/server"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, ensureRegionalOfficeInScope, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { id } = await params

  try {
    const row = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        category: true,
        condition: true,
        vendor: true,
        regionalOffice: true,
      },
    })
    if (!row) return notFound("Product unique item not found.")

    const denied = await ensureRegionalOfficeInScope(row.regionalOfficeId, session.scope)
    if (denied) return denied

    return ok(row)
  } catch (error) {
    console.error(`store-inventory v2 product unique items GET (${id}) failed`, error)
    return internalServerError("Failed to fetch product unique item.")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id } = await params

  try {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      select: { regionalOfficeId: true },
    })
    if (!existing) return notFound("Product unique item not found.")

    const existingDenied = await ensureRegionalOfficeInScope(existing.regionalOfficeId, session.scope)
    if (existingDenied) return existingDenied

    const body = (await request.json()) as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (body.uniqueNumber != null) data.uniqueNumber = String(body.uniqueNumber).trim()
    if (body.serialNumber != null) data.serialNumber = asText(body.serialNumber)
    if (body.status != null) data.status = asText(body.status)
    if (body.categoryId != null) data.categoryId = asText(body.categoryId)
    if (body.conditionId != null) data.conditionId = asText(body.conditionId)
    if (body.vendorId != null) data.vendorId = asText(body.vendorId)
    if (body.regionalOfficeId != null) {
      const newOffice = asText(body.regionalOfficeId)
      const targetDenied = await ensureRegionalOfficeInScope(newOffice, session.scope)
      if (targetDenied) return targetDenied
      data.regionalOfficeId = newOffice
    }

    if (Object.keys(data).length === 0) {
      return badRequest("No valid fields provided for update.")
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data,
      include: {
        category: true,
        condition: true,
        vendor: true,
        regionalOffice: true,
      },
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "UNIQUE_ITEM_UPDATED",
      description: `Updated product unique item ${id}`,
      request,
    })

    return ok(updated)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Product unique item not found.")
    if (code === "P2003") return badRequest("Related category/condition/vendor/office does not exist.")

    console.error(`store-inventory v2 product unique items PATCH (${id}) failed`, error)
    return internalServerError("Failed to update product unique item.")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id } = await params

  try {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      select: { regionalOfficeId: true },
    })
    if (!existing) return notFound("Product unique item not found.")

    const denied = await ensureRegionalOfficeInScope(existing.regionalOfficeId, session.scope)
    if (denied) return denied

    await prisma.inventoryItem.delete({ where: { id } })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "UNIQUE_ITEM_DELETED",
      description: `Deleted product unique item ${id}`,
      request,
    })

    return ok({ id })
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Product unique item not found.")

    console.error(`store-inventory v2 product unique items DELETE (${id}) failed`, error)
    return internalServerError("Failed to delete product unique item.")
  }
}
