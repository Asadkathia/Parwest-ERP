import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { isSuperAdmin } from "@/lib/payroll/state-permissions"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "TICKETING", "VIEW")) return forbidden("Access denied.")
    const { id: ticketId } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, senderId: true, assignedToId: true },
    })
    if (!ticket) return notFound("Ticket not found.")
    if (!isSuperAdmin(session)) {
      const userId = session.user?.id
      if (!userId || (ticket.senderId !== userId && ticket.assignedToId !== userId)) {
        return forbidden("You do not have access to this ticket.")
      }
    }

    const comments = await prisma.ticketComment.findMany({
      where: { ticketId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(comments)
  } catch (error) {
    console.error("Error fetching ticket comments:", error)
    return internalServerError("Failed to fetch comments")
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id) return unauthorized()
    if (!hasAction(session, "TICKETING", "CREATE")) return forbidden("Access denied.")
    const { id: ticketId } = await params

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, senderId: true, assignedToId: true },
    })
    if (!ticket) return notFound("Ticket not found.")
    if (!isSuperAdmin(session)) {
      const userId = session.user?.id
      if (!userId || (ticket.senderId !== userId && ticket.assignedToId !== userId)) {
        return forbidden("You do not have access to this ticket.")
      }
    }

    const body = await request.json()
    const message = String(body?.message || "").trim()
    if (!message) return badRequest("message is required.")

    const isInternal = body?.isInternal === true

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        userId: session.user.id,
        message,
        isInternal,
      },
      include: { user: { select: { id: true, name: true } } },
    })
    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error("Error creating ticket comment:", error)
    return internalServerError("Failed to create comment")
  }
}