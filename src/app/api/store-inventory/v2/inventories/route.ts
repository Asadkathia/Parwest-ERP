import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { hasModuleAccess } from "@/lib/api/permissions"
import { prisma } from "@/lib/db"
import { forbidden, internalServerError, ok, unauthorized } from "@/lib/api/response"

const MAX_MATRIX_ROWS = 5000

type CategoryScope = "NON_WEAPON" | "WEAPON" | "AMMO"

function normalizeCategoryScope(value: string | null): CategoryScope {
  const raw = String(value ?? "").trim().toUpperCase()
  if (raw === "WEAPON") return "WEAPON"
  if (raw === "AMMO") return "AMMO"
  return "NON_WEAPON"
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "INVENTORY")) return forbidden()

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")?.trim() || undefined
    const productId = searchParams.get("productId")?.trim() || undefined
    const variationId = searchParams.get("variationId")?.trim() || undefined
    const search = searchParams.get("search")?.trim() || undefined
    const includeZero = searchParams.get("includeZero") !== "false"
    const categoryScope = normalizeCategoryScope(searchParams.get("categoryScope"))

    const weaponCategoryFilter = { category: { is: { name: { contains: "weapon", mode: "insensitive" as const } } } }
    const ammoCategoryFilter = { category: { is: { name: { contains: "ammo", mode: "insensitive" as const } } } }

    const productCategoryWhere =
      categoryScope === "WEAPON"
        ? weaponCategoryFilter
        : categoryScope === "AMMO"
          ? ammoCategoryFilter
          : { NOT: { OR: [weaponCategoryFilter, ammoCategoryFilter] } }

    const balanceRows = await prisma.storeInventoryBalance.findMany({
      where: {
        storeId,
        productId,
        product: {
          variationId: variationId || undefined,
          ...productCategoryWhere,
        },
        OR: search
          ? [
              { product: { name: { contains: search, mode: "insensitive" } } },
              { product: { sku: { contains: search, mode: "insensitive" } } },
              { product: { variation: { name: { contains: search, mode: "insensitive" } } } },
              { store: { name: { contains: search, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: {
        store: true,
        product: {
          include: {
            category: true,
            variation: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    })

    if (!includeZero) {
      return ok(balanceRows)
    }

    const [storeRows, productRows] = await Promise.all([
      prisma.store.findMany({
        where: {
          id: storeId,
          isActive: true,
          name: search ? { contains: search, mode: "insensitive" } : undefined,
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          prefix: true,
          isHeadOffice: true,
          latitude: true,
          longitude: true,
          address: true,
          contactNumber: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          regionalOfficeId: true,
        },
      }),
      prisma.storeInventoryProduct.findMany({
        where: {
          id: productId,
          variationId: variationId || undefined,
          ...productCategoryWhere,
          OR: search
            ? [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
                { variation: { name: { contains: search, mode: "insensitive" } } },
              ]
            : undefined,
        },
        include: {
          category: true,
          variation: true,
        },
        orderBy: { name: "asc" },
        take: 1000,
      }),
    ])

    if (!storeRows.length || !productRows.length) return ok([])

    const balanceByKey = new Map(
      balanceRows.map((row) => [`${row.storeId}::${row.productId}`, row] as const)
    )

    const matrixRows: Array<{
      id: string
      quantityOnHand: number
      quantityHeld: number
      quantityIssued: number
      avgUnitCost: number | null
      updatedAt: Date
      store: (typeof storeRows)[number]
      product: (typeof productRows)[number]
      storeId: string
      productId: string
    }> = []

    for (const store of storeRows) {
      for (const product of productRows) {
        const matched = balanceByKey.get(`${store.id}::${product.id}`)
        matrixRows.push({
          id: matched?.id || `zero:${store.id}:${product.id}`,
          storeId: store.id,
          productId: product.id,
          quantityOnHand: matched?.quantityOnHand ?? 0,
          quantityHeld: matched?.quantityHeld ?? 0,
          quantityIssued: matched?.quantityIssued ?? 0,
          avgUnitCost: matched?.avgUnitCost ?? null,
          updatedAt: matched?.updatedAt ?? new Date(0),
          store,
          product,
        })
        if (matrixRows.length >= MAX_MATRIX_ROWS) break
      }
      if (matrixRows.length >= MAX_MATRIX_ROWS) break
    }

    return ok(matrixRows)
  } catch (error) {
    console.error("store-inventory v2 inventories GET failed", error)
    return internalServerError("Failed to fetch inventory balances.")
  }
}
