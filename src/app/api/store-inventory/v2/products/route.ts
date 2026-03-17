import { NextRequest } from "next/server"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, ok } from "@/lib/api/response"
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
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim()
  const includeBalances = searchParams.get("includeBalances") === "true"

  try {
    const rows = await prisma.storeInventoryProduct.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        ...productInclude,
        balances: includeBalances,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    return ok(rows)
  } catch (error) {
    console.error("store-inventory v2 products GET failed", error)
    return internalServerError("Failed to fetch products.")
  }
}

export async function POST(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  try {
    const body = (await request.json()) as Record<string, unknown>
    const sku = String(body.sku ?? "").trim()
    const name = String(body.name ?? "").trim()
    if (!sku || !name) return badRequest("sku and name are required.")

    const created = await prisma.storeInventoryProduct.create({
      data: {
        sku,
        name,
        description: asText(body.description),
        serialRequired: asBool(body.serialRequired),
        minStockLevel: parseNonNegativeInt(body.minStockLevel),
        maxStockLevel: parseNonNegativeInt(body.maxStockLevel),
        reorderLevel: parseNonNegativeInt(body.reorderLevel),
        barcode: asText(body.barcode),
        hsCode: asText(body.hsCode),
        warrantyMonths: parseNonNegativeInt(body.warrantyMonths),
        licenseNumber: asText(body.licenseNumber),
        brandId: asText(body.brandId),
        unitId: asText(body.unitId),
        statusId: asText(body.statusId),
        conditionId: asText(body.conditionId),
        weaponTypeId: asText(body.weaponTypeId),
        calibreId: asText(body.calibreId),
        licenseTypeId: asText(body.licenseTypeId),
        variationId: asText(body.variationId),
        repairingId: asText(body.repairingId),
      },
      include: productInclude,
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "PRODUCT_CREATED",
      description: `Created product ${created.id} (${created.sku})`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2002") return conflict("A product with the same SKU already exists.")
    if (code === "P2003") return badRequest("Related master record does not exist.")

    console.error("store-inventory v2 products POST failed", error)
    return internalServerError("Failed to create product.")
  }
}
