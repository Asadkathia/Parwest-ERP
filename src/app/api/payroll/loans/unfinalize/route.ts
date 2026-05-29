import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deriveManagerScope } from "@/lib/access/scope"
import { badRequest, forbidden, internalServerError, unauthorized } from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

import { parseMonthRange as parseMonth } from "@/lib/payroll/date-helpers"
import { affectedMonthStarts, recalcAffectedMonths } from "@/lib/payroll/special-duty-recalc"

// Payroll states under which the month is locked and a finalized loan must not
// be silently reverted (it would desync the loan ledger from the frozen payroll).
const LOCKED_PAYROLL_STATES = new Set([
  "REGIONAL_LOCKED",
  "GLOBAL_FINALIZED",
  "PAID",
])

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    const scope = deriveManagerScope(session)

    const body = await request.json()
    const month = parseMonth(String(body.month || ""))
    if (!month) return badRequest("Valid month required (YYYY-MM).")

    const regionId = body.regionId ? String(body.regionId) : null
    if (scope?.regionId && regionId && regionId !== scope.regionId) {
      return forbidden("Forbidden: region is outside your scope.")
    }

    const where: Prisma.LoanWhereInput = {
      status: "FINALIZED",
      month: { gte: month.start, lt: month.end },
    }

    if (regionId) {
      where.OR = [
        { regionId },
        { regionId: null, guard: { is: { regionId } } },
      ]
    } else if (scope?.regionId) {
      where.OR = [
        { regionId: scope.regionId },
        { regionId: null, guard: { is: { regionId: scope.regionId } } },
      ]
    }

    // Pull the candidate finalized loans first so we can guard locked months
    // before reverting (a bare updateMany would silently revert loans under a
    // REGIONAL_LOCKED / GLOBAL_FINALIZED / PAID payroll, desyncing the ledger).
    const candidates = await prisma.loan.findMany({
      where,
      select: { id: true, guardId: true },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ reverted: 0, message: "No finalized loans in the selected month/region." })
    }

    // All candidates fall within the same payroll month. Find which guards have
    // a locked payroll for that month; their loans must not be reverted.
    const guardIds = Array.from(new Set(candidates.map((l) => l.guardId)))
    const monthYear = month.start.getUTCFullYear()
    const lockedPayrolls = await prisma.payroll.findMany({
      where: {
        guardId: { in: guardIds },
        month: { gte: month.start, lt: month.end },
        year: monthYear,
        state: { in: Array.from(LOCKED_PAYROLL_STATES) },
      },
      select: { guardId: true, state: true },
    })
    const lockedGuardIds = new Set(lockedPayrolls.map((p) => p.guardId))

    const revertable = candidates.filter((l) => !lockedGuardIds.has(l.guardId))
    const revertableIds = revertable.map((l) => l.id)

    const warnings: string[] = []
    if (lockedGuardIds.size > 0) {
      const monthLabel = month.start.toISOString().slice(0, 7)
      warnings.push(
        `${lockedGuardIds.size} guard(s) have a locked payroll for ${monthLabel}; their loans were not unfinalized.`,
      )
    }

    if (revertableIds.length === 0) {
      return NextResponse.json({ reverted: 0, ...(warnings.length > 0 ? { warnings } : {}) })
    }

    const result = await prisma.$transaction(async (tx) => {
      const reverted = await tx.loan.updateMany({
        where: { id: { in: revertableIds } },
        data: { status: "PENDING", finalizedAt: null, finalizedById: null },
      })
      return reverted
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user?.id ?? "system",
        event: "PAYROLL_LOAN_UNFINALIZE",
        module: "PAYROLL",
        description: `Unfinalized ${result.count} loans for month ${month.start.toISOString().slice(0, 7)}${regionId ? ` region ${regionId}` : ""}.`,
      },
    }).catch(() => {})

    // A reverted (now PENDING) loan no longer counts toward Payroll.loans.
    // Recompute each affected guard's payroll for this month. Locked months are
    // surfaced as warnings, but those guards were already excluded above.
    const actorUserId = session.user?.id ?? null
    const monthStarts = affectedMonthStarts(month.start, month.start)
    const revertedGuardIds = Array.from(new Set(revertable.map((l) => l.guardId)))
    for (const guardId of revertedGuardIds) {
      const w = await recalcAffectedMonths(guardId, monthStarts, actorUserId)
      warnings.push(...w)
    }

    return NextResponse.json({ reverted: result.count, ...(warnings.length > 0 ? { warnings } : {}) })
  } catch (error) {
    console.error("Error unfinalizing loans:", error)
    return internalServerError("Failed to unfinalize loans.")
  }
}
