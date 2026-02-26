import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

const MOCK_ROWS = [
  { id: "mock-cat-1", name: "General", description: "General requests", color: "#3B82F6" },
  { id: "mock-cat-2", name: "Server", description: "Server issues", color: "#EF4444" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    if (isMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.ticketCategory.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching ticket categories:", error)
    return NextResponse.json({ message: "Failed to fetch ticket categories" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null
    const color = body?.color ? String(body.color) : null

    if (!name) return NextResponse.json({ message: "name is required." }, { status: 400 })

    if (isMockEnabled()) {
      return NextResponse.json({ id: `mock-cat-${Date.now()}`, name, description, color }, { status: 201 })
    }

    const created = await prisma.ticketCategory.create({
      data: { name, description, color },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Category already exists." }, { status: 409 })
    }
    console.error("Error creating ticket category:", error)
    return NextResponse.json({ message: "Failed to create ticket category" }, { status: 500 })
  }
}
