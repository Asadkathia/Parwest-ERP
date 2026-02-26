import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    const { id } = await context.params
    const body = await request.json()
    const name = String(body?.name || "").trim()

    if (!name) {
      return NextResponse.json({ message: "Region name is required." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json({ id, name, updatedAt: new Date().toISOString() })
    }

    const updated = await prisma.region.update({
      where: { id },
      data: { name },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Region not found." }, { status: 404 })
    }
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Region already exists." }, { status: 409 })
    }
    console.error("Error updating region:", error)
    return NextResponse.json({ message: "Failed to update region" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    const { id } = await context.params

    if (isMockEnabled()) {
      return NextResponse.json({ success: true })
    }

    await prisma.region.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Region not found." }, { status: 404 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Region is in use by offices/users/guards/clients." }, { status: 409 })
    }
    console.error("Error deleting region:", error)
    return NextResponse.json({ message: "Failed to delete region" }, { status: 500 })
  }
}
