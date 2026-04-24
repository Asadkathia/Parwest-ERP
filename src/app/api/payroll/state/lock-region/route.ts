/**
 * POST /api/payroll/state/lock-region
 *
 * Locks all CALCULATED payrolls for a (month, region[, regionalOffice]) →
 * REGIONAL_LOCKED. Records a PayrollSalaryFinalizationHistory snapshot and
 * inserts ACCRUED PayrollReserveLedger entries for each non-zero reserve.
 *
 * Allowed: any user with PAYROLL module access; if the caller is a regional
 * manager, the requested region must match their scope. SuperAdmin can lock
 * any region.
 *
 * TODO(concurrency): Consider adding a partial unique index on
 * PayrollSalaryFinalizationHistory(month, scope, regionId) WHERE
 * regionalOfficeId IS NULL — would let the DB enforce one history row per
 * (month, scope, region) and surface duplicate-attempt as a P2002 we can
 * return as conflict(). Requires a migration; deferred to a future cleanup.
 */

import { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
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
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { parseMonthRange } from "@/lib/payroll/date-helpers"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { getActorIdentity, isSuperAdmin } from "@/lib/payroll/state-permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")

    const body = (await request.json().catch(() => ({}))) as {
      month?: string
      regionId?: string | null
      regionalOfficeId?: string | null
    }

    const month = parseMonthRange(body.month ?? null)
    if (!month) return badRequest("Valid month required (YYYY-MM).")

    const scope = deriveManagerScope(session)
    const superAdmin = isSuperAdmin(session)

    // Resolve target region/office
    let regionId: string | null = body.regionId ? String(body.regionId) : null
    let regionalOfficeId: string | null = body.regionalOfficeId
      ? String(body.regionalOfficeId)
      : null

    if (!superAdmin && scope) {
      // Default to the manager's own scope when not provided
      if (!regionId && scope.regionId) regionId = scope.regionId
      if (!regionalOfficeId && scope.regionalOfficeIds.length === 1) {
        regionalOfficeId = scope.regionalOfficeIds[0]
      }
      if (
        managerScopeDenied(scope, {
          regionId: regionId ?? undefined,
          regionalOfficeId: regionalOfficeId ?? undefined,
        })
      ) {
        return forbidden("Region or office is outside your scope.")
      }
    }

    // Build where filter
    const where: Prisma.PayrollWhereInput = {
      state: "CALCULATED",
      month: { gte: month.start, lt: month.end },
    }
    if (regionId) where.regionId = regionId
    if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId

    const preview = await prisma.payroll.findMany({
      where,
      select: { id: true },
    })

    if (preview.length === 0) {
      return ok({
        locked: 0,
        totalNet: 0,
        totalReserve: 0,
        historyId: null,
        message: "No CALCULATED payrolls found for the selected scope.",
      })
    }

    const actor = getActorIdentity(session)
    const now = new Date()

    const result = await prisma.$transaction(async (trx) => {
      // Marker-based concurrency guard: stamp `regionalLockedAt = now` and
      // `regionalLockedById = actor.id` only on rows still CALCULATED. We then
      // re-find using these markers to get exactly the rows THIS transaction
      // flipped (so concurrent runners can't double-write history/ledger).
      const flip = await trx.payroll.updateMany({
        where: { ...where, state: "CALCULATED" },
        data: {
          state: "REGIONAL_LOCKED",
          regionalLockedAt: now,
          regionalLockedById: actor.id,
        },
      })

      if (flip.count === 0) {
        return {
          historyId: null as string | null,
          locked: 0,
          totalNet: 0,
          totalReserve: 0,
        }
      }

      const flipped = await trx.payroll.findMany({
        where: {
          state: "REGIONAL_LOCKED",
          regionalLockedAt: now,
          regionalLockedById: actor.id,
        },
        select: {
          id: true,
          guardId: true,
          netSalary: true,
          reserveAmount: true,
        },
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

      // Create ACCRUED ledger entries for non-zero reserve amounts
      const ledgerRows = flipped
        .filter((c) => Number(c.reserveAmount ?? 0) !== 0)
        .map((c) => ({
          guardId: c.guardId,
          payrollId: c.id,
          type: "ACCRUED",
          amount: Number(c.reserveAmount ?? 0),
          byUserId: actor.id,
          byUserName: actor.name,
        }))
      if (ledgerRows.length > 0) {
        await trx.payrollReserveLedger.createMany({ data: ledgerRows })
      }

      const history = await trx.payrollSalaryFinalizationHistory.create({
        data: {
          finalizedByUserId: actor.id,
          finalizedByName: actor.name,
          scope: "REGION",
          regionId: regionId,
          regionalOfficeId: regionalOfficeId,
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
        locked: flipped.length,
        totalNet,
        totalReserve,
      }
    })

    if (result.locked === 0) {
      return ok({
        locked: 0,
        totalNet: 0,
        totalReserve: 0,
        historyId: null,
        message:
          "No CALCULATED payrolls remained at lock time (concurrent run).",
      })
    }

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_LOCK_REGION",
      module: "PAYROLL",
      description: `Locked ${result.locked} payrolls for ${month.start
        .toISOString()
        .slice(0, 7)} (region=${regionId ?? "*"}, office=${
        regionalOfficeId ?? "*"
      }); totalNet=${result.totalNet.toFixed(
        2
      )} reserve=${result.totalReserve.toFixed(2)}`,
    })

    return ok({
      locked: result.locked,
      totalNet: result.totalNet,
      totalReserve: result.totalReserve,
      historyId: result.historyId,
    })
  } catch (error) {
    console.error("lock-region failed:", error)
    return internalServerError("Failed to lock region payrolls.")
  }
}
