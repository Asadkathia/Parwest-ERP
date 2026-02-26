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
    const data: { name?: string } = {}

    if (body.name !== undefined) {
      const name = String(body.name || "").trim()
      if (!name) return NextResponse.json({ message: "Name is required." }, { status: 400 })
      data.name = name
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No fields provided." }, { status: 400 })

    if (isMockEnabled()) return NextResponse.json({ id, ...data })

    const updated = await prisma.guardBankName.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for guard bank names yet." }, { status: 503 })
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Bank name not found." }, { status: 404 })
    if (String(error?.code) === "P2002") return NextResponse.json({ message: "Bank name already exists." }, { status: 409 })
    console.error("Error updating guard bank name:", error)
    return NextResponse.json({ message: "Failed to update bank name." }, { status: 500 })
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

    await prisma.guardBankName.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for guard bank names yet." }, { status: 503 })
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Bank name not found." }, { status: 404 })
    console.error("Error deleting guard bank name:", error)
    return NextResponse.json({ message: "Failed to delete bank name." }, { status: 500 })
  }
}
