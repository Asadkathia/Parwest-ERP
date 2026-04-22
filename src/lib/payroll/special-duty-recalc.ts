/**
 * Helpers for triggering payroll recalc after a PayrollSpecialDuty mutation.
 *
 * Locked-payroll months are surfaced as warning strings instead of throwing —
 * the source PayrollSpecialDuty mutation succeeded, only the downstream Payroll
 * recalc was skipped.
 */

import { prisma } from "@/lib/db"
import { calculateGuardPayroll } from "@/lib/payroll/calculate"
import { persistGuardPayroll } from "@/lib/payroll/persist"

const LOCK_MESSAGE_FRAGMENT = "Cannot recalculate payroll"

/**
 * Returns distinct UTC month-start dates that overlap a date range.
 */
export function affectedMonthStarts(from: Date, to: Date): Date[] {
  const lo = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  const hi = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
  const months: Date[] = []
  const cursor = new Date(lo.getTime())
  while (cursor.getTime() <= hi.getTime()) {
    months.push(new Date(cursor.getTime()))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

export async function recalcAffectedMonths(
  guardId: string,
  months: Date[],
  actorUserId: string | null
): Promise<string[]> {
  const warnings: string[] = []
  for (const month of months) {
    try {
      await prisma.$transaction(async (tx) => {
        const computation = await calculateGuardPayroll(guardId, month, { trx: tx })
        await persistGuardPayroll(computation, {
          trx: tx,
          actorUserId,
          setStateToCalculated: true,
        })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes(LOCK_MESSAGE_FRAGMENT)) {
        const monthLabel = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`
        warnings.push(`Payroll for month ${monthLabel} is locked; recalc skipped.`)
      } else {
        throw err
      }
    }
  }
  return warnings
}
