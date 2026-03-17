import { NextRequest } from "next/server"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asBool, asText, emitInventoryV2Audit, parseNonNegativeInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

const productInclude = {
  brand: true,
  unit: true,
  status: true,
  condition: true,
  weaponType: true,
  calibre: true,
  licenseType: true,
  variation: true,
  repairing: true,
  balances: true,
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { id } = await params

  try {
    const row = await prisma.storeInventoryProduct.findUnique({
      where: { id },
      include: productInclude,
    })
    if (!row) return notFound("Product not found.")

    return ok(row)
  } catch (error) {
    console.error(`store-inventory v2 products GET (${id}) failed`, error)
    return internalServerError("Failed to fetch product.")
  }
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

    if (body.sku != null) data.sku = String(body.sku).trim()
    if (body.name != null) data.name = String(body.name).trim()
    if (body.description != null) data.description = asText(body.description)
    if (body.serialRequired != null) data.serialRequired = asBool(body.serialRequired)
    if (body.minStockLevel != null) data.minStockLevel = parseNonNegativeInt(body.minStockLevel)
    if (body.maxStockLevel != null) data.maxStockLevel = parseNonNegativeInt(body.maxStockLevel)
    if (body.reorderLevel != null) data.reorderLevel = parseNonNegativeInt(body.reorderLevel)
    if (body.barcode != null) data.barcode = asText(body.barcode)
    if (body.hsCode != null) data.hsCode = asText(body.hsCode)
    if (body.warrantyMonths != null) data.warrantyMonths = parseNonNegativeInt(body.warrantyMonths)
    if (body.licenseNumber != null) data.licenseNumber = asText(body.licenseNumber)
    if (body.brandId != null) data.brandId = asText(body.brandId)
    if (body.unitId != null) data.unitId = asText(body.unitId)
    if (body.statusId != null) data.statusId = asText(body.statusId)
    if (body.conditionId != null) data.conditionId = asText(body.conditionId)
    if (body.weaponTypeId != null) data.weaponTypeId = asText(body.weaponTypeId)
    if (body.calibreId != null) data.calibreId = asText(body.calibreId)
    if (body.licenseTypeId != null) data.licenseTypeId = asText(body.licenseTypeId)
    if (body.variationId != null) data.variationId = asText(body.variationId)
    if (body.repairingId != null) data.repairingId = asText(body.repairingId)

    if (Object.keys(data).length === 0) return badRequest("No valid fields provided for update.")

    const updated = await prisma.storeInventoryProduct.update({
      where: { id },
      data,
      include: productInclude,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "PRODUCT_UPDATED",
      description: `Updated product ${id}`,
      request,
    })

    return ok(updated)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Product not found.")
    if (code === "P2002") return conflict("A product with the same unique field already exists.")
    if (code === "P2003") return badRequest("Related master record does not exist.")

    console.error(`store-inventory v2 products PATCH (${id}) failed`, error)
    return internalServerError("Failed to update product.")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  const { id } = await params

  try {
    await prisma.storeInventoryProduct.delete({ where: { id } })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "PRODUCT_DELETED",
      description: `Deleted product ${id}`,
      request,
    })

    return ok({ id })
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2025") return notFound("Product not found.")
    if (code === "P2003") return conflict("Product is referenced and cannot be deleted.")

    console.error(`store-inventory v2 products DELETE (${id}) failed`, error)
    return internalServerError("Failed to delete product.")
  }
}
