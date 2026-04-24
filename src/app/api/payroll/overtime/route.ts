/**
 * POST /api/payroll/overtime
 *
 * Manages hourly overtime that derives its rate from `Deployment.overtime`.
 * Distinct from /api/payroll/extra-hours, which uses a manual user-entered rate.
 *
 * Writes Payroll.overtimeHours / overtimeAmount, then triggers a canonical
 * recalc + persist in the same transaction.
 */

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import {
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"
import { parseMonthRange, parseMonthStart as parseMonth } from "@/lib/payroll/date-helpers"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

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

    const where: Prisma.PayrollWhereInput = {
      overtimeAmount: { gt: 0 },
    }
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
      include: {
        guard: { select: { id: true, name: true, parwestId: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    })

    return NextResponse.json(rows)
  } catch (error) {
    console.error("Error fetching overtime rows:", error)
    return internalServerError("Failed to fetch overtime records.")
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
    const deploymentId: string | undefined = body.deploymentId
      ? String(body.deploymentId)
      : undefined

    if (!guardId || !monthInput) {
      return badRequest("guardId and month are required.")
    }
    if (!Number.isFinite(hours) || hours < 0) {
      return badRequest("hours must be a non-negative number.")
    }

    const month = parseMonth(monthInput)
    const monthRange = parseMonthRange(monthInput)
    if (!month || !monthRange) {
      return badRequest("Invalid month value.")
    }

    const guard = await prisma.guard.findUnique({
      where: { id: guardId },
      select: { id: true, regionId: true, regionalOfficeId: true },
    })
    if (!guard) return notFound("Guard not found.")
    if (
      managerScope &&
      managerScopeDenied(managerScope, {
        regionId: guard.regionId,
        regionalOfficeId: guard.regionalOfficeId,
      })
    ) {
      return forbidden("Forbidden: guard is outside your scope.")
    }

    // ---- Resolve overtime rate ------------------------------------------
    let rate = 0
    if (deploymentId) {
      const dep = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: {
          id: true,
          guardId: true,
          deploymentDate: true,
          overtime: true,
        },
      })
      if (!dep) return notFound("Deployment not found.")
      if (dep.guardId !== guardId) {
        return badRequest("Deployment does not belong to the specified guard.")
      }
      if (
        dep.deploymentDate < monthRange.start ||
        dep.deploymentDate >= monthRange.end
      ) {
        return badRequest("Deployment is not in the specified month.")
      }
      rate = Number(dep.overtime ?? 0)
    } else {
      const deployments = await prisma.deployment.findMany({
        where: {
          guardId,
          deploymentDate: { gte: monthRange.start, lt: monthRange.end },
        },
        select: { overtime: true, deploymentDate: true },
        orderBy: { deploymentDate: "desc" },
      })
      if (deployments.length === 0) {
        return badRequest("No deployments for this guard in the given month.")
      }
      // Use most recent deployment's overtime rate.
      rate = Number(deployments[0].overtime ?? 0)
    }

    const year = month.getUTCFullYear()
    const amount = Number((hours * rate).toFixed(2))
    const actorUserId =
      (session.user as { id?: string | null } | undefined)?.id ?? null

    let payrollId: string
    try {
      payrollId = await prisma.$transaction(async (tx) => {
        const existingRow = await tx.payroll.findUnique({
          where: { guardId_month_year: { guardId, month, year } },
          select: { id: true },
        })
        if (existingRow) {
          await tx.payroll.update({
            where: { id: existingRow.id },
            data: { overtimeHours: hours, overtimeAmount: amount },
          })
        } else {
          await tx.payroll.create({
            data: {
              guardId,
              month,
              year,
              overtimeHours: hours,
              overtimeAmount: amount,
            },
          })
        }
        const computation = await calculateGuardPayroll(guardId, month, { trx: tx })
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
        return badRequest("Payroll for this month is locked. Cannot edit overtime.")
      }
      throw err
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: actorUserId,
          event: "PAYROLL_OVERTIME_UPDATE",
          module: "PAYROLL",
          description: `Updated overtime for guard ${guardId} month ${monthInput}`,
        },
      })
    } catch (auditErr) {
      console.error("Failed to write overtime audit log:", auditErr)
    }

    const saved = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { guard: { select: { id: true, name: true, parwestId: true } } },
    })
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Error saving overtime:", error)
    return internalServerError("Failed to save overtime.")
  }
}
