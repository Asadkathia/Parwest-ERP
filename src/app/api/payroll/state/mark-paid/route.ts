/**
 * POST /api/payroll/state/mark-paid
 *
 * Marks a Payroll row as PAID. Only valid from REGIONAL_LOCKED,
 * GLOBAL_FINALIZED, or EMERGENCY_RELEASED. Updates both `state` and the
 * legacy `paymentStatus` column for backward compatibility.
 *
 * Terminal-status stamping (audit Top #2):
 *   After the payroll flips to PAID, source-row ledgers funded by the
 *   payroll (UniformInstallment, UniformResignationRecovery,
 *   AdvanceSalaryRecovery, NightCallDeduction, TrainingSchoolFeeInstallment)
 *   are stamped to their terminal DEDUCTED status inside the same tx via
 *   `markDeductionsConsumed`. This unsticks the dead-PENDING lifecycle
 *   for paid months. Carry-forward for skipped months is intentionally
 *   deferred (see TODO(carry-forward) in mark-consumed.ts).
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
import { markDeductionsConsumed } from "@/lib/deductions/mark-consumed"

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

    // Atomic conditional update + terminal-status stamping in a single tx.
    // Two concurrent mark-paid calls cannot both win — the loser sees
    // count=0 inside the tx and we report the precise reason after a fresh
    // lookup. The stamp step runs only when the flip succeeded so a
    // rollback of either step rolls back the whole transition.
    const txResult = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.payroll.updateMany({
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

      if (updateResult.count === 0) {
        return { flipped: false as const, stamped: null }
      }

      // Stamp contributing source-row ledgers (UniformInstallment, etc.) to
      // their terminal DEDUCTED status. Idempotent on its own (filters
      // status="PENDING") and tx-scoped — sharing this $transaction means a
      // failure in either the state flip or the stamp rolls back the whole
      // mark-paid operation.
      const stamped = await markDeductionsConsumed(tx, { payrollIds: [payrollId] })
      return { flipped: true as const, stamped }
    })

    if (!txResult.flipped) {
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

    const stamped = txResult.stamped
    const stampSummary = stamped
      ? `uniformInstallments=${stamped.uniformInstallments},uniformResignations=${stamped.uniformResignationRecoveries},advance=${stamped.advanceSalaryRecoveries},nightCall=${stamped.nightCallDeductions},training=${stamped.trainingSchoolFeeInstallments}`
      : "none"

    await safeAuditLog({
      userId: actor.id,
      event: "PAYROLL_MARK_PAID",
      module: "PAYROLL",
      description: `Marked payroll ${payrollId} as PAID via ${paymentMethod} (was ${payroll.state}); stamped source rows: ${stampSummary}`,
    })

    return ok({ payrollId, state: "PAID", paymentMethod, stamped })
  } catch (error) {
    console.error("mark-paid failed:", error)
    return internalServerError("Failed to mark payroll as PAID.")
  }
}
