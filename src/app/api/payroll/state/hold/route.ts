/**
 * POST /api/payroll/state/hold
 *
 * Places a HOLD on a single Payroll row. Reason is required. Allowed from
 * DRAFT, CALCULATED, REGIONAL_LOCKED, or EMERGENCY_RELEASED. Rejected for
 * HOLD, PAID, or GLOBAL_FINALIZED.
 *
 * Lock timestamps (regionalLockedAt etc.) are intentionally preserved so the
 * release endpoint can return the row to its previous resting state.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasModuleAccess } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { getActorIdentity } from "@/lib/payroll/state-permissions"

const HOLDABLE_STATES = new Set([
  "DRAFT",
  "CALCULATED",
  "REGIONAL_LOCKED",
  "EMERGENCY_RELEASED",
])

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")

    const body = (await request.json().catch(() => ({}))) as {
      payrollId?: string
      reason?: string
    }
    const payrollId = body.payrollId ? String(body.payrollId) : ""
    const reason = (body.reason ?? "").trim()
    if (!payrollId) return badRequest("payrollId is required.")
    if (!reason) return badRequest("A reason is required to place a HOLD.")

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      select: {
        id: true,
        state: true,
        regionId: true,
        regionalOfficeId: true,
      },
    })
    if (!payroll) return notFound("Payroll not found.")

    const scope = deriveManagerScope(session)
    if (
      managerScopeDenied(scope, {
        regionId: payroll.regionId ?? undefined,
        regionalOfficeId: payroll.regionalOfficeId ?? undefined,
      })
    ) {
      return forbidden("This payroll is outside your scope.")
    }

    if (!HOLDABLE_STATES.has(payroll.state)) {
      return conflict(
        `Cannot place HOLD on payroll in state ${payroll.state}.`
      )
    }

    const actor = getActorIdentity(session)
    const now = new Date()

    await prisma.payroll.update({
      where: { id: payrollId },
      data: {
        state: "HOLD",
        holdReason: reason,
        holdSetAt: now,
        holdSetById: actor.id,
      },
    })

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_HOLD",
      module: "PAYROLL",
      description: `HOLD placed on payroll ${payrollId} (was ${payroll.state}) — reason: ${reason}`,
    })

    return ok({ payrollId, state: "HOLD" })
  } catch (error) {
    console.error("hold failed:", error)
    return internalServerError("Failed to place HOLD on payroll.")
  }
}
