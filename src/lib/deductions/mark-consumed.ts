/**
 * markDeductionsConsumed — terminal-status stamping for source rows
 * funded by a just-PAID payroll.
 *
 * Why this exists (audit Top #2 — "Installment/recovery rows never leave
 * PENDING"): resolvers filter source rows on `status:"PENDING"`, but no
 * code path ever flips them to a terminal status. When a payroll moves
 * to PAID, the contributing source rows must be marked consumed, otherwise
 * audit/reconciliation reading "PENDING = owed" overstates liabilities
 * forever and there is no "completion" signal for installment plans.
 *
 * What this does:
 *   For each just-PAID payroll, read its PayrollDeductionEntry rows, walk
 *   each entry's `breakdown` ids per source table, and flip the matching
 *   source rows to the terminal status defined on each model:
 *
 *     UniformInstallment.status:           PENDING | DEDUCTED | SKIPPED | CANCELLED
 *     UniformResignationRecovery.status:   PENDING | DEDUCTED | CANCELLED
 *     AdvanceSalaryRecovery.status:        PENDING | DEDUCTED | SKIPPED | CANCELLED
 *     NightCallDeduction.status:           PENDING | DEDUCTED | CANCELLED
 *     TrainingSchoolFeeInstallment.status: PENDING | DEDUCTED | SKIPPED | CANCELLED
 *
 *   The terminal "consumed by payroll" value is DEDUCTED on every table.
 *   The task spec named the value `PAID` per the enum — that's an alias
 *   for the canonical consumed state; the actual string value defined on
 *   each Prisma model is DEDUCTED (see prisma/schema.prisma:2607, 2627,
 *   2665, 2700, 2796).
 *
 * Idempotency:
 *   The where-clause restricts updates to rows still in PENDING. Re-running
 *   the function for the same payrolls is a no-op (already-DEDUCTED rows
 *   are not re-touched).
 *
 * Transaction scope:
 *   Must be called inside the SAME `tx` that flipped the payroll(s) to PAID
 *   so a rollback of the state transition also rolls back the stamps.
 *
 * Lifecycle gap NOT addressed here:
 *   Carry-forward for *skipped* months (guard had no payroll in the
 *   scheduled month so the PENDING row is silently dropped forever) is a
 *   deeper design decision than terminal-stamping for paid months and is
 *   intentionally left to a follow-up.
 *
 *   // TODO(carry-forward): handle PENDING source rows whose scheduled
 *   // `payrollMonth` has passed without a payroll being run for that
 *   // guard/month. Options: (a) re-target the row to the next month a
 *   // payroll runs, (b) mark SKIPPED + emit a missed-installment warning,
 *   // (c) explicit operator action via a "carry-forward" UI. Each has
 *   // different audit semantics — pick once the policy is decided.
 */

import type { Prisma } from "@prisma/client"

const TERMINAL_STATUS = "DEDUCTED"

type DeductionBreakdownItem = Record<string, unknown>

export interface MarkConsumedInput {
  payrollIds: string[]
}

export interface MarkConsumedResult {
  uniformInstallments: number
  uniformResignationRecoveries: number
  advanceSalaryRecoveries: number
  nightCallDeductions: number
  trainingSchoolFeeInstallments: number
}

function asArray(value: Prisma.JsonValue | null | undefined): DeductionBreakdownItem[] {
  if (!Array.isArray(value)) return []
  const out: DeductionBreakdownItem[] = []
  for (const v of value) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(v as DeductionBreakdownItem)
    }
  }
  return out
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

interface PerPayrollBuckets {
  uniformInstallmentIds: Set<string>
  uniformRecoveryIds: Set<string>
  advanceRecoveryIds: Set<string>
  nightCallIds: Set<string>
  trainingInstallmentIds: Set<string>
}

function emptyBuckets(): PerPayrollBuckets {
  return {
    uniformInstallmentIds: new Set(),
    uniformRecoveryIds: new Set(),
    advanceRecoveryIds: new Set(),
    nightCallIds: new Set(),
    trainingInstallmentIds: new Set(),
  }
}

/**
 * Stamp source rows funded by the supplied PAID payroll(s) to DEDUCTED
 * and link them back to the funding payroll via `payrollId`/`appliedAt`.
 * Idempotent: replays touch zero rows (filter `status: "PENDING"`).
 */
export async function markDeductionsConsumed(
  tx: Prisma.TransactionClient,
  input: MarkConsumedInput
): Promise<MarkConsumedResult> {
  const result: MarkConsumedResult = {
    uniformInstallments: 0,
    uniformResignationRecoveries: 0,
    advanceSalaryRecoveries: 0,
    nightCallDeductions: 0,
    trainingSchoolFeeInstallments: 0,
  }

  if (input.payrollIds.length === 0) return result

  const entries = await tx.payrollDeductionEntry.findMany({
    where: { payrollId: { in: input.payrollIds } },
    select: {
      payrollId: true,
      breakdown: true,
      deductionType: { select: { code: true } },
    },
  })

  // Bucket source ids per *funding* payroll so we can stamp `payrollId`
  // correctly on each source row (a single batch may mix payrolls).
  // Breakdown shapes are defined by resolvers (lib/deductions/resolvers.ts):
  //   UNIFORM:               { type:"INSTALLMENT", installmentId, ... }
  //                          { type:"RESIGNATION_RECOVERY", recoveryId, ... }
  //   TRAINING_SCHOOL_FEES:  { installmentId, issuanceId, amount }
  //   ADVANCE_SALARY:        { recoveryId, advanceSalaryId, amount }
  //   NIGHT_CALL:            { deductionId, date, type, ... }
  const perPayroll = new Map<string, PerPayrollBuckets>()
  const bucketsFor = (pid: string): PerPayrollBuckets => {
    let b = perPayroll.get(pid)
    if (!b) {
      b = emptyBuckets()
      perPayroll.set(pid, b)
    }
    return b
  }

  for (const e of entries) {
    const code = e.deductionType?.code
    const lines = asArray(e.breakdown)
    if (!code || lines.length === 0) continue
    const b = bucketsFor(e.payrollId)

    switch (code) {
      case "UNIFORM":
        for (const line of lines) {
          const type = line.type
          if (type === "INSTALLMENT") {
            const id = strOrNull(line.installmentId)
            if (id) b.uniformInstallmentIds.add(id)
          } else if (type === "RESIGNATION_RECOVERY") {
            const id = strOrNull(line.recoveryId)
            if (id) b.uniformRecoveryIds.add(id)
          }
        }
        break
      case "TRAINING_SCHOOL_FEES":
        for (const line of lines) {
          const id = strOrNull(line.installmentId)
          if (id) b.trainingInstallmentIds.add(id)
        }
        break
      case "ADVANCE_SALARY":
        for (const line of lines) {
          const id = strOrNull(line.recoveryId)
          if (id) b.advanceRecoveryIds.add(id)
        }
        break
      case "NIGHT_CALL":
        for (const line of lines) {
          const id = strOrNull(line.deductionId)
          if (id) b.nightCallIds.add(id)
        }
        break
      default:
        // Other codes (APSAA, CWF, EOBI, ESSI, ABSENT, OTHER, ...) do not
        // own per-row source ledgers that require stamping.
        break
    }
  }

  const stampedAt = new Date()

  for (const [payrollId, b] of perPayroll) {
    if (b.uniformInstallmentIds.size > 0) {
      const res = await tx.uniformInstallment.updateMany({
        where: { id: { in: [...b.uniformInstallmentIds] }, status: "PENDING" },
        data: { status: TERMINAL_STATUS, appliedAt: stampedAt, payrollId },
      })
      result.uniformInstallments += res.count
    }
    if (b.uniformRecoveryIds.size > 0) {
      const res = await tx.uniformResignationRecovery.updateMany({
        where: { id: { in: [...b.uniformRecoveryIds] }, status: "PENDING" },
        data: { status: TERMINAL_STATUS, appliedAt: stampedAt, payrollId },
      })
      result.uniformResignationRecoveries += res.count
    }
    if (b.advanceRecoveryIds.size > 0) {
      const res = await tx.advanceSalaryRecovery.updateMany({
        where: { id: { in: [...b.advanceRecoveryIds] }, status: "PENDING" },
        data: { status: TERMINAL_STATUS, appliedAt: stampedAt, payrollId },
      })
      result.advanceSalaryRecoveries += res.count
    }
    if (b.nightCallIds.size > 0) {
      const res = await tx.nightCallDeduction.updateMany({
        where: { id: { in: [...b.nightCallIds] }, status: "PENDING" },
        data: { status: TERMINAL_STATUS, appliedAt: stampedAt, payrollId },
      })
      result.nightCallDeductions += res.count
    }
    if (b.trainingInstallmentIds.size > 0) {
      const res = await tx.trainingSchoolFeeInstallment.updateMany({
        where: { id: { in: [...b.trainingInstallmentIds] }, status: "PENDING" },
        data: { status: TERMINAL_STATUS, appliedAt: stampedAt, payrollId },
      })
      result.trainingSchoolFeeInstallments += res.count
    }
  }

  return result
}
