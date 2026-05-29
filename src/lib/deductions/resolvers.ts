/**
 * Per-canonical-code deduction resolvers.
 *
 * Each resolver:
 *  - Reads from canonical, effective-dated rate / ledger tables.
 *  - Returns `ResolvedDeduction` with amount, rate-row trace, and breakdown.
 *  - Emits typed warnings instead of falling back to hardcoded constants
 *    (per CLAUDE.md "no hardcoded data fallbacks").
 *
 * Each resolver is gated by a workflow rule from src/lib/workflows/policy.ts.
 * If the rule is disabled, the resolver returns a zero entry with a note —
 * the deduction line still appears on the slip (for transparency) but does
 * not subtract from net.
 */

import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"
import { isWorkflowRuleEnabled } from "@/lib/workflows/policy"
import {
  resolveApsaaBranchRate,
  resolveApsaaPunjabRate,
  resolveCwfRegionRate,
  resolveEobiRate,
  resolveEssiRate,
  resolveNightCallRule,
} from "./resolveRate"
import type {
  DeductionBreakdownLine,
  ResolvedDeduction,
  ResolverContext,
} from "./types"

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Number(n.toFixed(2))
}

function zero(
  code: string,
  rateSource: ResolvedDeduction["rateSource"],
  warning?: string
): ResolvedDeduction {
  return {
    code,
    rateSource,
    computedAmount: 0,
    rateRowId: null,
    breakdown: [],
    warnings: warning ? [warning] : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APSAA — sum of branch rates weighted by days deployed at each branch
// ─────────────────────────────────────────────────────────────────────────────
//
// rateSource label note: emitted as "BRANCH_RATE" (not "CLIENT_BRANCH_RATE").
// The data comes from the dedicated `ApsaaBranchRate` table — a guard-payroll
// deduction table scoped by branchId — NOT from client invoicing. The old
// "CLIENT_BRANCH_RATE" label falsely implied an invoicing source.
//
// TODO(out-of-lane): the legacy "CLIENT_BRANCH_RATE" string still appears in
//   - `src/lib/deductions/types.ts` (RATE_SOURCES const union)
//   - `prisma/schema.prisma` (column-doc comment listing valid values)
//   - `prisma/migrations/20260506100000_deductions_policy/migration.sql`
//     (seeded `PayrollDeductionType.rateSource` for APSAA + APSAA_PUNJAB)
// Aligning those requires a coordinated migration (data backfill of existing
// PayrollDeductionEntry/Type rows) and a types.ts edit — out of this lane.
// `ResolvedDeduction.rateSource` accepts `RateSource | string`, so emitting
// the new label here is type-safe and the runtime value just becomes the new
// label on entries written from this point on.
export async function resolveApsaa(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.applyApsaaBranchRate")) {
    return zero("APSAA", "BRANCH_RATE", "APSAA auto-apply disabled by workflow rule")
  }

  const breakdown: DeductionBreakdownLine[] = []
  const warnings: string[] = []
  let total = 0
  let firstRateRowId: string | null = null

  for (const [branchId, info] of ctx.branchWeights) {
    const lookup = await resolveApsaaBranchRate(db, branchId, ctx.monthStart)
    if (!lookup) {
      warnings.push(
        `MISSING_RATE: no active APSAA rate for branch ${info.branchName} (${branchId}) in ${ctx.monthStart
          .toISOString()
          .slice(0, 7)}`
      )
      breakdown.push({ branchId, branchName: info.branchName, days: info.days, rate: 0, subTotal: 0, missingRate: true })
      continue
    }
    if (firstRateRowId === null) firstRateRowId = lookup.rateRowId
    // Treat APSAA rate as a flat per-month-per-branch deduction.
    // (If days-weighted, change to: lookup.amount * (info.days / deploymentDayCount))
    const subTotal = lookup.amount
    total += subTotal
    breakdown.push({
      branchId,
      branchName: info.branchName,
      days: info.days,
      rate: lookup.amount,
      rateRowId: lookup.rateRowId,
      subTotal,
    })
  }

  return {
    code: "APSAA",
    rateSource: "BRANCH_RATE",
    computedAmount: round2(total),
    rateRowId: firstRateRowId,
    breakdown,
    warnings,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CWF — flat region rate
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveCwf(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.applyCwfRegionRate")) {
    return zero("CWF", "REGION_RATE", "CWF auto-apply disabled by workflow rule")
  }
  if (!ctx.guardRegionId) {
    return zero("CWF", "REGION_RATE", "MISSING_RATE: guard has no region for CWF lookup")
  }
  const lookup = await resolveCwfRegionRate(db, ctx.guardRegionId, ctx.monthStart)
  if (!lookup) {
    return zero(
      "CWF",
      "REGION_RATE",
      `MISSING_RATE: no active CWF rate for region ${ctx.guardRegionId} in ${ctx.monthStart
        .toISOString()
        .slice(0, 7)}`
    )
  }
  return {
    code: "CWF",
    rateSource: "REGION_RATE",
    computedAmount: round2(lookup.amount),
    rateRowId: lookup.rateRowId,
    breakdown: [
      { regionId: ctx.guardRegionId, rate: lookup.amount, rateRowId: lookup.rateRowId },
    ],
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APSAA Punjab — flat global rate, applied only if any deployment branch in Punjab
// ─────────────────────────────────────────────────────────────────────────────
// rateSource label: "BRANCH_RATE" — same reasoning as resolveApsaa above.
// See the TODO comment on resolveApsaa for the out-of-lane label cleanup.
export async function resolveApsaaPunjab(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.applyApsaaPunjabOnEnrollment")) {
    return zero("APSAA_PUNJAB", "BRANCH_RATE", "APSAA Punjab disabled by workflow rule")
  }
  if (!ctx.deployedInPunjab) {
    return zero("APSAA_PUNJAB", "BRANCH_RATE")
  }
  const lookup = await resolveApsaaPunjabRate(db, ctx.monthStart)
  if (!lookup) {
    return zero(
      "APSAA_PUNJAB",
      "BRANCH_RATE",
      `MISSING_RATE: no active APSAA Punjab rate in ${ctx.monthStart.toISOString().slice(0, 7)}`
    )
  }
  return {
    code: "APSAA_PUNJAB",
    rateSource: "BRANCH_RATE",
    computedAmount: round2(lookup.amount),
    rateRowId: lookup.rateRowId,
    breakdown: [{ scope: "PUNJAB", rate: lookup.amount, rateRowId: lookup.rateRowId }],
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EOBI — only if guard is enrolled
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveEobi(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.eobiAutoDeduct")) {
    return zero("EOBI", "EOBI_RATE", "EOBI auto-deduct disabled by workflow rule")
  }
  const enrollment = await db.eobiEnrollment.findUnique({
    where: { guardId: ctx.guardId },
    select: { isActive: true, eobiNumber: true },
  })
  if (!enrollment || !enrollment.isActive) {
    return zero("EOBI", "EOBI_RATE")
  }
  const lookup = await resolveEobiRate(db, ctx.monthStart)
  if (!lookup) {
    return zero(
      "EOBI",
      "EOBI_RATE",
      `MISSING_RATE: no active EOBI rate in ${ctx.monthStart.toISOString().slice(0, 7)}`
    )
  }
  return {
    code: "EOBI",
    rateSource: "EOBI_RATE",
    computedAmount: round2(lookup.amount),
    rateRowId: lookup.rateRowId,
    breakdown: [
      {
        eobiNumber: enrollment.eobiNumber ?? null,
        rate: lookup.amount,
        rateRowId: lookup.rateRowId,
      },
    ],
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESSI — provincial parallel to EOBI; only if guard is enrolled
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveEssi(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.essiAutoDeduct")) {
    return zero("ESSI", "EOBI_RATE", "ESSI auto-deduct disabled by workflow rule")
  }
  const enrollment = await db.essiEnrollment.findUnique({
    where: { guardId: ctx.guardId },
    select: { isActive: true, essiNumber: true },
  })
  if (!enrollment || !enrollment.isActive) {
    return zero("ESSI", "EOBI_RATE")
  }
  const lookup = await resolveEssiRate(db, ctx.monthStart)
  if (!lookup) {
    return zero(
      "ESSI",
      "EOBI_RATE",
      `MISSING_RATE: no active ESSI rate in ${ctx.monthStart.toISOString().slice(0, 7)}`
    )
  }
  return {
    code: "ESSI",
    rateSource: "EOBI_RATE",
    computedAmount: round2(lookup.amount),
    rateRowId: lookup.rateRowId,
    breakdown: [
      {
        essiNumber: enrollment.essiNumber ?? null,
        rate: lookup.amount,
        rateRowId: lookup.rateRowId,
      },
    ],
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING_SCHOOL_FEES — pending tuition installments for this month
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveTrainingSchoolFees(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.trainingSchoolFeesAutoInstallments")) {
    return zero(
      "TRAINING_SCHOOL_FEES",
      "INSTALLMENT_PLAN",
      "Training school fees disabled by workflow rule"
    )
  }
  const installments = await db.trainingSchoolFeeInstallment.findMany({
    where: {
      guardId: ctx.guardId,
      payrollMonth: ctx.monthStart,
      status: "PENDING",
    },
    select: { id: true, issuanceId: true, amount: true },
  })
  const total = installments.reduce((s, i) => s + Number(i.amount), 0)
  return {
    code: "TRAINING_SCHOOL_FEES",
    rateSource: "INSTALLMENT_PLAN",
    computedAmount: round2(total),
    rateRowId: null,
    breakdown: installments.map((i) => ({
      installmentId: i.id,
      issuanceId: i.issuanceId,
      amount: Number(i.amount),
    })),
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFORM — pending installments + tenure-tier resignation recovery for this month
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveUniform(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.uniformAutoInstallments")) {
    return zero("UNIFORM", "INSTALLMENT_PLAN", "Uniform installments disabled by workflow rule")
  }

  const installments = await db.uniformInstallment.findMany({
    where: {
      guardId: ctx.guardId,
      payrollMonth: ctx.monthStart,
      status: "PENDING",
    },
    select: { id: true, uniformIssuanceId: true, amount: true },
  })

  const breakdown: DeductionBreakdownLine[] = installments.map((i) => ({
    type: "INSTALLMENT",
    installmentId: i.id,
    issuanceId: i.uniformIssuanceId,
    amount: Number(i.amount),
  }))
  let total = installments.reduce((s, i) => s + Number(i.amount), 0)

  if (isWorkflowRuleEnabled("deductions.uniformResignationRecovery")) {
    const recoveries = await db.uniformResignationRecovery.findMany({
      where: {
        guardId: ctx.guardId,
        payrollMonth: ctx.monthStart,
        status: "PENDING",
      },
      select: { id: true, monthsServed: true, amount: true, tierId: true },
    })
    for (const r of recoveries) {
      total += Number(r.amount)
      breakdown.push({
        type: "RESIGNATION_RECOVERY",
        recoveryId: r.id,
        tierId: r.tierId,
        monthsServed: r.monthsServed,
        amount: Number(r.amount),
      })
    }
  }

  return {
    code: "UNIFORM",
    rateSource: "INSTALLMENT_PLAN",
    computedAmount: round2(total),
    rateRowId: null, // aggregate; per-row ids in breakdown
    breakdown,
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE_SALARY — sum of pending recovery rows for this month
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveAdvanceSalary(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.advanceSalaryAutoRecover")) {
    return zero(
      "ADVANCE_SALARY",
      "ACTUAL",
      "Advance salary auto-recovery disabled by workflow rule"
    )
  }
  const recoveries = await db.advanceSalaryRecovery.findMany({
    where: {
      guardId: ctx.guardId,
      payrollMonth: ctx.monthStart,
      status: "PENDING",
    },
    select: { id: true, advanceSalaryId: true, amount: true },
  })
  const total = recoveries.reduce((s, r) => s + Number(r.amount), 0)
  return {
    code: "ADVANCE_SALARY",
    rateSource: "ACTUAL",
    computedAmount: round2(total),
    rateRowId: null,
    breakdown: recoveries.map((r) => ({
      recoveryId: r.id,
      advanceSalaryId: r.advanceSalaryId,
      amount: Number(r.amount),
    })),
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NIGHT_CALL — sum of pending derived deductions for this month
// per-day rate basis: BASE_DIV_30 (default) or CUSTOM
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveNightCall(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.nightCallAutoDeduct")) {
    return zero(
      "NIGHT_CALL",
      "CALL_LOG_DERIVED",
      "Night call auto-deduct disabled by workflow rule"
    )
  }
  const rule = await resolveNightCallRule(db, ctx.monthStart)
  if (!rule) {
    return zero(
      "NIGHT_CALL",
      "CALL_LOG_DERIVED",
      `MISSING_RATE: no active night-call rule in ${ctx.monthStart.toISOString().slice(0, 7)}`
    )
  }

  const perDayRate =
    rule.dayRateBasis === "CUSTOM"
      ? Number(rule.customDayRate ?? 0)
      : ctx.deploymentDayCount > 0
        ? ctx.basePay / 30
        : 0

  const deductions = await db.nightCallDeduction.findMany({
    where: {
      guardId: ctx.guardId,
      payrollMonth: ctx.monthStart,
      status: "PENDING",
    },
    select: { id: true, date: true, type: true, daysDeducted: true },
  })

  let totalDays = 0
  const breakdown: DeductionBreakdownLine[] = []
  for (const d of deductions) {
    totalDays += d.daysDeducted
    breakdown.push({
      deductionId: d.id,
      date: d.date.toISOString().slice(0, 10),
      type: d.type,
      daysDeducted: d.daysDeducted,
      perDayRate,
      subTotal: round2(d.daysDeducted * perDayRate),
    })
  }

  return {
    code: "NIGHT_CALL",
    rateSource: "CALL_LOG_DERIVED",
    computedAmount: round2(totalDays * perDayRate),
    rateRowId: rule.id,
    breakdown,
    warnings: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ABSENT — derived from Attendance for the month
// Spec: number of unverified-absent days * (basePay / 30) by default.
// (When deductions.absentAutoDeduct is off, returns zero so attendance-based
// proration of basePay remains the only mechanism.)
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveAbsent(
  db: DbClient,
  ctx: ResolverContext
): Promise<ResolvedDeduction> {
  if (!isWorkflowRuleEnabled("deductions.absentAutoDeduct")) {
    return zero("ABSENT", "ATTENDANCE_DERIVED", "Absent auto-deduct disabled by workflow rule")
  }
  // NOTE: this layer assumes attendance.status string column with values like
  // "ABSENT" | "PRESENT" | "LEAVE". Adjust when wiring against the actual
  // Attendance schema. Keep total = 0 if status field is unrecognised.
  const absences = await db.attendance.findMany({
    where: {
      guardId: ctx.guardId,
      date: { gte: ctx.monthStart, lt: ctx.monthEnd },
      status: "ABSENT",
    },
    select: { id: true, date: true },
  })
  const days = absences.length
  const perDayRate = ctx.deploymentDayCount > 0 ? ctx.basePay / 30 : 0
  return {
    code: "ABSENT",
    rateSource: "ATTENDANCE_DERIVED",
    computedAmount: round2(days * perDayRate),
    rateRowId: null,
    breakdown: absences.map((a) => ({
      attendanceId: a.id,
      date: a.date.toISOString().slice(0, 10),
      perDayRate,
    })),
    warnings: [],
  }
}
