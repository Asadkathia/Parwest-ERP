import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, internalServerError, notFound, unauthorized } from "@/lib/api/response"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const { id: ticketId } = await params

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } })
    if (!ticket) return notFound("Ticket not found.")

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
    const { id: ticketId } = await params

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } })
    if (!ticket) return notFound("Ticket not found.")

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