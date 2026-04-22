import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { badRequest, conflict, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

const MOCK_ROWS = [
  { id: "mock-status-1", name: "New", color: "#3B82F6" },
  { id: "mock-status-2", name: "In-Progress", color: "#F59E0B" },
  { id: "mock-status-3", name: "Closed", color: "#10B981" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "TICKETING")) return forbidden("Access denied.")
    if (isRuntimeMockEnabled()) return NextResponse.json(MOCK_ROWS)
    const rows = await prisma.ticketStatus.findMany({ orderBy: { name: "asc" } })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching ticket statuses:", error)
    return internalServerError("Failed to fetch ticket statuses")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "TICKETING")) return forbidden("Access denied.")
    const body = await request.json()
    const name = String(body?.name || "").trim()
    const color = body?.color ? String(body.color) : null
    if (!name) return badRequest("name is required.")
    if (isRuntimeMockEnabled()) return NextResponse.json({ id: `mock-status-${Date.now()}`, name, color }, { status: 201 })
    const created = await prisma.ticketStatus.create({ data: { name, color } })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2002") return conflict("Status already exists.")
    console.error("Error creating ticket status:", error)
    return internalServerError("Failed to create ticket status")
  }
}
