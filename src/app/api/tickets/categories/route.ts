import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { badRequest, conflict, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

const MOCK_ROWS = [
  { id: "mock-cat-1", name: "General", description: "General requests", color: "#3B82F6" },
  { id: "mock-cat-2", name: "Server", description: "Server issues", color: "#EF4444" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "TICKETING", "VIEW")) return forbidden("Access denied.")

    if (isRuntimeMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.ticketCategory.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching ticket categories:", error)
    return internalServerError("Failed to fetch ticket categories")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "TICKETING", "CREATE")) return forbidden("Access denied.")

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null
    const color = body?.color ? String(body.color) : null

    if (!name) return badRequest("name is required.")

    if (isRuntimeMockEnabled()) {
      return NextResponse.json({ id: `mock-cat-${Date.now()}`, name, description, color }, { status: 201 })
    }

    const created = await prisma.ticketCategory.create({
      data: { name, description, color },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2002") {
      return conflict("Category already exists.")
    }
    console.error("Error creating ticket category:", error)
    return internalServerError("Failed to create ticket category")
  }
}
