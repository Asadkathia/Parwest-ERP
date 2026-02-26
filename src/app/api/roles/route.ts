import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

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
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
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
    return NextResponse.json({ message: "Failed to fetch roles" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null

    if (!name) {
      return NextResponse.json({ message: "Role name is required." }, { status: 400 })
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
  } catch (error: any) {
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ message: "Role name already exists." }, { status: 409 })
    }
    console.error("Error creating role:", error)
    return NextResponse.json({ message: "Failed to create role" }, { status: 500 })
  }
}
