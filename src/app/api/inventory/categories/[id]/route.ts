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
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ message: "Name is required." }, { status: 400 })

    const updated = await prisma.inventoryCategory.update({
      where: { id },
      data: { name },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Category not found." }, { status: 404 })
    }
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Category already exists." }, { status: 409 })
    }
    console.error("Error updating inventory category:", error)
    return NextResponse.json({ message: "Failed to update category." }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await params

    await prisma.inventoryCategory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Category not found." }, { status: 404 })
    }
    console.error("Error deleting inventory category:", error)
    return NextResponse.json({ message: "Failed to delete category." }, { status: 500 })
  }
}
