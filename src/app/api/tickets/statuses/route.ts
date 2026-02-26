import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

const MOCK_ROWS = [
  { id: "mock-status-1", name: "New", color: "#3B82F6" },
  { id: "mock-status-2", name: "In-Progress", color: "#F59E0B" },
  { id: "mock-status-3", name: "Closed", color: "#10B981" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (isMockEnabled()) return NextResponse.json(MOCK_ROWS)
    const rows = await prisma.ticketStatus.findMany({ orderBy: { name: "asc" } })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching ticket statuses:", error)
    return NextResponse.json({ message: "Failed to fetch ticket statuses" }, { status: 500 })
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
    if (isMockEnabled()) return NextResponse.json({ id: `mock-status-${Date.now()}`, name, color }, { status: 201 })
    const created = await prisma.ticketStatus.create({ data: { name, color } })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (String(error?.code) === "P2002") return NextResponse.json({ message: "Status already exists." }, { status: 409 })
    console.error("Error creating ticket status:", error)
    return NextResponse.json({ message: "Failed to create ticket status" }, { status: 500 })
  }
}
