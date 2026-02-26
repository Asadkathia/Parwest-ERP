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
    const contact = body.contact ? String(body.contact).trim() : null
    if (!name) return NextResponse.json({ message: "Name is required." }, { status: 400 })

    const updated = await prisma.inventoryVendor.update({
      where: { id },
      data: { name, contact },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Vendor not found." }, { status: 404 })
    }
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Vendor already exists." }, { status: 409 })
    }
    console.error("Error updating inventory vendor:", error)
    return NextResponse.json({ message: "Failed to update vendor." }, { status: 500 })
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

    await prisma.inventoryVendor.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Vendor not found." }, { status: 404 })
    }
    console.error("Error deleting inventory vendor:", error)
    return NextResponse.json({ message: "Failed to delete vendor." }, { status: 500 })
  }
}
