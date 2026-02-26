import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
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
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Inventory item not found." }, { status: 404 })
    }
    console.error("Error updating inventory item:", error)
    return NextResponse.json({ message: "Failed to update inventory item." }, { status: 500 })
  }
}
