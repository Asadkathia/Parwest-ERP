import { NextRequest } from "next/server"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, ok } from "@/lib/api/response"
import { prisma } from "@/lib/db"
import { asText, emitInventoryV2Audit, requireInventorySession, requireV2WriteEnabled } from "@/lib/inventory/store-v2-api"

export async function GET() {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  try {
    const rows = await prisma.inventoryItem.findMany({
      include: {
        category: true,
        condition: true,
        vendor: true,
        regionalOffice: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    })

    return ok(rows)
  } catch (error) {
    console.error("store-inventory v2 product unique items GET failed", error)
    return internalServerError("Failed to fetch product unique items.")
  }
}

export async function POST(request: NextRequest) {
  const session = await requireInventorySession()
  if (session instanceof Response) return session

  const writeBlocked = requireV2WriteEnabled()
  if (writeBlocked) return writeBlocked

  try {
    const body = (await request.json()) as Record<string, unknown>
    const uniqueNumber = String(body.uniqueNumber ?? "").trim()
    const categoryId = asText(body.categoryId)

    if (!uniqueNumber || !categoryId) {
      return badRequest("uniqueNumber and categoryId are required.")
    }

    const created = await prisma.inventoryItem.create({
      data: {
        uniqueNumber,
        serialNumber: asText(body.serialNumber),
        status: asText(body.status) || "AVAILABLE",
        categoryId,
        conditionId: asText(body.conditionId),
        vendorId: asText(body.vendorId),
        regionalOfficeId: asText(body.regionalOfficeId),
        isNonUnique: false,
        quantity: 1,
      },
      include: {
        category: true,
        condition: true,
        vendor: true,
        regionalOffice: true,
      },
    })

    await emitInventoryV2Audit({
      userId: session.userId,
      event: "UNIQUE_ITEM_CREATED",
      description: `Created product unique item ${created.id} (${created.uniqueNumber})`,
      request,
    })

    return ok(created, 201)
  } catch (error) {
    const code = getPrismaCode(error)
    if (code === "P2002") return conflict("Unique number already exists.")
    if (code === "P2003") return badRequest("Related category/condition/vendor/office does not exist.")

    console.error("store-inventory v2 product unique items POST failed", error)
    return internalServerError("Failed to create product unique item.")
  }
}
