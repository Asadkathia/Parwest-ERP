import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculatePayrollNetSalary } from "@/lib/payroll/netSalary"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"

function parseMonth(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
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

    const existing = await prisma.payroll.findFirst({
      where: { guardId, month, year },
      select: {
        id: true,
        baseSalary: true,
        extraHoursAmount: true,
        specialDutyAmount: true,
        loans: true,
        otherDeductions: true,
        trainingSchoolFees: true,
        cwf: true,
        eobi: true,
        essi: true,
      },
    })

    const netSalary = calculatePayrollNetSalary({
      baseSalary: existing?.baseSalary ?? 0,
      extraHoursAmount: existing?.extraHoursAmount ?? 0,
      specialDutyAmount: amount,
      loans: existing?.loans ?? 0,
      otherDeductions: existing?.otherDeductions ?? 0,
      trainingSchoolFees: existing?.trainingSchoolFees ?? 0,
      cwf: existing?.cwf ?? 0,
      eobi: existing?.eobi ?? 0,
      essi: existing?.essi ?? 0,
    })

    const saved = existing
      ? await prisma.payroll.update({
          where: { id: existing.id },
          data: {
            specialDutyHours: hours,
            specialDutyAmount: amount,
            netSalary,
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
            netSalary,
          },
          include: { guard: { select: { id: true, name: true, parwestId: true } } },
        })

    return NextResponse.json(saved, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error("Error saving special duty:", error)
    return internalServerError("Failed to save special duty.")
  }
}
