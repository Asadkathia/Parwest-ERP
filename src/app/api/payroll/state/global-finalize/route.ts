/**
 * POST /api/payroll/state/global-finalize
 *
 * Locks all REGIONAL_LOCKED payrolls for a month → GLOBAL_FINALIZED.
 * Records a GLOBAL-scope PayrollSalaryFinalizationHistory snapshot.
 * SuperAdmin only.
 *
 * TODO(concurrency): Consider adding a partial unique index on
 * PayrollSalaryFinalizationHistory(month, scope, regionId) WHERE
 * regionalOfficeId IS NULL — would let the DB enforce one history row per
 * (month, scope, region) and surface duplicate-attempt as a P2002 we can
 * return as conflict(). Requires a migration; deferred to a future cleanup.
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
import { hasAction } from "@/lib/api/permissions"
import { parseMonthRange } from "@/lib/payroll/date-helpers"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { getActorIdentity, isSuperAdmin } from "@/lib/payroll/state-permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")
    if (!isSuperAdmin(session)) {
      return forbidden("Only SuperAdmin can perform global finalization.")
    }

    const body = (await request.json().catch(() => ({}))) as { month?: string }
    const month = parseMonthRange(body.month ?? null)
    if (!month) return badRequest("Valid month required (YYYY-MM).")

    const preview = await prisma.payroll.findMany({
      where: {
        state: "REGIONAL_LOCKED",
        month: { gte: month.start, lt: month.end },
      },
      select: { id: true },
    })

    if (preview.length === 0) {
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

    const result = await prisma.$transaction(async (trx) => {
      // Marker-based concurrency guard: stamp `globalFinalizedAt = now` and
      // `globalFinalizedById = actor.id` only on rows still REGIONAL_LOCKED.
      // We then re-find by these markers to get the rows THIS transaction
      // actually flipped, so concurrent runners don't double-write history.
      const flip = await trx.payroll.updateMany({
        where: {
          state: "REGIONAL_LOCKED",
          month: { gte: month.start, lt: month.end },
        },
        data: {
          state: "GLOBAL_FINALIZED",
          globalFinalizedAt: now,
          globalFinalizedById: actor.id,
        },
      })

      if (flip.count === 0) {
        return {
          historyId: null as string | null,
          finalized: 0,
          totalNet: 0,
          totalReserve: 0,
        }
      }

      const flipped = await trx.payroll.findMany({
        where: {
          state: "GLOBAL_FINALIZED",
          globalFinalizedAt: now,
          globalFinalizedById: actor.id,
        },
        select: { id: true, netSalary: true, reserveAmount: true },
      })

      const flippedIds = flipped.map((c) => c.id)
      const totalNet = flipped.reduce(
        (s, c) => s + Number(c.netSalary ?? 0),
        0
      )
      const totalReserve = flipped.reduce(
        (s, c) => s + Number(c.reserveAmount ?? 0),
        0
      )

      const history = await trx.payrollSalaryFinalizationHistory.create({
        data: {
          finalizedByUserId: actor.id,
          finalizedByName: actor.name,
          scope: "GLOBAL",
          regionId: null,
          regionalOfficeId: null,
          month: month.start,
          payrollCount: flipped.length,
          totalNetPayable: totalNet,
          totalReserve: totalReserve,
          payrollIdsJson: JSON.stringify(flippedIds),
        },
        select: { id: true },
      })

      return {
        historyId: history.id as string | null,
        finalized: flipped.length,
        totalNet,
        totalReserve,
      }
    })

    if (result.finalized === 0) {
      return ok({
        finalized: 0,
        totalNet: 0,
        totalReserve: 0,
        historyId: null,
        message:
          "No REGIONAL_LOCKED payrolls remained at finalize time (concurrent run).",
      })
    }

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_GLOBAL_FINALIZE",
      module: "PAYROLL",
      description: `Globally finalized ${
        result.finalized
      } payrolls for ${month.start
        .toISOString()
        .slice(0, 7)}; totalNet=${result.totalNet.toFixed(
        2
      )} reserve=${result.totalReserve.toFixed(2)}`,
    })

    return ok({
      finalized: result.finalized,
      totalNet: result.totalNet,
      totalReserve: result.totalReserve,
      historyId: result.historyId,
    })
  } catch (error) {
    console.error("global-finalize failed:", error)
    return internalServerError("Failed to globally finalize payrolls.")
  }
}
