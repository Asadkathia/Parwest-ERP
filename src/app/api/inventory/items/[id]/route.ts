import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPrismaCode } from "@/lib/prisma-errors"
import { internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await params
    const body = await request.json()

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        status: body.status ? String(body.status) : undefined,
        vendorId: body.vendorId !== undefined ? (body.vendorId ? String(body.vendorId) : null) : undefined,
        categoryId: body.categoryId ? String(body.categoryId) : undefined,
        regionalOfficeId:
          body.regionalOfficeId !== undefined
            ? body.regionalOfficeId
              ? String(body.regionalOfficeId)
              : null
            : undefined,
      },
      include: {
        category: true,
        vendor: true,
        regionalOffice: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2025") {
      return notFound("Inventory item not found.")
    }
    console.error("Error updating inventory item:", error)
    return internalServerError("Failed to update inventory item.")
  }
}
