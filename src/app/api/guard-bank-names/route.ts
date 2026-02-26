import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

const MOCK_ROWS = [
  { id: "mock-bank-1", name: "HBL", createdAt: "2026-02-24T00:00:00.000Z" },
  { id: "mock-bank-2", name: "Meezan Bank", createdAt: "2026-02-24T00:00:00.000Z" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (isMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.guardBankName.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for guard bank names yet." }, { status: 503 })
    console.error("Error fetching guard bank names:", error)
    return NextResponse.json({ message: "Failed to fetch bank names." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const name = String(body?.name || "").trim()
    if (!name) return NextResponse.json({ message: "Name is required." }, { status: 400 })

    if (isMockEnabled()) {
      return NextResponse.json(
        { id: `mock-bank-${Date.now()}`, name, createdAt: new Date().toISOString() },
        { status: 201 }
      )
    }

    const created = await prisma.guardBankName.create({
      data: { name },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for guard bank names yet." }, { status: 503 })
    if (String(error?.code) === "P2002") return NextResponse.json({ message: "Bank name already exists." }, { status: 409 })
    console.error("Error creating guard bank name:", error)
    return NextResponse.json({ message: "Failed to create bank name." }, { status: 500 })
  }
}
