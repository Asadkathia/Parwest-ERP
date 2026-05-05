/**
 * Persistence layer for canonical payroll computation.
 *
 * - Upserts the Payroll row keyed on (guardId, month, year).
 * - Syncs PayrollDeductionEntry rows (upsert active, delete obsolete) —
 *   PayrollDeductionEntry is the single source of truth for deductions;
 *   the legacy float columns (cwf, eobi, essi, trainingSchoolFees,
 *   otherDeductions) were dropped in the deductions-policy cleanup.
 * - Honors state-machine rules for `setStateToCalculated`.
 * - Does NOT create reserve ledger entries (Agent E owns REGIONAL_LOCKED transition).
 */

import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"
import type { PayrollComputation } from "./calculate"

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

const LOCKED_STATES = new Set([
  "REGIONAL_LOCKED",
  "GLOBAL_FINALIZED",
  "PAID",
  "HOLD",
])

export async function persistGuardPayroll(
  computation: PayrollComputation,
  options: {
    trx?: Prisma.TransactionClient
    actorUserId: string | null
    setStateToCalculated?: boolean
  }
): Promise<{ payrollId: string }> {
  const db: DbClient = options.trx ?? defaultPrisma
  const setStateToCalculated = options.setStateToCalculated ?? true

  const existing = await db.payroll.findUnique({
    where: {
      guardId_month_year: {
        guardId: computation.guardId,
        month: computation.month,
        year: computation.year,
      },
    },
    select: { id: true, state: true, paymentStatus: true },
  })

  // ---- State-transition guard ------------------------------------------
  const currentState = existing?.state ?? "DRAFT"
  if (existing && LOCKED_STATES.has(currentState)) {
    throw new Error(
      `Cannot recalculate payroll in state ${currentState}. Use emergency release to override.`
    )
  }

  let nextState: string | undefined = undefined
  if (setStateToCalculated) {
    if (currentState === "EMERGENCY_RELEASED") {
      // allow recalc but do not change state
      nextState = undefined
    } else {
      // DRAFT, CALCULATED, or new row
      nextState = "CALCULATED"
    }
  }

  // ---- Build payroll fields --------------------------------------------
  // Per-code totals live in PayrollDeductionEntry; this row holds only the
  // headline aggregates (gross, net, reserve) needed for fast list queries.
  const baseFields = {
    deploymentDays: computation.deploymentDayCount,
    baseSalary: computation.basePay,
    overtimeAmount: computation.overtimePay,
    extraHoursAmount: computation.extraHoursPay,
    specialDutyAmount: computation.specialDutyPay,
    loans: computation.loanTotal,
    netSalary: computation.netPayable,
    netBeforeReserve: computation.netBeforeReserve,
    reservePct: computation.reservePct,
    reserveAmount: computation.reserveAmount,
    regionId: computation.regionId,
    regionalOfficeId: computation.regionalOfficeId,
  }

  const upserted = await db.payroll.upsert({
    where: {
      guardId_month_year: {
        guardId: computation.guardId,
        month: computation.month,
        year: computation.year,
      },
    },
    create: {
      guardId: computation.guardId,
      month: computation.month,
      year: computation.year,
      ...baseFields,
      ...(nextState ? { state: nextState } : {}),
      paymentStatus: "PENDING",
    },
    update: {
      ...baseFields,
      ...(nextState ? { state: nextState } : {}),
    },
    select: { id: true },
  })

  // ---- Sync deduction entries ------------------------------------------
  const wantedTypeIds = new Set(computation.deductionEntries.map((e) => e.deductionTypeId))

  const currentEntries = await db.payrollDeductionEntry.findMany({
    where: { payrollId: upserted.id },
    select: { id: true, deductionTypeId: true },
  })

  // Delete obsolete entries (deduction type deactivated or removed from computation)
  const toDeleteIds = currentEntries
    .filter((e) => !wantedTypeIds.has(e.deductionTypeId))
    .map((e) => e.id)
  if (toDeleteIds.length > 0) {
    await db.payrollDeductionEntry.deleteMany({
      where: { id: { in: toDeleteIds } },
    })
  }

  // Upsert each active entry. Override rows (isOverride=true) preserve their
  // override metadata across recompute; non-override rows reflect the engine's
  // latest computed amount + rate-row trace + breakdown.
  for (const entry of computation.deductionEntries) {
    const breakdownJson = entry.breakdown as unknown as
      | Prisma.InputJsonValue
      | undefined
    if (entry.isOverride) {
      // Existing override — only refresh computed/trace fields, leave amount alone.
      await db.payrollDeductionEntry.update({
        where: {
          payrollId_deductionTypeId: {
            payrollId: upserted.id,
            deductionTypeId: entry.deductionTypeId,
          },
        },
        data: {
          computedAmount: entry.computedAmount,
          rateSource: entry.rateSource,
          rateRowId: entry.rateRowId,
          breakdown: breakdownJson,
        },
      })
    } else {
      await db.payrollDeductionEntry.upsert({
        where: {
          payrollId_deductionTypeId: {
            payrollId: upserted.id,
            deductionTypeId: entry.deductionTypeId,
          },
        },
        create: {
          payrollId: upserted.id,
          deductionTypeId: entry.deductionTypeId,
          amount: entry.amount,
          computedAmount: entry.computedAmount,
          rateSource: entry.rateSource,
          rateRowId: entry.rateRowId,
          breakdown: breakdownJson,
          isOverride: false,
        },
        update: {
          amount: entry.amount,
          computedAmount: entry.computedAmount,
          rateSource: entry.rateSource,
          rateRowId: entry.rateRowId,
          breakdown: breakdownJson,
        },
      })
    }
  }

  return { payrollId: upserted.id }
}
