import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { isSuperAdmin } from "@/lib/payroll/state-permissions"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "TICKETING", "VIEW")) return forbidden("Access denied.")
    const { id } = await context.params

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        priority: { select: { id: true, name: true } },
        status: { select: { id: true, name: true } },
      },
    })
    if (!ticket) return notFound("Ticket not found.")
    if (!isSuperAdmin(session)) {
      const userId = session.user?.id
      if (!userId || (ticket.senderId !== userId && ticket.assignedToId !== userId)) {
        return forbidden("You do not have access to this ticket.")
      }
    }
    return NextResponse.json(ticket)
  } catch (error: unknown) {
    console.error("Error fetching ticket:", error)
    return internalServerError("Failed to fetch ticket")
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "TICKETING", "UPDATE")) return forbidden("Access denied.")

    const { id } = await context.params
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.subject != null) data.subject = String(body.subject)
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null
    if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId ? String(body.assignedToId) : null
    if (body.categoryId != null) data.categoryId = String(body.categoryId)
    if (body.priorityId != null) data.priorityId = String(body.priorityId)
    if (body.statusId != null) data.statusId = String(body.statusId)

    if (Object.keys(data).length === 0) {
      return badRequest("No valid fields provided.")
    }

    if (!isSuperAdmin(session)) {
      const userId = session.user?.id
      if (!userId) return unauthorized()
      const existing = await prisma.ticket.findUnique({
        where: { id },
        select: { senderId: true, assignedToId: true },
      })
      if (!existing) return notFound("Ticket not found.")
      if (existing.senderId !== userId && existing.assignedToId !== userId) {
        return forbidden("You do not have access to this ticket.")
      }
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data,
      include: {
        sender: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        priority: { select: { id: true, name: true } },
        status: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2025") {
      return notFound("Ticket not found.")
    }
    if (String((error as { code?: string }).code) === "P2003") {
      return badRequest("Invalid relation reference.")
    }
    console.error("Error updating ticket:", error)
    return internalServerError("Failed to update ticket")
  }
}
