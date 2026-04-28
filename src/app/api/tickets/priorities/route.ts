import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { badRequest, conflict, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const MOCK_ROWS = [
  // eslint-disable-next-line no-restricted-syntax -- mock DB seed data, persisted color value not UI styling
  { id: "mock-priority-1", name: "Low", color: "#10B981" },
  // eslint-disable-next-line no-restricted-syntax -- mock DB seed data, persisted color value not UI styling
  { id: "mock-priority-2", name: "High", color: "#EF4444" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "TICKETING", "VIEW")) return forbidden("Access denied.")
    if (isRuntimeMockEnabled()) return NextResponse.json(MOCK_ROWS)
    const rows = await prisma.ticketPriority.findMany({ orderBy: { name: "asc" } })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching ticket priorities:", error)
    return internalServerError("Failed to fetch ticket priorities")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "TICKETING", "CREATE")) return forbidden("Access denied.")
    const body = await request.json()
    const name = String(body?.name || "").trim()
    const color = body?.color ? String(body.color) : null
    if (!name) return badRequest("name is required.")
    if (isRuntimeMockEnabled()) return NextResponse.json({ id: `mock-priority-${Date.now()}`, name, color }, { status: 201 })
    const created = await prisma.ticketPriority.create({ data: { name, color } })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2002") return conflict("Priority already exists.")
    console.error("Error creating ticket priority:", error)
    return internalServerError("Failed to create ticket priority")
  }
}
