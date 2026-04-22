import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const scope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const guardId = searchParams.get("guardId") || undefined
    const search = searchParams.get("search") || undefined

    const where: Prisma.PayrollSpecialDutyWhereInput = { status: "ACTIVE" }
    if (guardId) where.guardId = guardId

    const guardFilter: Record<string, unknown> = {}
    if (search) {
      guardFilter.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { parwestId: { contains: search, mode: "insensitive" } },
      ]
    }
    if (scope?.regionId) guardFilter.regionId = scope.regionId
    if (scope && scope.regionalOfficeIds.length > 0) {
      guardFilter.regionalOfficeId = { in: scope.regionalOfficeIds }
    }
    if (Object.keys(guardFilter).length > 0) where.guard = { is: guardFilter }

    const rows = await prisma.payrollSpecialDuty.findMany({
      where,
      include: { guard: { select: { id: true, parwestId: true, name: true } } },
      orderBy: { dateFrom: "desc" },
      take: 300,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching special duty records:", error)
    return internalServerError("Failed to fetch records.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    const scope = deriveManagerScope(session)

    const body = await request.json()
    const guardId = String(body.guardId || "")
    const dateFrom = body.dateFrom ? new Date(String(body.dateFrom)) : null
    const dateTo = body.dateTo ? new Date(String(body.dateTo)) : null
    const hours = Number(body.hours)
    const hourRate = Number(body.hourRate)

    if (!guardId || !dateFrom || !dateTo || !Number.isFinite(hours) || !Number.isFinite(hourRate)) {
      return badRequest("guardId, dateFrom, dateTo, hours, hourRate are required.")
    }
    if (dateTo < dateFrom) return badRequest("dateTo must be >= dateFrom.")

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return notFound("Guard not found.")
    if (scope && managerScopeDenied(scope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    const amount = Number((hours * hourRate).toFixed(2))
    const created = await prisma.payrollSpecialDuty.create({
      data: {
        guardId,
        dateFrom,
        dateTo,
        hours,
        hourRate,
        amount,
        comments: body.comments ? String(body.comments) : null,
        attachmentBase64: body.attachmentBase64 ? String(body.attachmentBase64) : null,
      },
      include: { guard: { select: { id: true, parwestId: true, name: true } } },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error("Error creating special duty record:", error)
    return internalServerError("Failed to create record.")
  }
}
