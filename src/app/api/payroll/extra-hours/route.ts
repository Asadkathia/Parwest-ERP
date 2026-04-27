import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, notFound, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

import { parseMonthStart as parseMonth } from "@/lib/payroll/date-helpers"

const LOCK_MESSAGE_FRAGMENT = "Cannot recalculate payroll"

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
    const regionIdParam = searchParams.get("regionId")?.trim() || null
    const regionalOfficeIdParam = searchParams.get("regionalOfficeId")?.trim() || null

    if (managerScope && managerScopeDenied(managerScope, {
      regionId: regionIdParam,
      regionalOfficeId: regionalOfficeIdParam,
    })) {
      return forbidden("Forbidden: cannot query extra-hours outside your scope.")
    }

    const where: Prisma.PayrollWhereInput = {}
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

    // Payroll has both regionId and regionalOfficeId directly on the row, but
    // guard is the authoritative source. Filter through the guard relation so
    // that rows with null regionId on Payroll (pre-migration) still get scoped.
    const guardFilter: Record<string, unknown> = {}
    if (managerScope?.regionId) guardFilter.regionId = managerScope.regionId
    if (managerScope && managerScope.regionalOfficeIds.length > 0) {
      guardFilter.regionalOfficeId = { in: managerScope.regionalOfficeIds }
    }
    if (regionIdParam) guardFilter.regionId = regionIdParam
    if (regionalOfficeIdParam) guardFilter.regionalOfficeId = regionalOfficeIdParam
    if (Object.keys(guardFilter).length > 0) where.guard = { is: guardFilter }

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
    return internalServerError("Failed to fetch extra hours records.")
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
    if (!guard) {
      return notFound("Guard not found.")
    }
    if (managerScope && managerScopeDenied(managerScope, { regionId: guard.regionId, regionalOfficeId: guard.regionalOfficeId })) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    const year = month.getUTCFullYear()
    const amount = Number((hours * rate).toFixed(2))
    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    let payrollId: string
    try {
      payrollId = await prisma.$transaction(async (tx) => {
        // 1) Find or create the Payroll row, write only extraHours/extraHoursAmount.
        const existingRow = await tx.payroll.findUnique({
          where: {
            guardId_month_year: { guardId, month, year },
          },
          select: { id: true },
        })

        if (existingRow) {
          await tx.payroll.update({
            where: { id: existingRow.id },
            data: {
              extraHours: hours,
              extraHoursAmount: amount,
            },
          })
        } else {
          await tx.payroll.create({
            data: {
              guardId,
              month,
              year,
              extraHours: hours,
              extraHoursAmount: amount,
            },
          })
        }

        // 2) Recalculate via canonical engine.
        const computation = await calculateGuardPayroll(guardId, month, { trx: tx })
        // 3) Persist (transitions DRAFT -> CALCULATED).
        const persisted = await persistGuardPayroll(computation, {
          trx: tx,
          actorUserId,
          setStateToCalculated: true,
        })
        return persisted.payrollId
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes(LOCK_MESSAGE_FRAGMENT)) {
        return badRequest("Payroll for this month is locked. Cannot edit extra hours.")
      }
      throw err
    }

    // Audit log (best-effort)
    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_EXTRA_HOURS_UPDATE",
          module: "PAYROLL",
          description: `Updated extra hours for guard ${guardId} month ${monthInput}`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write extra-hours audit log:", auditErr)
    }

    const saved = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
    })
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Error saving extra hours:", error)
    return internalServerError("Failed to save extra hours.")
  }
}
