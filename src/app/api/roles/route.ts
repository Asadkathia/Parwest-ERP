import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { badRequest, conflict, internalServerError, unauthorized } from "@/lib/api/response"

const MOCK_ROLES = [
  { id: "mock-role-admin", name: "Admin", description: "System administrator", scopeType: "REGIONAL" },
  { id: "mock-role-manager", name: "Manager", description: "Regional manager", scopeType: "REGIONAL" },
  { id: "mock-role-supervisor", name: "Supervisor", description: "Field supervisor", scopeType: "REGIONAL" },
  { id: "mock-role-accountant", name: "Accountant", description: "Payroll and billing", scopeType: "REGIONAL" },
]

function parseScopeType(value: unknown): "GLOBAL" | "REGIONAL" | null {
  if (value === "GLOBAL" || value === "REGIONAL") return value
  return null
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(MOCK_ROLES)
    }

    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
    })

    return NextResponse.json(roles)
  } catch (error) {
    console.error("Error fetching roles:", error)
    return internalServerError("Failed to fetch roles")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null
    const scopeType = parseScopeType(body?.scopeType) ?? "REGIONAL"

    if (!name) {
      return badRequest("Role name is required.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        { id: `mock-role-${Date.now()}`, name, description, scopeType, createdAt: new Date().toISOString() },
        { status: 201 }
      )
    }

    const role = await prisma.role.create({
      data: { name, description, scopeType },
    })

    return NextResponse.json(role, { status: 201 })
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2002") {
      return conflict("Role name already exists.")
    }
    console.error("Error creating role:", error)
    return internalServerError("Failed to create role")
  }
}
