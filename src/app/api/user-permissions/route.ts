import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isMockEnabled } from "@/lib/mockData"
import { badRequest, internalServerError, unauthorized } from "@/lib/api/response"

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

type PermissionPayload = {
  module?: unknown
  canCreate?: unknown
  canView?: unknown
  canUpdate?: unknown
  canDelete?: unknown
  canRequisition?: unknown
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return badRequest("userId is required.")
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
    return internalServerError("Failed to fetch user permissions")
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }

    const body = await request.json()
    const userId = String(body?.userId || "").trim()
    const permissions = Array.isArray(body?.permissions) ? body.permissions : []

    if (!userId) {
      return badRequest("userId is required.")
    }

    if (permissions.length === 0) {
      return badRequest("permissions array is required.")
    }

    if (isMockEnabled()) {
      const normalized = permissions as PermissionPayload[]
      return NextResponse.json(
        normalized.map((p, index: number) => ({
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

    const normalized = permissions as PermissionPayload[]
    const data = normalized.map((p) => ({
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
  } catch (error: unknown) {
    if (String((error as { code?: string }).code) === "P2003") {
      return badRequest("Invalid userId.")
    }
    console.error("Error saving user permissions:", error)
    return internalServerError("Failed to save user permissions")
  }
}
