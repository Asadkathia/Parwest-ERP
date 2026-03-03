import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { badRequest, conflict, internalServerError, unauthorized } from "@/lib/api/response"

const MOCK_ROLES = [
  { id: "mock-role-admin", name: "Admin", description: "System administrator" },
  { id: "mock-role-manager", name: "Manager", description: "Regional manager" },
  { id: "mock-role-supervisor", name: "Supervisor", description: "Field supervisor" },
  { id: "mock-role-accountant", name: "Accountant", description: "Payroll and billing" },
]

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }

    if (isMockEnabled()) {
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

    if (!name) {
      return badRequest("Role name is required.")
    }

    if (isMockEnabled()) {
      return NextResponse.json(
        { id: `mock-role-${Date.now()}`, name, description, createdAt: new Date().toISOString() },
        { status: 201 }
      )
    }

    const role = await prisma.role.create({
      data: { name, description },
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
