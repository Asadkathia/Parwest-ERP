import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { getPrismaCode, isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

const MOCK_ROWS = [
  { id: "mock-cond-1", name: "New", description: "Brand new condition", createdAt: "2026-02-24T00:00:00.000Z" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (isMockEnabled()) return NextResponse.json(MOCK_ROWS)

    const rows = await prisma.inventoryCondition.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for inventory conditions yet.")
    console.error("Error fetching inventory conditions:", error)
    return internalServerError("Failed to fetch conditions.")
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

    if (isMockEnabled()) return NextResponse.json({ id: `mock-cond-${Date.now()}`, name, description, createdAt: new Date().toISOString() }, { status: 201 })

    const created = await prisma.inventoryCondition.create({
      data: { name, description },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated for inventory conditions yet.")
    if (getPrismaCode(error) === "P2002") return conflict("Condition already exists.")
    console.error("Error creating inventory condition:", error)
    return internalServerError("Failed to create condition.")
  }
}
