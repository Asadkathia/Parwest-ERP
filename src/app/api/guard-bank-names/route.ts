import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

const MOCK_ROWS = [
  { id: "mock-bank-1", name: "HBL", createdAt: "2026-02-24T00:00:00.000Z" },
  { id: "mock-bank-2", name: "Meezan Bank", createdAt: "2026-02-24T00:00:00.000Z" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (isRuntimeMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.guardBankName.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard bank names yet.")
    console.error("Error fetching guard bank names:", error)
    return internalServerError("Failed to fetch bank names.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const body = await request.json()
    const name = String(body?.name || "").trim()
    if (!name) return badRequest("Name is required.")

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        { id: `mock-bank-${Date.now()}`, name, createdAt: new Date().toISOString() },
        { status: 201 }
      )
    }

    const created = await prisma.guardBankName.create({
      data: { name },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for guard bank names yet.")
    if (String((error as { code?: string }).code) === "P2002") return conflict("Bank name already exists.")
    console.error("Error creating guard bank name:", error)
    return internalServerError("Failed to create bank name.")
  }
}
