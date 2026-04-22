/**
 * POST /api/payroll/state/global-finalize
 *
 * Locks all REGIONAL_LOCKED payrolls for a month → GLOBAL_FINALIZED.
 * Records a GLOBAL-scope PayrollSalaryFinalizationHistory snapshot.
 * SuperAdmin only.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  forbidden,
  internalServerError,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { parseMonthRange } from "@/lib/payroll/date-helpers"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { getActorIdentity, isSuperAdmin } from "@/lib/payroll/state-permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    if (!isSuperAdmin(session)) {
      return forbidden("Only SuperAdmin can perform global finalization.")
    }

    const body = (await request.json().catch(() => ({}))) as { month?: string }
    const month = parseMonthRange(body.month ?? null)
    if (!month) return badRequest("Valid month required (YYYY-MM).")

    const candidates = await prisma.payroll.findMany({
      where: {
        state: "REGIONAL_LOCKED",
        month: { gte: month.start, lt: month.end },
      },
      select: { id: true, netSalary: true, reserveAmount: true },
    })

    if (candidates.length === 0) {
      return ok({
        finalized: 0,
        totalNet: 0,
        totalReserve: 0,
        historyId: null,
        message: "No REGIONAL_LOCKED payrolls found for the month.",
      })
    }

    const actor = getActorIdentity(session)
    const now = new Date()
    const ids = candidates.map((c) => c.id)
    const totalNet = candidates.reduce(
      (s, c) => s + Number(c.netSalary ?? 0),
      0
    )
    const totalReserve = candidates.reduce(
      (s, c) => s + Number(c.reserveAmount ?? 0),
      0
    )

    const historyId = await prisma.$transaction(async (trx) => {
      await trx.payroll.updateMany({
        where: { id: { in: ids }, state: "REGIONAL_LOCKED" },
        data: {
          state: "GLOBAL_FINALIZED",
          globalFinalizedAt: now,
          globalFinalizedById: actor.id,
        },
      })
      const history = await trx.payrollSalaryFinalizationHistory.create({
        data: {
          finalizedByUserId: actor.id,
          finalizedByName: actor.name,
          scope: "GLOBAL",
          regionId: null,
          regionalOfficeId: null,
          month: month.start,
          payrollCount: candidates.length,
          totalNetPayable: totalNet,
          totalReserve: totalReserve,
          payrollIdsJson: JSON.stringify(ids),
        },
        select: { id: true },
      })
      return history.id
    })

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_GLOBAL_FINALIZE",
      module: "PAYROLL",
      description: `Globally finalized ${
        candidates.length
      } payrolls for ${month.start
        .toISOString()
        .slice(0, 7)}; totalNet=${totalNet.toFixed(
        2
      )} reserve=${totalReserve.toFixed(2)}`,
    })

    return ok({
      finalized: candidates.length,
      totalNet,
      totalReserve,
      historyId,
    })
  } catch (error) {
    console.error("global-finalize failed:", error)
    return internalServerError("Failed to globally finalize payrolls.")
  }
}
