import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

const MOCK_ROWS = [
  { id: "mock-priority-1", name: "Low", color: "#10B981" },
  { id: "mock-priority-2", name: "High", color: "#EF4444" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (isMockEnabled()) return NextResponse.json(MOCK_ROWS)
    const rows = await prisma.ticketPriority.findMany({ orderBy: { name: "asc" } })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching ticket priorities:", error)
    return NextResponse.json({ message: "Failed to fetch ticket priorities" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const name = String(body?.name || "").trim()
    const color = body?.color ? String(body.color) : null
    if (!name) return NextResponse.json({ message: "name is required." }, { status: 400 })
    if (isMockEnabled()) return NextResponse.json({ id: `mock-priority-${Date.now()}`, name, color }, { status: 201 })
    const created = await prisma.ticketPriority.create({ data: { name, color } })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (String(error?.code) === "P2002") return NextResponse.json({ message: "Priority already exists." }, { status: 409 })
    console.error("Error creating ticket priority:", error)
    return NextResponse.json({ message: "Failed to create ticket priority" }, { status: 500 })
  }
}
