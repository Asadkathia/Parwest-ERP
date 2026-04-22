/**
 * POST /api/payroll/state/unlock-region
 *
 * Reverts REGIONAL_LOCKED → CALCULATED for a (month, region[, office]).
 * Deletes the ACCRUED reserve ledger entries that were created during lock
 * (so the accrual is fully reversed). SuperAdmin only.
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
      return forbidden("Only SuperAdmin can unlock a region.")
    }

    const body = (await request.json().catch(() => ({}))) as {
      month?: string
      regionId?: string | null
      regionalOfficeId?: string | null
      reason?: string
    }

    const month = parseMonthRange(body.month ?? null)
    if (!month) return badRequest("Valid month required (YYYY-MM).")
    if (!body.regionId) return badRequest("regionId is required.")

    const regionId = String(body.regionId)
    const regionalOfficeId = body.regionalOfficeId
      ? String(body.regionalOfficeId)
      : null
    const reason = (body.reason ?? "").trim()

    const where: Prisma.PayrollWhereInput = {
      state: "REGIONAL_LOCKED",
      month: { gte: month.start, lt: month.end },
      regionId,
    }
    if (regionalOfficeId) where.regionalOfficeId = regionalOfficeId

    const preview = await prisma.payroll.findMany({
      where,
      select: { id: true },
    })
    if (preview.length === 0) {
      return ok({ unlocked: 0, message: "No REGIONAL_LOCKED payrolls match." })
    }

    const ids = preview.map((c) => c.id)
    const actor = getActorIdentity(session)

    // Run state flip + ledger reversal in a single transaction. The updateMany
    // is guarded by `state: REGIONAL_LOCKED`; we use its returned `count` to
    // decide whether to delete ledger rows. Ledger deletion is keyed to the
    // same id set inside the same transaction, so concurrent runners can only
    // delete entries for rows they actually flipped.
    const flippedCount = await prisma.$transaction(async (trx) => {
      const flip = await trx.payroll.updateMany({
        where: { id: { in: ids }, state: "REGIONAL_LOCKED" },
        data: {
          state: "CALCULATED",
          regionalLockedAt: null,
          regionalLockedById: null,
        },
      })

      if (flip.count === 0) return 0

      await trx.payrollReserveLedger.deleteMany({
        where: { payrollId: { in: ids }, type: "ACCRUED" },
      })

      return flip.count
    })

    if (flippedCount === 0) {
      return ok({
        unlocked: 0,
        message:
          "No REGIONAL_LOCKED payrolls remained at unlock time (concurrent run).",
      })
    }

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_UNLOCK_REGION",
      module: "PAYROLL",
      description: `Unlocked ${flippedCount} payrolls for ${month.start
        .toISOString()
        .slice(0, 7)} (region=${regionId}, office=${regionalOfficeId ?? "*"})${
        reason ? ` — reason: ${reason}` : ""
      }`,
    })

    return ok({ unlocked: flippedCount })
  } catch (error) {
    console.error("unlock-region failed:", error)
    return internalServerError("Failed to unlock region payrolls.")
  }
}
