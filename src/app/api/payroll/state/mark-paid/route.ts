/**
 * POST /api/payroll/state/mark-paid
 *
 * Marks a Payroll row as PAID. Only valid from REGIONAL_LOCKED,
 * GLOBAL_FINALIZED, or EMERGENCY_RELEASED. Updates both `state` and the
 * legacy `paymentStatus` column for backward compatibility.
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
import { hasAction } from "@/lib/api/permissions"
import { deriveManagerScope, managerScopeDenied } from "@/lib/access/scope"
import { safeAuditLog } from "@/lib/audit/safeAuditLog"
import { getActorIdentity } from "@/lib/payroll/state-permissions"

const VALID_PAYMENT_METHODS = new Set(["BANK", "CASH", "MOBILE"])

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "CREATE")) return forbidden("Access denied.")

    const body = (await request.json().catch(() => ({}))) as {
      payrollId?: string
      paymentMethod?: string
      paymentRemarks?: string
    }
    const payrollId = body.payrollId ? String(body.payrollId) : ""
    const paymentMethod = (body.paymentMethod ?? "").toUpperCase().trim()
    const paymentRemarks = body.paymentRemarks?.toString().trim() || null

    if (!payrollId) return badRequest("payrollId is required.")
    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
      return badRequest("paymentMethod must be one of BANK, CASH, MOBILE.")
    }

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

    const actor = getActorIdentity(session)
    const now = new Date()

    // Atomic conditional update: only flip rows still in a payable state.
    // Two concurrent mark-paid calls cannot both win — the loser sees count=0
    // and we report the precise reason after a fresh lookup.
    const result = await prisma.payroll.updateMany({
      where: {
        id: payrollId,
        state: { in: ["REGIONAL_LOCKED", "GLOBAL_FINALIZED", "EMERGENCY_RELEASED"] },
      },
      data: {
        state: "PAID",
        paymentStatus: "PAID",
        paymentMethod,
        paymentRemarks,
        paymentUpdatedAt: now,
      },
    })

    if (result.count === 0) {
      const existing = await prisma.payroll.findUnique({
        where: { id: payrollId },
        select: { state: true },
      })
      if (!existing) return notFound("Payroll not found.")
      if (existing.state === "PAID") {
        return conflict("Payroll is already marked as PAID.")
      }
      return conflict(
        `Cannot mark PAID from state ${existing.state}; require REGIONAL_LOCKED, GLOBAL_FINALIZED, or EMERGENCY_RELEASED.`
      )
    }

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_MARK_PAID",
      module: "PAYROLL",
      description: `Marked payroll ${payrollId} as PAID via ${paymentMethod} (was ${payroll.state})`,
    })

    return ok({ payrollId, state: "PAID", paymentMethod })
  } catch (error) {
    console.error("mark-paid failed:", error)
    return internalServerError("Failed to mark payroll as PAID.")
  }
}
