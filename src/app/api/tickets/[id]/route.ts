import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const { id } = await context.params

    if (isMockEnabled()) {
      return NextResponse.json({ id, subject: "Mock Ticket", description: "Mock ticket description" })
    }

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
    if (!ticket) return NextResponse.json({ message: "Ticket not found." }, { status: 404 })
    return NextResponse.json(ticket)
  } catch (error: any) {
    console.error("Error fetching ticket:", error)
    return NextResponse.json({ message: "Failed to fetch ticket" }, { status: 500 })
  }
}

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
    const data: any = {}

    if (body.subject != null) data.subject = String(body.subject)
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null
    if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId ? String(body.assignedToId) : null
    if (body.categoryId != null) data.categoryId = String(body.categoryId)
    if (body.priorityId != null) data.priorityId = String(body.priorityId)
    if (body.statusId != null) data.statusId = String(body.statusId)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "No valid fields provided." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json({ id, ...data })
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
  } catch (error: any) {
    if (String(error?.code) === "P2025") {
      return NextResponse.json({ message: "Ticket not found." }, { status: 404 })
    }
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid relation reference." }, { status: 400 })
    }
    console.error("Error updating ticket:", error)
    return NextResponse.json({ message: "Failed to update ticket" }, { status: 500 })
  }
}
