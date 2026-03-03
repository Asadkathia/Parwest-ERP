import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

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
    if (!session) return unauthorized()
    if (isRuntimeMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.guardPledgeableDocument.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard pledgeable documents yet.")
    console.error("Error fetching guard pledgeable documents:", error)
    return internalServerError("Failed to fetch documents.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null
    if (!name) return badRequest("Name is required.")

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        { id: `mock-doc-${Date.now()}`, name, description, createdAt: new Date().toISOString() },
        { status: 201 }
      )
    }

    const created = await prisma.guardPledgeableDocument.create({
      data: { name, description },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard pledgeable documents yet.")
    if (String((error as { code?: string }).code) === "P2002") return conflict("Document type already exists.")
    console.error("Error creating guard pledgeable document:", error)
    return internalServerError("Failed to create document type.")
  }
}
