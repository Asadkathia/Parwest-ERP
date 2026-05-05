/**
 * Per-payroll deduction-line override.
 *
 *   PATCH /api/payroll/[id]/deductions/[typeId]/override
 *     body: { amount: number, reason: string }
 *     → sets isOverride=true; preserves rate-row trace and original
 *       computedAmount in PayrollDeductionEntry.
 *
 *   DELETE /api/payroll/[id]/deductions/[typeId]/override
 *     → clears override; next recompute restores the computed amount.
 *
 * Gates:
 *   - PAYROLL:DEDUCTION_OVERRIDE permission.
 *   - Workflow rule `deductions.allowOverrideOnFinalized` — when off,
 *     rejects override on payrolls in REGIONAL_LOCKED / GLOBAL_FINALIZED /
 *     PAID / HOLD states (operator must unfinalize first).
 *   - Recompute is the engine's job; this endpoint only persists the override
 *     metadata + amount on the existing entry.
 */

import { NextRequest } from "next/server"
import type { Session } from "next-auth"
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
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

const FINALIZED_STATES = new Set([
  "REGIONAL_LOCKED",
  "GLOBAL_FINALIZED",
  "PAID",
  "HOLD",
])

async function loadEntry(payrollId: string, typeId: string) {
  return prisma.payrollDeductionEntry.findUnique({
    where: {
      payrollId_deductionTypeId: { payrollId, deductionTypeId: typeId },
    },
  })
}

async function loadPayrollState(payrollId: string) {
  return prisma.payroll.findUnique({
    where: { id: payrollId },
    select: { id: true, state: true },
  })
}

function actor(session: Session | null | undefined) {
  const u = (session?.user ?? {}) as { id?: string; name?: string | null }
  return { id: u.id ?? null, name: u.name ?? null }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; typeId: string }> }
) {
  try {
    const session = (await auth()) as Session | null
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "DEDUCTION_OVERRIDE")) {
      return forbidden("Access denied")
    }
    const { id: payrollId, typeId } = await ctx.params

    const body = (await request.json()) as Record<string, unknown>
    const amount = typeof body.amount === "number" ? body.amount : null
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""
    if (amount === null || amount < 0) return badRequest("amount must be a non-negative number")
    if (!reason) return badRequest("reason required")

    const payroll = await loadPayrollState(payrollId)
    if (!payroll) return notFound("Payroll not found")
    if (
      FINALIZED_STATES.has(payroll.state) &&
      !isWorkflowRuleEnabled("deductions.allowOverrideOnFinalized")
    ) {
      return conflict(
        `Payroll is ${payroll.state}. Unfinalize before overriding deduction lines, or enable the workflow rule.`
      )
    }

    const entry = await loadEntry(payrollId, typeId)
    if (!entry) return notFound("Deduction entry not found on this payroll")

    const a = actor(session)
    const updated = await prisma.payrollDeductionEntry.update({
      where: { id: entry.id },
      data: {
        amount,
        isOverride: true,
        overrideById: a.id,
        overrideByName: a.name,
        overrideReason: reason,
        overrideAt: new Date(),
        // Keep computedAmount / rateRowId / breakdown / rateSource intact.
      },
    })
    return ok(updated)
  } catch (err) {
    console.error("[deduction override PATCH]", err)
    return internalServerError("Failed to override deduction")
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; typeId: string }> }
) {
  try {
    const session = (await auth()) as Session | null
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "DEDUCTION_OVERRIDE")) {
      return forbidden("Access denied")
    }
    const { id: payrollId, typeId } = await ctx.params

    const payroll = await loadPayrollState(payrollId)
    if (!payroll) return notFound("Payroll not found")
    if (
      FINALIZED_STATES.has(payroll.state) &&
      !isWorkflowRuleEnabled("deductions.allowOverrideOnFinalized")
    ) {
      return conflict(
        `Payroll is ${payroll.state}. Unfinalize before clearing the override.`
      )
    }

    const entry = await loadEntry(payrollId, typeId)
    if (!entry) return notFound("Deduction entry not found on this payroll")
    if (!entry.isOverride) return ok(entry) // no-op

    // Restore the engine's computedAmount as the applied amount; clear override metadata.
    const restored = await prisma.payrollDeductionEntry.update({
      where: { id: entry.id },
      data: {
        amount: entry.computedAmount ?? 0,
        isOverride: false,
        overrideById: null,
        overrideByName: null,
        overrideReason: null,
        overrideAt: null,
      },
    })
    return ok(restored)
  } catch (err) {
    console.error("[deduction override DELETE]", err)
    return internalServerError("Failed to clear override")
  }
}
