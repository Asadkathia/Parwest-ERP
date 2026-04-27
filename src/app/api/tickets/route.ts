import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { isSuperAdmin } from "@/lib/payroll/state-permissions"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

const MOCK_TICKETS = [
  {
    id: "mock-ticket-1",
    subject: "Attendance sync issue",
    description: "Attendance rows are delayed for one branch.",
    sender: { id: "mock-user-1", name: "Admin User" },
    assignedTo: { id: "mock-user-2", name: "Muhammad Nazir" },
    category: { id: "mock-cat-1", name: "General" },
    priority: { id: "mock-priority-2", name: "High" },
    status: { id: "mock-status-1", name: "New" },
    createdAt: "2026-02-24T10:00:00.000Z",
  },
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }
    if (!hasAction(session, "TICKETING", "VIEW")) return forbidden("Access denied.")

    const managerScope = deriveManagerScope(session)
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim()
    const statusId = searchParams.get("statusId") || undefined
    const priorityId = searchParams.get("priorityId") || undefined
    const categoryId = searchParams.get("categoryId") || undefined
    const regionId = searchParams.get("regionId")
    const regionalOfficeId = searchParams.get("regionalOfficeId")

    if (managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
      return forbidden("Forbidden: requested scope is outside your assigned region.")
    }

    if (isRuntimeMockEnabled()) {
      const rows = MOCK_TICKETS.filter((ticket) => {
        if (statusId && ticket.status.id !== statusId) return false
        if (priorityId && ticket.priority.id !== priorityId) return false
        if (categoryId && ticket.category.id !== categoryId) return false
        if (search) {
          const hay = `${ticket.subject} ${ticket.description || ""}`.toLowerCase()
          if (!hay.includes(search.toLowerCase())) return false
        }
        return true
      })
      return NextResponse.json(rows)
    }

    const where: Prisma.TicketWhereInput = {}
    if (statusId) where.statusId = statusId
    if (priorityId) where.priorityId = priorityId
    if (categoryId) where.categoryId = categoryId

    // Tickets have no direct region; scope through the sender (User) relation.
    const senderScope = buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" })
    const senderFilter = {
      ...(regionId ? { regionId } : {}),
      ...(regionalOfficeId ? { regionalOfficeId } : {}),
      ...senderScope,
    }
    if (Object.keys(senderFilter).length > 0) {
      where.sender = { is: senderFilter }
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (!isSuperAdmin(session)) {
      const userId = session.user?.id
      if (!userId) return unauthorized()
      const visibilityOr: Prisma.TicketWhereInput[] = [
        { senderId: userId },
        { assignedToId: userId },
      ]
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: visibilityOr }]
        delete where.OR
      } else {
        where.OR = visibilityOr
      }
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        priority: { select: { id: true, name: true } },
        status: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error("Error fetching tickets:", error)
    return internalServerError("Failed to fetch tickets")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return unauthorized()
    }
    if (!hasAction(session, "TICKETING", "CREATE")) return forbidden("Access denied.")

    const body = await request.json()
    const subject = String(body?.subject || "").trim()
    const description = body?.description ? String(body.description) : null
    const categoryId = String(body?.categoryId || "").trim()
    const priorityId = String(body?.priorityId || "").trim()
    const statusId = String(body?.statusId || "").trim()
    const assignedToId = body?.assignedToId ? String(body.assignedToId) : null

    if (!subject || !categoryId || !priorityId || !statusId) {
      return badRequest("subject, categoryId, priorityId, and statusId are required.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-ticket-${Date.now()}`,
          subject,
          description,
          sender: { id: session.user.id, name: session.user.name || "Current User" },
          assignedTo: assignedToId ? { id: assignedToId, name: "Assigned User" } : null,
          category: { id: categoryId, name: "Category" },
          priority: { id: priorityId, name: "Priority" },
          status: { id: statusId, name: "Status" },
          createdAt: new Date().toISOString(),
        },
        { status: 201 }
      )
    }

    const created = await prisma.ticket.create({
      data: {
        subject,
        description,
        senderId: session.user.id,
        assignedToId,
        categoryId,
        priorityId,
        statusId,
      },
      include: {
        sender: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        priority: { select: { id: true, name: true } },
        status: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2003") {
      return badRequest("Invalid category, priority, status, or assignee.")
    }
    console.error("Error creating ticket:", error)
    return internalServerError("Failed to create ticket")
  }
}
