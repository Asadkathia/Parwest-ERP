/**
 * POST /api/payroll/state/emergency-release
 *
 * SuperAdmin override that sets a Payroll row to EMERGENCY_RELEASED, allowing
 * recalculation/edits even if the row was previously locked. Lock timestamps
 * are preserved for audit; the persist layer treats EMERGENCY_RELEASED as
 * editable.
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
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { getActorIdentity, isSuperAdmin } from "@/lib/payroll/state-permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasModuleAccess(session, "PAYROLL")) return forbidden("Access denied.")
    if (!isSuperAdmin(session)) {
      return forbidden("Only SuperAdmin can perform an emergency release.")
    }

    const body = (await request.json().catch(() => ({}))) as {
      payrollId?: string
      reason?: string
    }
    const payrollId = body.payrollId ? String(body.payrollId) : ""
    const reason = (body.reason ?? "").trim()
    if (!payrollId) return badRequest("payrollId is required.")
    if (!reason) return badRequest("A reason is required for emergency release.")

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      select: { id: true, state: true },
    })
    if (!payroll) return notFound("Payroll not found.")
    if (payroll.state === "PAID") {
      return conflict("Cannot emergency-release a PAID payroll.")
    }

    const actor = getActorIdentity(session)
    const now = new Date()

    await prisma.payroll.update({
      where: { id: payrollId },
      data: {
        state: "EMERGENCY_RELEASED",
        emergencyReleasedAt: now,
        emergencyReleasedById: actor.id,
        emergencyReleaseReason: reason,
      },
    })

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_EMERGENCY_RELEASE",
      module: "PAYROLL",
      description: `Emergency release on payroll ${payrollId} (was ${payroll.state}) — reason: ${reason}`,
    })

    return ok({ payrollId, state: "EMERGENCY_RELEASED" })
  } catch (error) {
    console.error("emergency-release failed:", error)
    return internalServerError("Failed to emergency-release payroll.")
  }
}
