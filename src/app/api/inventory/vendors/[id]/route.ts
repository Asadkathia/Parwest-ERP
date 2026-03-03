import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await params
    const body = await request.json()
    const name = String(body.name || "").trim()
    const contact = body.contact ? String(body.contact).trim() : null
    if (!name) return badRequest("Name is required.")

    const updated = await prisma.inventoryVendor.update({
      where: { id },
      data: { name, contact },
    })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2025") {
      return notFound("Vendor not found.")
    }
    if (getPrismaCode(error) === "P2002") {
      return conflict("Vendor already exists.")
    }
    console.error("Error updating inventory vendor:", error)
    return internalServerError("Failed to update vendor.")
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await params

    await prisma.inventoryVendor.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2025") {
      return notFound("Vendor not found.")
    }
    console.error("Error deleting inventory vendor:", error)
    return internalServerError("Failed to delete vendor.")
  }
}
