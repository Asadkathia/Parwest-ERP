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
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()
    const data: any = {}
    if (body.name != null) data.name = String(body.name)
    if (body.color !== undefined) data.color = body.color ? String(body.color) : null
    if (isMockEnabled()) return NextResponse.json({ id, ...data })
    const updated = await prisma.ticketPriority.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Priority not found." }, { status: 404 })
    console.error("Error updating ticket priority:", error)
    return NextResponse.json({ message: "Failed to update ticket priority" }, { status: 500 })
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
    await prisma.ticketPriority.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (String(error?.code) === "P2025") return NextResponse.json({ message: "Priority not found." }, { status: 404 })
    if (String(error?.code) === "P2003") return NextResponse.json({ message: "Priority is in use by tickets." }, { status: 409 })
    console.error("Error deleting ticket priority:", error)
    return NextResponse.json({ message: "Failed to delete ticket priority" }, { status: 500 })
  }
}
