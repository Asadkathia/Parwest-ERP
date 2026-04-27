import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

import { parseMonthRange as parseMonth } from "@/lib/payroll/date-helpers"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied.")
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const monthRaw = searchParams.get("month")
    const search = searchParams.get("search") || undefined
    const regionIdParam = searchParams.get("regionId")?.trim() || null
    const regionalOfficeIdParam = searchParams.get("regionalOfficeId")?.trim() || null

    if (managerScope && managerScopeDenied(managerScope, {
      regionId: regionIdParam,
      regionalOfficeId: regionalOfficeIdParam,
    })) {
      return forbidden("Forbidden: cannot query salary slips outside your scope.")
    }

    const where: Prisma.PayrollSalarySlipWhereInput = {}
    if (monthRaw) {
      const month = parseMonth(monthRaw)
      if (!month) return badRequest("Invalid month value.")
      where.month = { gte: month.start, lt: month.end }
    }

    // Build the guard-scope filter (merged with search when present).
    const guardFilter: Record<string, unknown> = {}
    if (managerScope?.regionId) guardFilter.regionId = managerScope.regionId
    if (managerScope && managerScope.regionalOfficeIds.length > 0) {
      guardFilter.regionalOfficeId = { in: managerScope.regionalOfficeIds }
    }
    if (regionIdParam) guardFilter.regionId = regionIdParam
    if (regionalOfficeIdParam) guardFilter.regionalOfficeId = regionalOfficeIdParam

    if (search) {
      guardFilter.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { parwestId: { contains: search, mode: "insensitive" } },
      ]
    }
    if (Object.keys(guardFilter).length > 0) {
      where.guard = { is: guardFilter }
    }

    const rows = await prisma.payrollSalarySlip.findMany({
      where,
      include: { guard: { select: { id: true, parwestId: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        month: r.month.toISOString().slice(0, 7),
        year: r.year,
        grossPay: r.grossPay,
        netPayable: r.netPayable,
        createdAt: r.createdAt.toISOString(),
        guard: r.guard,
        earningsJson: r.earningsJson,
        deductionsJson: r.deductionsJson,
      }))
    )
  } catch (error) {
    console.error("Error fetching salary slips:", error)
    return internalServerError("Failed to fetch slips.")
  }
}
