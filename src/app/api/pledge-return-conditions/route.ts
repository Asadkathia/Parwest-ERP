import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isPrismaMissingSchemaError } from "@/lib/prisma-errors"
import { badRequest, conflict, internalServerError, serviceUnavailable, unauthorized } from "@/lib/api/response"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const rows = await prisma.pledgeDocReturnCondition.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    return NextResponse.json(rows)
  } catch (error) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated yet.")
    console.error("Error fetching return conditions:", error)
    return internalServerError("Failed to fetch return conditions.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description).trim() : null
    if (!name) return badRequest("Name is required.")

    const created = await prisma.pledgeDocReturnCondition.create({
      data: { name, description },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (isPrismaMissingSchemaError(error)) return serviceUnavailable("Schema not migrated yet.")
    if (String((error as { code?: string }).code) === "P2002") return conflict("Condition name already exists.")
    console.error("Error creating return condition:", error)
    return internalServerError("Failed to create return condition.")
  }
}