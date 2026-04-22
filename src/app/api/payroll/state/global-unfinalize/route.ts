/**
 * POST /api/payroll/state/global-unfinalize
 *
 * Reverts GLOBAL_FINALIZED → REGIONAL_LOCKED for a month. SuperAdmin only.
 * `reason` is required.
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
      return forbidden("Only SuperAdmin can unfreeze a global finalization.")
    }

    const body = (await request.json().catch(() => ({}))) as {
      month?: string
      reason?: string
    }
    const month = parseMonthRange(body.month ?? null)
    if (!month) return badRequest("Valid month required (YYYY-MM).")
    const reason = (body.reason ?? "").trim()
    if (!reason) return badRequest("A reason is required to unfreeze.")

    const candidates = await prisma.payroll.findMany({
      where: {
        state: "GLOBAL_FINALIZED",
        month: { gte: month.start, lt: month.end },
      },
      select: { id: true },
    })
    if (candidates.length === 0) {
      return ok({ unfinalized: 0, message: "No GLOBAL_FINALIZED payrolls." })
    }

    const ids = candidates.map((c) => c.id)
    const actor = getActorIdentity(session)

    await prisma.payroll.updateMany({
      where: { id: { in: ids }, state: "GLOBAL_FINALIZED" },
      data: {
        state: "REGIONAL_LOCKED",
        globalFinalizedAt: null,
        globalFinalizedById: null,
      },
    })

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_GLOBAL_UNFINALIZE",
      module: "PAYROLL",
      description: `Unfroze global finalization on ${
        candidates.length
      } payrolls for ${month.start
        .toISOString()
        .slice(0, 7)} — reason: ${reason}`,
    })

    return ok({ unfinalized: candidates.length })
  } catch (error) {
    console.error("global-unfinalize failed:", error)
    return internalServerError("Failed to unfreeze global finalization.")
  }
}
