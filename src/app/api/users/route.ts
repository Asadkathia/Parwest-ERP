import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { getPrismaCode } from "@/lib/prisma-errors"
import { badRequest, conflict, forbidden, internalServerError, unauthorized } from "@/lib/api/response"

const MOCK_USERS = [
  {
    id: "mock-user-1",
    name: "Admin User",
    email: "admin@parwestgroup.com",
    status: "ACTIVE",
    role: { id: "mock-role-admin", name: "Admin" },
    region: { id: "mock-region-punjab", name: "Punjab" },
    regionalOffice: { id: "mock-office-lhr", name: "head office lahore" },
    createdAt: "2026-01-11T00:00:00.000Z",
  },
  {
    id: "mock-user-2",
    name: "Muhammad Nazir",
    email: "nazir@parwestgroup.com",
    status: "ACTIVE",
    role: { id: "mock-role-manager", name: "Manager" },
    region: { id: "mock-region-punjab", name: "Punjab" },
    regionalOffice: { id: "mock-office-lhr", name: "head office lahore" },
    createdAt: "2026-01-14T00:00:00.000Z",
  },
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim()
    const regionId = searchParams.get("regionId")?.trim() || undefined
    const status = searchParams.get("status")?.trim() || undefined
    const roleId = searchParams.get("roleId")?.trim() || undefined
    const regionalOfficeId = searchParams.get("regionalOfficeId")?.trim() || undefined
    const managerScope = deriveManagerScope(session)
    if (managerScope && managerScopeDenied(managerScope, { regionId: regionId || null, regionalOfficeId: regionalOfficeId || null })) {
      return forbidden("Forbidden: cannot query users outside your scope.")
    }

    if (isRuntimeMockEnabled()) {
      const rows = MOCK_USERS.filter((user) => {
        if (status && user.status !== status) return false
        if (roleId && user.role.id !== roleId) return false
        if (regionalOfficeId && user.regionalOffice.id !== regionalOfficeId) return false
        if (search) {
          const hay = `${user.name} ${user.email} ${user.role.name}`.toLowerCase()
          if (!hay.includes(search.toLowerCase())) return false
        }
        return true
      })
      return NextResponse.json(rows)
    }

    const where: Prisma.UserWhereInput = {}
    if (regionId) where.regionId = regionId
    if (status) where.status = status
    if (roleId) where.roleId = roleId
    if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
    Object.assign(where, buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }))
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        regionalOffice: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return internalServerError("Failed to fetch users")
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
    const email = String(body?.email || "").trim().toLowerCase()
    const password = String(body?.password || "")
    const roleId = String(body?.roleId || "").trim()
    const status = String(body?.status || "ACTIVE")
    const contactNumber = body?.contactNumber ? String(body.contactNumber) : null
    const regionId = body?.regionId ? String(body.regionId) : null
    const regionalOfficeId = body?.regionalOfficeId ? String(body.regionalOfficeId) : null
    const managerScope = deriveManagerScope(session)
    if (managerScope && managerScopeDenied(managerScope, { regionId, regionalOfficeId })) {
      return forbidden("Forbidden: cannot create user outside your scope.")
    }

    if (!name || !email || !password || !roleId) {
      return badRequest("name, email, password, and roleId are required.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json(
        {
          id: `mock-user-${Date.now()}`,
          name,
          email,
          status,
          contactNumber,
          role: { id: roleId, name: "Role" },
          region: regionId ? { id: regionId, name: "Region" } : null,
          regionalOffice: regionalOfficeId ? { id: regionalOfficeId, name: "Office" } : null,
          createdAt: new Date().toISOString(),
        },
        { status: 201 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const actorId = session.user?.id || null
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          roleId,
          status,
          contactNumber,
          regionId,
          regionalOfficeId,
        },
        include: {
          role: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          regionalOffice: { select: { id: true, name: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          userId: actorId,
          event: "USER_CREATED",
          module: "USERS",
          description: `Created user ${user.id} (${user.email})`,
        },
      })

      return user
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (getPrismaCode(error) === "P2002") {
      return conflict("Email already exists.")
    }
    if (getPrismaCode(error) === "P2003") {
      return badRequest("Invalid role, region, or office.")
    }
    console.error("Error creating user:", error)
    return internalServerError("Failed to create user")
  }
}
