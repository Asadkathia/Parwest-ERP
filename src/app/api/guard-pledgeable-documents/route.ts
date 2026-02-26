import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"

const MOCK_ROWS = [
  {
    id: "mock-doc-1",
    name: "CNIC",
    description: "National ID document",
    createdAt: "2026-02-24T00:00:00.000Z",
  },
  {
    id: "mock-doc-2",
    name: "Matric Certificate",
    description: "Academic certificate",
    createdAt: "2026-02-24T00:00:00.000Z",
  },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (isMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.guardPledgeableDocument.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for guard pledgeable documents yet." }, { status: 503 })
    console.error("Error fetching guard pledgeable documents:", error)
    return NextResponse.json({ message: "Failed to fetch documents." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null
    if (!name) return NextResponse.json({ message: "Name is required." }, { status: 400 })

    if (isMockEnabled()) {
      return NextResponse.json(
        { id: `mock-doc-${Date.now()}`, name, description, createdAt: new Date().toISOString() },
        { status: 201 }
      )
    }

    const created = await prisma.guardPledgeableDocument.create({
      data: { name, description },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (isPrismaMissingSchemaError(error)) return NextResponse.json({ message: "Schema not migrated for guard pledgeable documents yet." }, { status: 503 })
    if (String(error?.code) === "P2002") return NextResponse.json({ message: "Document type already exists." }, { status: 409 })
    console.error("Error creating guard pledgeable document:", error)
    return NextResponse.json({ message: "Failed to create document type." }, { status: 500 })
  }
}
