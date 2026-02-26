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
    const name = body?.name != null ? String(body.name).trim() : undefined
    const description = body?.description !== undefined ? (body.description ? String(body.description) : null) : undefined
    const data: any = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No fields provided." }, { status: 400 })

    if (isMockEnabled()) return NextResponse.json({ id, ...data })

    const updated = await prisma.inventoryCondition.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for inventory conditions yet." }, { status: 503 })
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Condition not found." }, { status: 404 })
    if (String(error?.code) === "P2002") return NextResponse.json({ message: "Condition already exists." }, { status: 409 })
    console.error("Error updating inventory condition:", error)
    return NextResponse.json({ message: "Failed to update condition." }, { status: 500 })
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
    if (isMockEnabled()) return NextResponse.json({ success: true })

    await prisma.inventoryCondition.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for inventory conditions yet." }, { status: 503 })
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Condition not found." }, { status: 404 })
    if (String(error?.code) === "P2003") return NextResponse.json({ message: "Condition is in use by inventory items." }, { status: 409 })
    console.error("Error deleting inventory condition:", error)
    return NextResponse.json({ message: "Failed to delete condition." }, { status: 500 })
  }
}
