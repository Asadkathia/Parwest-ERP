import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { calculatePayrollNetSalary } from "@/lib/payroll/netSalary"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"

const ALLOWED_PAYMENT_STATUSES = new Set(["PENDING", "UNPAID", "PAID"])

function parseMonthRange(value: string | null) {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null

  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  return { start, end, year: start.getUTCFullYear() }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const managerScope = deriveManagerScope(session)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("paymentStatus") || undefined
    const monthRaw = searchParams.get("month")
    const search = searchParams.get("search") || undefined

    const where: Prisma.PayrollWhereInput = {}
    if (status) {
      if (!ALLOWED_PAYMENT_STATUSES.has(status)) {
        return badRequest("paymentStatus must be PENDING, UNPAID, or PAID.")
      }
      where.paymentStatus = status
    }
    if (monthRaw) {
      const month = parseMonthRange(monthRaw)
      if (!month) return badRequest("Invalid month value. Use YYYY-MM or YYYY-MM-DD.")
      where.month = {
        gte: month.start,
        lt: month.end,
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
        guard: { select: { id: true, name: true, parwestId: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching payroll salary rows:", error)
    return internalServerError("Failed to fetch salary rows.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    const managerScope = deriveManagerScope(session)

    const body = await request.json()
    const monthInput = String(body.month || "")
    const guardId = body.guardId ? String(body.guardId) : undefined
    const clientId = body.clientId ? String(body.clientId) : undefined
    const branchId = body.branchId ? String(body.branchId) : undefined
    const regionalOfficeId = body.regionalOfficeId ? String(body.regionalOfficeId) : undefined
    const regionId = body.regionId ? String(body.regionId) : undefined
    const finalize = Boolean(body.finalize)

    if (!monthInput) return badRequest("month is required.")
    const month = parseMonthRange(monthInput)
    if (!month) return badRequest("Invalid month value. Use YYYY-MM or YYYY-MM-DD.")

    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: regionId || null,
        regionalOfficeId: regionalOfficeId || null,
      })
    ) {
      return forbidden("Forbidden: requested payroll calculation scope is outside your assignment.")
    }

    if (guardId) {
      const guard = await prisma.guard.findUnique({
        where: { id: guardId },
        select: { id: true, regionId: true, regionalOfficeId: true },
      })
      if (!guard) return notFound("Guard not found.")
      if (
        managerScope &&
        managerScopeDenied(managerScope, {
          regionId: guard.regionId || null,
          regionalOfficeId: guard.regionalOfficeId || null,
        })
      ) {
        return forbidden("Forbidden: guard is outside your scope.")
      }
    }

    const deployments = await prisma.deployment.findMany({
      where: {
        deploymentDate: {
          gte: month.start,
          lt: month.end,
        },
        ...(guardId ? { guardId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(regionalOfficeId ? { regionalOfficeId } : {}),
        ...(managerScope?.regionalOfficeIds.length
          ? { regionalOfficeId: { in: managerScope.regionalOfficeIds } }
          : {}),
        ...(regionId || managerScope?.regionId
          ? {
              guard: {
                is: {
                  ...(regionId ? { regionId } : {}),
                  ...(managerScope?.regionId ? { regionId: managerScope.regionId } : {}),
                },
              },
            }
          : {}),
      },
      select: {
        guardId: true,
        deploymentDate: true,
        salary: true,
        rate: true,
      },
    })

    const guardIds = Array.from(new Set(deployments.map((deployment) => deployment.guardId)))
    if (guardIds.length === 0) {
      return NextResponse.json({
        calculated: 0,
        finalized: 0,
        month: month.start.toISOString(),
        rows: [],
      })
    }

    const [finalizedLoans, existingRows] = await Promise.all([
      prisma.loan.findMany({
        where: {
          guardId: { in: guardIds },
          status: "FINALIZED",
          month: {
            gte: month.start,
            lt: month.end,
          },
        },
        select: {
          guardId: true,
          amount: true,
        },
      }),
      prisma.payroll.findMany({
        where: {
          guardId: { in: guardIds },
          month: {
            gte: month.start,
            lt: month.end,
          },
          year: month.year,
        },
        select: {
          id: true,
          guardId: true,
          baseSalary: true,
          extraHours: true,
          extraHoursAmount: true,
          specialDutyHours: true,
          specialDutyAmount: true,
          loans: true,
          otherDeductions: true,
          trainingSchoolFees: true,
          cwf: true,
          eobi: true,
          essi: true,
          paymentStatus: true,
          paymentMethod: true,
        },
      }),
    ])

    const loanByGuard = finalizedLoans.reduce<Record<string, number>>((acc, loan) => {
      acc[loan.guardId] = Number(((acc[loan.guardId] || 0) + Number(loan.amount || 0)).toFixed(2))
      return acc
    }, {})

    const deploymentAgg = deployments.reduce<
      Record<
        string,
        {
          baseSalary: number
          days: Set<string>
        }
      >
    >((acc, deployment) => {
      if (!acc[deployment.guardId]) {
        acc[deployment.guardId] = { baseSalary: 0, days: new Set() }
      }
      const amount = Number(deployment.salary ?? deployment.rate ?? 0)
      acc[deployment.guardId].baseSalary = Number((acc[deployment.guardId].baseSalary + amount).toFixed(2))
      acc[deployment.guardId].days.add(deployment.deploymentDate.toISOString().slice(0, 10))
      return acc
    }, {})

    const existingByGuard = new Map(existingRows.map((row) => [row.guardId, row]))
    const rows = []
    let finalizedCount = 0
    const zeroSalaryGuardIds: string[] = []

    for (const currentGuardId of guardIds) {
      const existing = existingByGuard.get(currentGuardId)
      const baseSalary = Number((deploymentAgg[currentGuardId]?.baseSalary || 0).toFixed(2))
      if (baseSalary === 0) zeroSalaryGuardIds.push(currentGuardId)
      const deploymentDays = deploymentAgg[currentGuardId]?.days.size || 0
      const loans = Number((loanByGuard[currentGuardId] || 0).toFixed(2))
      const extraHoursAmount = Number(existing?.extraHoursAmount || 0)
      const specialDutyAmount = Number(existing?.specialDutyAmount || 0)
      const otherDeductions = Number(existing?.otherDeductions || 0)
      const trainingSchoolFees = Number(existing?.trainingSchoolFees || 0)
      const cwf = Number(existing?.cwf || 0)
      const eobi = Number(existing?.eobi || 0)
      const essi = Number(existing?.essi || 0)

      const netSalary = calculatePayrollNetSalary({
        baseSalary,
        extraHoursAmount,
        specialDutyAmount,
        loans,
        otherDeductions,
        trainingSchoolFees,
        cwf,
        eobi,
        essi,
      })

      const paymentStatus = finalize
        ? existing?.paymentStatus === "PAID"
          ? "PAID"
          : "UNPAID"
        : existing?.paymentStatus || "PENDING"

      if (finalize && paymentStatus === "UNPAID") finalizedCount += 1

      const saved = await prisma.payroll.upsert({
        where: {
          guardId_month_year: {
            guardId: currentGuardId,
            month: month.start,
            year: month.year,
          },
        },
        create: {
          guardId: currentGuardId,
          month: month.start,
          year: month.year,
          baseSalary,
          deploymentDays,
          extraHours: Number(existing?.extraHours || 0),
          extraHoursAmount,
          specialDutyHours: Number(existing?.specialDutyHours || 0),
          specialDutyAmount,
          loans,
          otherDeductions,
          trainingSchoolFees,
          cwf,
          eobi,
          essi,
          netSalary,
          paymentStatus,
          paymentMethod: existing?.paymentMethod || null,
        },
        update: {
          baseSalary,
          deploymentDays,
          loans,
          netSalary,
          paymentStatus,
        },
        include: {
          guard: {
            select: { id: true, name: true, parwestId: true },
          },
        },
      })

      rows.push(saved)
    }

    let warnings: { guardId: string; name: string; parwestId: string | null; guardSalary: number | null }[] = []
    if (zeroSalaryGuardIds.length > 0) {
      const zeroGuards = await prisma.guard.findMany({
        where: { id: { in: zeroSalaryGuardIds } },
        select: { id: true, name: true, parwestId: true, salary: true },
      })
      warnings = zeroGuards.map((g) => ({
        guardId: g.id,
        name: g.name,
        parwestId: g.parwestId,
        guardSalary: g.salary,
      }))
    }

    return NextResponse.json(
      {
        calculated: rows.length,
        finalized: finalizedCount,
        month: month.start.toISOString(),
        rows,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error calculating payroll salary rows:", error)
    return internalServerError("Failed to calculate payroll salary rows.")
  }
}
