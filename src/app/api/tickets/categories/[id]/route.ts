import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { conflict, internalServerError, notFound, unauthorized } from "@/lib/api/response"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await context.params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.name != null) data.name = String(body.name)
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null
    if (body.color !== undefined) data.color = body.color ? String(body.color) : null

    if (isMockEnabled()) return NextResponse.json({ id, ...data })
    const updated = await prisma.ticketCategory.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Category not found.")
    console.error("Error updating ticket category:", error)
    return internalServerError("Failed to update ticket category")
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id } = await context.params
    if (isMockEnabled()) return NextResponse.json({ success: true })
    await prisma.ticketCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") return notFound("Category not found.")
    if (String((error as { code?: string }).code) === "P2003") return conflict("Category is in use by tickets.")
    console.error("Error deleting ticket category:", error)
    return internalServerError("Failed to delete ticket category")
  }
}
