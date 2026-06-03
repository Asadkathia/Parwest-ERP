import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { conflict, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "TICKETING", "UPDATE")) return forbidden("Access denied.")
    const { id } = await context.params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.name != null) data.name = String(body.name)
    if (body.color !== undefined) data.color = body.color ? String(body.color) : null
    const updated = await prisma.ticketPriority.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Priority not found.")
    console.error("Error updating ticket priority:", error)
    return internalServerError("Failed to update ticket priority")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "TICKETING", "DELETE")) return forbidden("Access denied.")
    const { id } = await context.params
    await prisma.ticketPriority.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Priority not found.")
    if (String((error as { code?: string }).code) === "P2003") return conflict("Priority is in use by tickets.")
    console.error("Error deleting ticket priority:", error)
    return internalServerError("Failed to delete ticket priority")
  }
}
