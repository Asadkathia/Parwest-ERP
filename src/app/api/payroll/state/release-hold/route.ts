/**
 * POST /api/payroll/state/release-hold
 *
 * Releases a HOLD on a single Payroll row. Only the user who placed the HOLD
 * (or a SuperAdmin) may release it. The row is returned to its previous
 * resting state — REGIONAL_LOCKED if it had been regionally locked, otherwise
 * CALCULATED.
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
import { getActorIdentity, isSuperAdmin } from "@/lib/payroll/state-permissions"

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

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      select: {
        id: true,
        state: true,
        regionId: true,
        regionalOfficeId: true,
        holdSetById: true,
        regionalLockedAt: true,
      },
    })
    if (!payroll) return notFound("Payroll not found.")
    if (payroll.state !== "HOLD") {
      return conflict("Payroll is not currently on HOLD.")
    }

    const scope = deriveManagerScope(session)
    if (
      managerScopeDenied(scope, {
        regionId: payroll.regionId ?? undefined,
        regionalOfficeId: payroll.regionalOfficeId ?? undefined,
      })
    ) {
      return forbidden("This payroll is outside your scope.")
    }

    const actor = getActorIdentity(session)
    const isPlacer = payroll.holdSetById && payroll.holdSetById === actor.id
    if (!isPlacer && !isSuperAdmin(session)) {
      return forbidden(
        "Only the user who placed the HOLD or a SuperAdmin can release it."
      )
    }

    const target = payroll.regionalLockedAt ? "REGIONAL_LOCKED" : "CALCULATED"

    await prisma.payroll.update({
      where: { id: payrollId },
      data: {
        state: target,
        holdReason: null,
        holdSetAt: null,
        holdSetById: null,
      },
    })

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_RELEASE_HOLD",
      module: "PAYROLL",
      description: `Released HOLD on payroll ${payrollId} → ${target}${
        reason ? ` — reason: ${reason}` : ""
      }`,
    })

    return ok({ payrollId, state: target })
  } catch (error) {
    console.error("release-hold failed:", error)
    return internalServerError("Failed to release HOLD.")
  }
}
