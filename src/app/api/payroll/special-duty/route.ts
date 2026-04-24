/**
 * @deprecated Use /api/payroll/special-duty-records instead. This endpoint is
 * retained for the legacy UI only. It writes Payroll.specialDutyAmount/Hours
 * directly and triggers a canonical payroll recalc. New code should create
 * PayrollSpecialDuty records via /api/payroll/special-duty-records.
 */

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { recalcAffectedMonths } from "@/lib/payroll/special-duty-recalc"

import { parseMonthStart as parseMonth } from "@/lib/payroll/date-helpers"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const guardId = searchParams.get("guardId") || undefined
    const monthRaw = searchParams.get("month")
    const search = searchParams.get("search") || undefined

    const where: Prisma.PayrollWhereInput = {}
    if (guardId) where.guardId = guardId
    if (monthRaw) {
      const month = parseMonth(monthRaw)
      if (month) where.month = month
    }
    if (search) {
      where.OR = [
        { guard: { name: { contains: search, mode: "insensitive" } } },
        { guard: { parwestId: { contains: search, mode: "insensitive" } } },
      ]
    }
    if (managerScope) {
      const isFilter: Record<string, unknown> = {}
      if (managerScope.regionId) isFilter.regionId = managerScope.regionId
      if (managerScope.regionalOfficeIds.length > 0) {
        isFilter.regionalOfficeId = { in: managerScope.regionalOfficeIds }
      }
      if (Object.keys(isFilter).length > 0) where.guard = { is: isFilter }
    }

    const rows = await prisma.payroll.findMany({
      where,
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
      orderBy: { updatedAt: "desc" },
      take: 300,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching special duty:", error)
    return internalServerError("Failed to fetch special duty records.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const guardId = String(body.guardId || "")
    const monthInput = String(body.month || "")
    const hours = Number(body.hours || 0)
    const rate = Number(body.rate || 0)
    if (!guardId || !monthInput) {
      return badRequest("guardId and month are required.")
    }
    const month = parseMonth(monthInput)
    if (!month) {
      return badRequest("Invalid month value.")
    }
    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return notFound("Guard not found.")
    if (managerScope && managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    const year = month.getUTCFullYear()
    const amount = Number((hours * rate).toFixed(2))

    const existing = await prisma.payroll.findUnique({
      where: { guardId_month_year: { guardId, month, year } },
      select: { id: true },
    })

    const saved = existing
      ? await prisma.payroll.update({
          where: { id: existing.id },
          data: {
            specialDutyHours: hours,
            specialDutyAmount: amount,
          },
          include: { guard: { select: { id: true, name: true, parwestId: true } } },
        })
      : await prisma.payroll.create({
          data: {
            guardId,
            month,
            year,
            specialDutyHours: hours,
            specialDutyAmount: amount,
          },
          include: { guard: { select: { id: true, name: true, parwestId: true } } },
        })

    // Trigger recalc for the affected month. Locked-state surfaces as warning.
    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null
    const warnings = await recalcAffectedMonths(guardId, [month], actorUserId)

    return NextResponse.json(
      warnings.length > 0 ? { ...saved, warnings } : saved,
      { status: existing ? 200 : 201 }
    )
  } catch (error) {
    console.error("Error saving special duty:", error)
    return internalServerError("Failed to save special duty.")
  }
}
