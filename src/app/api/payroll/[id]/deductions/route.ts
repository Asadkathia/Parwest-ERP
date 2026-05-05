/**
 * GET /api/payroll/[id]/deductions
 *
 * Returns the canonical deduction entries for a payroll with the rate-row
 * trace, breakdown JSON, and override metadata. Sorted by deduction type
 * sortOrder so the UI can render in policy order.
 */

import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  forbidden,
  internalServerError,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api/response"
import { hasAction } from "@/lib/api/permissions"

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = (await auth()) as Session | null
    if (!session) return unauthorized()
    if (!hasAction(session, "PAYROLL", "VIEW")) return forbidden("Access denied")
    const { id } = await ctx.params

    const payroll = await prisma.payroll.findUnique({
      where: { id },
      select: {
        id: true,
        guardId: true,
        month: true,
        year: true,
        state: true,
      },
    })
    if (!payroll) return notFound("Payroll not found")

    const entries = await prisma.payrollDeductionEntry.findMany({
      where: { payrollId: id },
      include: {
        deductionType: {
          select: {
            id: true,
            code: true,
            name: true,
            isPolicyManaged: true,
            rateSource: true,
            sortOrder: true,
          },
        },
      },
    })

    entries.sort(
      (a, b) =>
        (a.deductionType.sortOrder ?? 0) - (b.deductionType.sortOrder ?? 0)
    )

    return ok({
      payroll,
      entries: entries.map((e) => ({
        id: e.id,
        deductionTypeId: e.deductionTypeId,
        code: e.deductionType.code,
        name: e.deductionType.name,
        isPolicyManaged: e.deductionType.isPolicyManaged,
        rateSource: e.rateSource ?? e.deductionType.rateSource,
        rateRowId: e.rateRowId,
        amount: Number(e.amount),
        computedAmount: e.computedAmount === null ? null : Number(e.computedAmount),
        breakdown: e.breakdown,
        isOverride: e.isOverride,
        overrideById: e.overrideById,
        overrideByName: e.overrideByName,
        overrideReason: e.overrideReason,
        overrideAt: e.overrideAt,
        notes: e.notes,
      })),
    })
  } catch (err) {
    console.error("[payroll/[id]/deductions GET]", err)
    return internalServerError("Failed to load deduction entries")
  }
}
