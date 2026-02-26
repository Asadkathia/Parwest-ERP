import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"

const MOCK_MODULES = [
  "GUARDS",
  "PAYROLL",
  "INVENTORY",
  "USERS",
  "CLIENTS",
  "TICKETING",
  "SETTINGS",
  "REPORTS",
  "IMPORTS",
  "REQUISITIONS",
  "AUDIT",
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ message: "userId is required." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json(
        MOCK_MODULES.map((module) => ({
          id: `mock-perm-${module.toLowerCase()}`,
          userId,
          module,
          canCreate: module === "GUARDS",
          canView: true,
          canUpdate: module === "GUARDS" || module === "CLIENTS",
          canDelete: false,
          canRequisition: module === "REQUISITIONS",
        }))
      )
    }

    const rows = await prisma.userPermission.findMany({
      where: { userId },
      orderBy: { module: "asc" },
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching user permissions:", error)
    return NextResponse.json({ message: "Failed to fetch user permissions" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const userId = String(body?.userId || "").trim()
    const permissions = Array.isArray(body?.permissions) ? body.permissions : []

    if (!userId) {
      return NextResponse.json({ message: "userId is required." }, { status: 400 })
    }

    if (permissions.length === 0) {
      return NextResponse.json({ message: "permissions array is required." }, { status: 400 })
    }

    if (isMockEnabled()) {
      return NextResponse.json(
        permissions.map((p: any, index: number) => ({
          id: `mock-perm-saved-${index}`,
          userId,
          module: String(p.module),
          canCreate: Boolean(p.canCreate),
          canView: Boolean(p.canView),
          canUpdate: Boolean(p.canUpdate),
          canDelete: Boolean(p.canDelete),
          canRequisition: Boolean(p.canRequisition),
        }))
      )
    }

    const data = permissions.map((p: any) => ({
      userId,
      module: String(p.module),
      canCreate: Boolean(p.canCreate),
      canView: Boolean(p.canView),
      canUpdate: Boolean(p.canUpdate),
      canDelete: Boolean(p.canDelete),
      canRequisition: Boolean(p.canRequisition),
    }))

    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId } }),
      prisma.userPermission.createMany({ data }),
    ])

    const rows = await prisma.userPermission.findMany({
      where: { userId },
      orderBy: { module: "asc" },
    })

    return NextResponse.json(rows)
  } catch (error: any) {
    if (String(error?.code) === "P2003") {
      return NextResponse.json({ message: "Invalid userId." }, { status: 400 })
    }
    console.error("Error saving user permissions:", error)
    return NextResponse.json({ message: "Failed to save user permissions" }, { status: 500 })
  }
}
