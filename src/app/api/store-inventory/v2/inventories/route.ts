import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { internalServerError, ok, unauthorized } from "@/lib/api/response"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")?.trim() || undefined
    const productId = searchParams.get("productId")?.trim() || undefined
    const search = searchParams.get("search")?.trim() || undefined

    const rows = await prisma.storeInventoryBalance.findMany({
      where: {
        storeId,
        productId,
        OR: search
          ? [
              { product: { name: { contains: search, mode: "insensitive" } } },
              { product: { sku: { contains: search, mode: "insensitive" } } },
              { store: { name: { contains: search, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: {
        store: true,
        product: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    })

    return ok(rows)
  } catch (error) {
    console.error("store-inventory v2 inventories GET failed", error)
    return internalServerError("Failed to fetch inventory balances.")
  }
}
