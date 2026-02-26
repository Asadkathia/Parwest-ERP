import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculatePayrollNetSalary } from "@/lib/payroll/netSalary"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"

function parseMonth(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const guardId = searchParams.get("guardId") || undefined
    const monthRaw = searchParams.get("month")
    const search = searchParams.get("search") || undefined

    const where: any = {}
    if (guardId) where.guardId = guardId
    if (monthRaw) {
      const month = parseMonth(monthRaw)
      if (month) {
        where.month = month
      }
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
      include: {
        guard: {
          select: { id: true, name: true, parwestId: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching extra hours:", error)
    return NextResponse.json({ message: "Failed to fetch extra hours records." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const guardId = String(body.guardId || "")
    const monthInput = String(body.month || "")
    const hours = Number(body.hours || 0)
    const rate = Number(body.rate || 0)

    if (!guardId || !monthInput) {
      return NextResponse.json({ message: "guardId and month are required." }, { status: 400 })
    }

    const month = parseMonth(monthInput)
    if (!month) {
      return NextResponse.json({ message: "Invalid month value." }, { status: 400 })
    }

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) {
      return NextResponse.json({ message: "Guard not found." }, { status: 404 })
    }
    if (managerScope && managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return NextResponse.json({ message: "Forbidden: guard is outside your scope." }, { status: 403 })
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
      extraHoursAmount: amount,
      specialDutyAmount: existing?.specialDutyAmount ?? 0,
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
            extraHours: hours,
            extraHoursAmount: amount,
            netSalary,
          },
          include: { guard: { select: { id: true, name: true, parwestId: true } } },
        })
      : await prisma.payroll.create({
          data: {
            guardId,
            month,
            year,
            extraHours: hours,
            extraHoursAmount: amount,
            netSalary,
          },
          include: { guard: { select: { id: true, name: true, parwestId: true } } },
        })

    return NextResponse.json(saved, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error("Error saving extra hours:", error)
    return NextResponse.json({ message: "Failed to save extra hours." }, { status: 500 })
  }
}
