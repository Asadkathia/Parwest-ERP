import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { isRuntimeMockEnabled } from "@/lib/runtime/mock-mode"
import { forbidden, internalServerError, unauthorized } from "@/lib/api/response"

/**
 * GET /api/users/supervisors
 *
 * Minimal, authenticated-only endpoint that returns supervisors scoped to the
 * caller's region/office. Unlike `/api/users` it does NOT require the
 * `USERS:VIEW` permission, so regional supervisors who need to pick another
 * supervisor (e.g. during guard enrollment) can still load the list.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get("regionId")?.trim() || undefined
    const regionalOfficeId = searchParams.get("regionalOfficeId")?.trim() || undefined
    const managerScope = deriveManagerScope(session)
    if (managerScope && managerScopeDenied(managerScope, { regionId: regionId || null, regionalOfficeId: regionalOfficeId || null })) {
      return forbidden("Forbidden: cannot query supervisors outside your scope.")
    }

    if (isRuntimeMockEnabled()) {
      return NextResponse.json([])
    }

    const where: Prisma.UserWhereInput = {
      status: "ACTIVE",
      role: { name: "Supervisor" },
    }
    if (regionId) where.regionId = regionId
    if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId
    Object.assign(where, buildManagerScopeWhere(managerScope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }))

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        regionId: true,
        regionalOfficeId: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      take: 300,
    })

    // Flatten role.name to top-level `role` for callers expecting `{ id, name, email, role }`.
    const rows = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role?.name ?? null,
      regionId: u.regionId,
      regionalOfficeId: u.regionalOfficeId,
    }))

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching supervisors:", error)
    return internalServerError("Failed to fetch supervisors")
  }
}
