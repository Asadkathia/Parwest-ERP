import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { buildManagerScopeWhere, deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { GLOBAL_REGION_VALUE } from "@/components/access/region-sentinels"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "AUDIT", "VIEW")) return forbidden("Access denied.")

    const { searchParams } = new URL(request.url)
    const moduleFilter = searchParams.get("module")?.trim()
    const eventFilter = searchParams.get("event")?.trim()
    const userId = searchParams.get("userId")?.trim()
    const search = searchParams.get("search")?.trim()
    const dateFromRaw = searchParams.get("dateFrom")
    const dateToRaw = searchParams.get("dateTo")
    const regionIdParamRaw = searchParams.get("regionId")?.trim() || null
    const regionalOfficeIdParam = searchParams.get("regionalOfficeId")?.trim() || null

    // "__GLOBAL__" sentinel means "only un-regioned records" — keep it separate
    // from the scope-denied check (a regional user can never pick Global via the
    // picker because we don't show the option to them).
    const regionIdIsGlobal = regionIdParamRaw === GLOBAL_REGION_VALUE
    const regionIdParam = regionIdIsGlobal ? null : regionIdParamRaw

    // Reject cross-scope requests early so a regional user can't request
    // another region's audit logs even with a crafted URL.
    const managerScope = deriveManagerScope(session)
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: regionIdParam,
        regionalOfficeId: regionalOfficeIdParam,
      })
    ) {
      return forbidden("Forbidden: cannot query audit logs outside your scope.")
    }

    const where: Prisma.AuditLogWhereInput = {
      ...buildManagerScopeWhere(managerScope, {
        regionId: "targetRegionId",
        regionalOfficeId: "targetRegionalOfficeId",
      }),
    }
    if (moduleFilter) where.module = moduleFilter
    if (eventFilter) where.event = eventFilter
    if (userId) where.userId = userId
    // Super User filter-picker path — regional users already have the scope
    // clause above and are rejected earlier if the params disagree.
    if (regionIdIsGlobal) {
      where.targetRegionId = null
    } else if (regionIdParam) {
      where.targetRegionId = regionIdParam
    }
    if (regionalOfficeIdParam) where.targetRegionalOfficeId = regionalOfficeIdParam
    if (search) {
      where.OR = [
        { module: { contains: search, mode: "insensitive" } },
        { event: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ]
    }

    if (dateFromRaw || dateToRaw) {
      const createdAt: Prisma.DateTimeFilter = {}
      if (dateFromRaw) {
        const dateFrom = new Date(dateFromRaw)
        if (!Number.isNaN(dateFrom.getTime())) createdAt.gte = dateFrom
      }
      if (dateToRaw) {
        const dateTo = new Date(dateToRaw)
        if (!Number.isNaN(dateTo.getTime())) createdAt.lte = dateTo
      }
      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return internalServerError("Failed to fetch audit logs")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "AUDIT", "CREATE")) return forbidden("Access denied.")
    // Creating audit entries is admin-only
    const role = (session.user as { role?: string })?.role ?? ""
    if (role.toLowerCase() !== "admin") return forbidden("Only admins can create audit entries.")

    const body = await request.json()
    const event = String(body?.event || "").trim()
    const moduleName = String(body?.module || "").trim()
    const description = body?.description ? String(body.description) : null
    const ipAddress = body?.ipAddress ? String(body.ipAddress) : null

    if (!event || !moduleName) {
      return badRequest("event and module are required.")
    }

    const created = await prisma.auditLog.create({
      data: {
        userId: session.user?.id || null,
        event,
        module: moduleName,
        description,
        ipAddress,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Error creating audit log:", error)
    return internalServerError("Failed to create audit log")
  }
}
