/**
 * Resignation → Uniform recovery hook.
 *
 * When a guard transitions to TERMINATED with reason=RESIGNED:
 *   1. Stamp `Guard.resignedOn` (caller passes the date — defaults to now).
 *   2. Compute months served from `joiningDate`.
 *   3. Look up the matching `UniformResignationTier` (ACTIVE row whose
 *      `[minMonths, maxMonths)` window contains monthsServed).
 *   4. Insert (or upsert by (guardId, payrollMonth)) a
 *      `UniformResignationRecovery` row to be applied on the resignation
 *      month's payroll.
 *
 * Idempotent: re-calling for the same guard/month is a no-op.
 *
 * Gated by `deductions.uniformResignationRecovery` workflow rule.
 */

import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  // Subtract 1 if `to`'s day is before `from`'s day (partial month).
  if (to.getUTCDate() < from.getUTCDate()) return Math.max(0, months - 1)
  return Math.max(0, months)
}

export type ResignationHookResult =
  | { applied: false; reason: string }
  | {
      applied: true
      monthsServed: number
      tierId: string
      amount: number
      payrollMonth: Date
      recoveryId: string
    }

export async function applyResignationRecovery(
  db: DbClient,
  args: { guardId: string; resignedOn?: Date }
): Promise<ResignationHookResult> {
  const resignedOn = args.resignedOn ?? new Date()

  // Always stamp Guard.resignedOn (also used elsewhere as the source-of-truth date)
  await db.guard.update({
    where: { id: args.guardId },
    data: { resignedOn },
  })

  if (!isWorkflowRuleEnabled("deductions.uniformResignationRecovery")) {
    return { applied: false, reason: "workflow rule disabled" }
  }

  const guard = await db.guard.findUnique({
    where: { id: args.guardId },
    select: { joiningDate: true },
  })
  if (!guard?.joiningDate) {
    return { applied: false, reason: "guard has no joiningDate" }
  }
  const monthsServed = monthsBetween(guard.joiningDate, resignedOn)

  // Find the active tier that contains monthsServed
  const tiers = await db.uniformResignationTier.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, minMonths: true, maxMonths: true, amount: true, effectiveFrom: true, effectiveTo: true },
  })
  const ms = resignedOn.getTime()
  const tier = tiers.find(
    (t) =>
      monthsServed >= t.minMonths &&
      monthsServed < t.maxMonths &&
      t.effectiveFrom.getTime() <= ms &&
      (t.effectiveTo === null || t.effectiveTo.getTime() > ms)
  )
  if (!tier) {
    return { applied: false, reason: `no tier covers ${monthsServed} months` }
  }
  if (tier.amount <= 0) {
    return { applied: false, reason: "matching tier amount is zero" }
  }

  const payrollMonth = firstOfMonthUTC(resignedOn)
  const recovery = await db.uniformResignationRecovery.upsert({
    where: { guardId_payrollMonth: { guardId: args.guardId, payrollMonth } },
    create: {
      guardId: args.guardId,
      resignedOn,
      monthsServed,
      tierId: tier.id,
      amount: tier.amount,
      payrollMonth,
      status: "PENDING",
    },
    update: {
      resignedOn,
      monthsServed,
      tierId: tier.id,
      amount: tier.amount,
    },
  })

  return {
    applied: true,
    monthsServed,
    tierId: tier.id,
    amount: tier.amount,
    payrollMonth,
    recoveryId: recovery.id,
  }
}
