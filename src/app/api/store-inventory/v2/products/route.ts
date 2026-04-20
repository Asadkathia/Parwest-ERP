import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asBool, asText, emitInventoryV2Audit, parseNonNegativeInt, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

const productInclude = {
  brand: true,
  unit: true,
  status: true,
  condition: true,
  category: true,
  weaponType: true,
  calibre: true,
  licenseType: true,
  variation: true,
  repairing: true,
}

const legacyProductInclude = {
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
const legacyProductSelectBase = {
  id: true,
  sku: true,
  name: true,
  description: true,
  serialRequired: true,
  minStockLevel: true,
  maxStockLevel: true,
  reorderLevel: true,
  barcode: true,
  hsCode: true,
  warrantyMonths: true,
  licenseNumber: true,
  createdAt: true,
  updatedAt: true,
}

export async function GET(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim()
  const includeBalances = searchParams.get("includeBalances") === "true"

  try {
    const where: Prisma.StoreInventoryProductWhereInput | undefined = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { barcode: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined
    let rows
    try {
      rows = await prisma.storeInventoryProduct.findMany({
        where,
        include: {
          ...productInclude,
          balances: includeBalances,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    } catch (error) {
      const code = getPrismaCode(error)
      const message = error instanceof Error ? error.message : ""
      if (message.includes("Unknown field `category`") || code === "P2022" || code === "P2021") {
        rows = await prisma.storeInventoryProduct.findMany({
          where,
          select: {
            ...legacyProductSelectBase,
            brand: true,
            unit: true,
            status: true,
            condition: true,
            weaponType: true,
            calibre: true,
            licenseType: true,
            variation: true,
            repairing: true,
            balances: includeBalances,
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        } as Prisma.StoreInventoryProductFindManyArgs)
      } else {
        throw error
      }
    }

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
    const size = asText(body.size)
    const color = asText(body.color)

    let resolvedVariationId = asText(body.variationId)
    if (!resolvedVariationId && (size || color)) {
      const variationName = [size, color].filter(Boolean).join(" / ")
      if (variationName) {
        try {
          const variation = await prisma.storeInventoryVariation.upsert({
            where: { name: variationName },
            update: {},
            create: { name: variationName },
          })
          resolvedVariationId = variation.id
        } catch {
          // fallback to provided variationId behavior if variation table is unavailable
        }
      }
    }

    const baseData: Prisma.StoreInventoryProductUncheckedCreateInput = {
      sku,
      name,
      description: asText(body.description),
      imageUrl: asText(body.imageUrl),
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
      categoryId: asText(body.categoryId),
      weaponTypeId: asText(body.weaponTypeId),
      calibreId: asText(body.calibreId),
      licenseTypeId: asText(body.licenseTypeId),
      variationId: resolvedVariationId,
      repairingId: asText(body.repairingId),
    }
    let created
    try {
      created = await prisma.storeInventoryProduct.create({
        data: baseData,
        include: productInclude as Prisma.StoreInventoryProductInclude,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (
        !message.includes("Unknown argument `categoryId`") &&
        !message.includes("Unknown argument `imageUrl`") &&
        !message.includes("Unknown field `category`")
      ) {
        throw error
      }
      const fallbackData: Record<string, unknown> = { ...baseData }
      delete fallbackData.categoryId
      delete fallbackData.imageUrl
      created = await prisma.storeInventoryProduct.create({
        data: fallbackData as Prisma.StoreInventoryProductUncheckedCreateInput,
        include: legacyProductInclude as Prisma.StoreInventoryProductInclude,
      })
    }

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
