import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()
    const data: any = {}

    if (body.quantity != null) {
      const quantity = Number(body.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ message: "quantity must be a positive number." }, { status: 400 })
      }
      data.quantity = quantity
    }
    if (body.categoryId !== undefined) data.categoryId = body.categoryId ? String(body.categoryId) : null
    if (body.regionalOfficeId !== undefined) data.regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId) : null
    if (body.reason !== undefined) data.reason = body.reason ? String(body.reason) : null
    if (body.status !== undefined) data.status = String(body.status)
    if (body.requiredBy !== undefined) {
      if (!body.requiredBy) {
        data.requiredBy = null
      } else {
        const requiredBy = new Date(String(body.requiredBy))
        if (Number.isNaN(requiredBy.getTime())) return NextResponse.json({ message: "Invalid requiredBy date." }, { status: 400 })
        data.requiredBy = requiredBy
      }
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No fields provided." }, { status: 400 })

    if (isMockEnabled()) return NextResponse.json({ id, ...data })

    const updated = await prisma.inventoryDemand.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for inventory demand yet." }, { status: 503 })
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Demand not found." }, { status: 404 })
    if (String(error?.code) === "P2003") return NextResponse.json({ message: "Invalid category or regional office." }, { status: 400 })
    console.error("Error updating inventory demand:", error)
    return NextResponse.json({ message: "Failed to update demand." }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await context.params

    if (isMockEnabled()) return NextResponse.json({ success: true, id })

    await prisma.inventoryDemand.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for inventory demand yet." }, { status: 503 })
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Demand not found." }, { status: 404 })
    console.error("Error deleting inventory demand:", error)
    return NextResponse.json({ message: "Failed to delete demand." }, { status: 500 })
  }
}
