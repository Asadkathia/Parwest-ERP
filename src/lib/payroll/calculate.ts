/**
 * Canonical payroll computation engine.
 *
 * Pure read-and-compute. ZERO writes. Returns a typed `PayrollComputation`.
 * The persistence layer in `./persist.ts` is the only writer.
 *
 * Formula spec lives in the payroll rework doc — keep this file in sync.
 */

import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"
import { resolveDeductionsForPayroll } from "@/lib/deductions"
import type { ResolverContext } from "@/lib/deductions"

const DEFAULT_RESERVE_PCT = 0.30

export type PayrollComputation = {
  guardId: string
  month: Date
  year: number

  // Source counts
  deploymentDayCount: number
  deploymentRowCount: number

  // Earnings breakdown
  basePay: number
  overtimePay: number
  extraHoursPay: number
  specialDutyPay: number
  holidayPay: number
  gross: number

  // Deductions breakdown (for transparency)
  loanTotal: number
  deductionEntries: Array<{
    deductionTypeId: string
    code: string
    name: string
    amount: number
    computedAmount: number
    rateSource: string
    rateRowId: string | null
    breakdown: unknown[]
    isOverride: boolean
    overrideReason: string | null
  }>
  deductionsTotal: number

  // Reserve
  reservePct: number
  reserveBreakdown: Array<{ clientId: string; clientName: string; pct: number; weight: number }>
  reserveAmount: number

  // Net
  netBeforeReserve: number
  netPayable: number

  // Denormalized scope (from guard)
  regionId: string | null
  regionalOfficeId: string | null

  // Metadata
  warnings: string[]
}

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Number(n.toFixed(2))
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function eachDayKeyInRange(from: Date, to: Date, monthStart: Date, monthEnd: Date): string[] {
  // Inclusive bounds, but clamp to [monthStart, monthEnd)
  const lo = from < monthStart ? monthStart : from
  const hi = to >= monthEnd ? new Date(monthEnd.getTime() - 86_400_000) : to
  const result: string[] = []
  if (hi < lo) return result
  // Iterate UTC day-by-day
  const cursor = new Date(Date.UTC(lo.getUTCFullYear(), lo.getUTCMonth(), lo.getUTCDate()))
  const stop = new Date(Date.UTC(hi.getUTCFullYear(), hi.getUTCMonth(), hi.getUTCDate()))
  while (cursor.getTime() <= stop.getTime()) {
    result.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

export async function calculateGuardPayroll(
  guardId: string,
  month: Date,
  options?: { trx?: Prisma.TransactionClient }
): Promise<PayrollComputation> {
  const db: DbClient = options?.trx ?? defaultPrisma
  const warnings: string[] = []

  const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
  const year = monthStart.getUTCFullYear()

  // ---- Guard (for denormalized scope) -----------------------------------
  const guard = await db.guard.findUnique({
    where: { id: guardId },
    select: { id: true, regionId: true, regionalOfficeId: true },
  })
  if (!guard) {
    throw new Error(`Guard not found: ${guardId}`)
  }

  // ---- Deployments ------------------------------------------------------
  const deployments = await db.deployment.findMany({
    where: {
      guardId,
      deploymentDate: { gte: monthStart, lt: monthEnd },
    },
    select: {
      id: true,
      clientId: true,
      branchId: true,
      regionalOfficeId: true,
      salary: true,
      rate: true,
      overtime: true,
      deploymentDate: true,
      deploymentType: true,
      client: {
        select: {
          id: true,
          name: true,
          reservePct: true,
          regionalOffice: { select: { reservePct: true } },
        },
      },
      branch: {
        select: { id: true, name: true, province: true },
      },
    },
  })

  const deploymentRowCount = deployments.length
  const deploymentDaySet = new Set<string>()
  let basePay = 0
  // Per-client weight aggregation for reserve weighting
  const clientWeights = new Map<
    string,
    { clientName: string; pct: number; weight: number }
  >()
  // Per-branch weight aggregation for APSAA branch-rate resolver
  const branchWeights = new Map<string, { branchName: string; days: number }>()
  let deployedInPunjab = false

  for (const dep of deployments) {
    const amount = Number(dep.salary ?? dep.rate ?? 0)
    basePay += amount
    deploymentDaySet.add(dayKey(dep.deploymentDate))

    const cid = dep.clientId
    const existing = clientWeights.get(cid)
    if (existing) {
      existing.weight += amount
    } else {
      const pct =
        dep.client?.reservePct ??
        dep.client?.regionalOffice?.reservePct ??
        DEFAULT_RESERVE_PCT
      clientWeights.set(cid, {
        clientName: dep.client?.name ?? "(unknown)",
        pct,
        weight: amount,
      })
    }

    if (dep.branchId && dep.branch) {
      const bw = branchWeights.get(dep.branchId)
      if (bw) {
        bw.days += 1
      } else {
        branchWeights.set(dep.branchId, {
          branchName: dep.branch.name ?? "(unknown)",
          days: 1,
        })
      }
      const province = (dep.branch.province ?? "").trim().toLowerCase()
      if (province === "punjab") deployedInPunjab = true
    }
  }

  basePay = round2(basePay)
  const deploymentDayCount = deploymentDaySet.size

  // ---- Existing Payroll (for cached overtime/extraHours amounts) ---------
  const existingPayroll = await db.payroll.findUnique({
    where: {
      guardId_month_year: {
        guardId,
        month: monthStart,
        year,
      },
    },
    select: {
      id: true,
      overtimeAmount: true,
      extraHoursAmount: true,
      state: true,
    },
  })

  const overtimePay = round2(Number(existingPayroll?.overtimeAmount ?? 0))
  const extraHoursPay = round2(Number(existingPayroll?.extraHoursAmount ?? 0))

  // ---- Special duty -----------------------------------------------------
  const specialDutyRows = await db.payrollSpecialDuty.findMany({
    where: {
      guardId,
      status: "ACTIVE",
      dateFrom: { lt: monthEnd },
      dateTo: { gte: monthStart },
    },
    select: { id: true, amount: true, dateFrom: true, dateTo: true },
  })

  let specialDutyPay = 0
  for (const sd of specialDutyRows) {
    specialDutyPay += Number(sd.amount ?? 0)
    if (sd.dateFrom < monthStart || sd.dateTo >= monthEnd) {
      warnings.push(
        `Special duty record ${sd.id} spans outside this month; full amount counted (no proration per spec).`
      )
    }
  }
  specialDutyPay = round2(specialDutyPay)

  // ---- Loans (FINALIZED, this month) ------------------------------------
  const loans = await db.loan.findMany({
    where: {
      guardId,
      status: "FINALIZED",
      month: { gte: monthStart, lt: monthEnd },
    },
    select: { amount: true },
  })
  const loanTotal = round2(loans.reduce((s, l) => s + Number(l.amount ?? 0), 0))

  // ---- Holidays ---------------------------------------------------------
  // Scope: regionalOfficeId === guard.regionalOfficeId OR null (global)
  const holidayWhere: Prisma.PayrollHolidayWhereInput = {
    AND: [
      {
        OR: [
          { regionalOfficeId: null },
          ...(guard.regionalOfficeId
            ? [{ regionalOfficeId: guard.regionalOfficeId }]
            : []),
        ],
      },
      {
        // Holiday's effective range overlaps the month.
        // Use date as fallback when dateFrom/dateTo are null.
        OR: [
          {
            dateFrom: { not: null },
            dateTo: { not: null },
            AND: [
              { dateFrom: { lt: monthEnd } },
              { dateTo: { gte: monthStart } },
            ],
          },
          {
            dateFrom: null,
            dateTo: null,
            date: { gte: monthStart, lt: monthEnd },
          },
        ],
      },
      // exclude inactive
      {
        OR: [{ status: null }, { status: "active" }, { status: "ACTIVE" }],
      },
    ],
  }

  const holidays = await db.payrollHoliday.findMany({
    where: holidayWhere,
    select: {
      id: true,
      name: true,
      date: true,
      dateFrom: true,
      dateTo: true,
      regionalOfficeId: true,
      valueType: true,
      value: true,
      appliesTo: true,
    },
  })

  // Pre-compute helpers used by holiday math
  const guardHasAnyDeploymentThisMonth = deploymentRowCount > 0
  const guardHasDeploymentInScopedOffice = guard.regionalOfficeId
    ? deployments.some((d) => d.regionalOfficeId === guard.regionalOfficeId)
    : guardHasAnyDeploymentThisMonth

  let holidayPay = 0
  for (const h of holidays) {
    const value = Number(h.value ?? 0)
    if (value <= 0) continue
    const valueType = h.valueType ?? "FIXED_PER_DAY"
    const appliesTo = h.appliesTo ?? "WORKED_ONLY"

    const from = h.dateFrom ?? h.date
    const to = h.dateTo ?? h.date
    if (!from || !to) continue

    const holidayDayKeys = eachDayKeyInRange(from, to, monthStart, monthEnd)
    if (holidayDayKeys.length === 0) continue

    let dayCount = 0
    if (appliesTo === "WORKED_ONLY") {
      dayCount = holidayDayKeys.filter((k) => deploymentDaySet.has(k)).length
    } else if (appliesTo === "ALL_DEPLOYED_IN_OFFICE") {
      dayCount = guardHasDeploymentInScopedOffice ? holidayDayKeys.length : 0
    } else if (appliesTo === "ALL_GUARDS_IN_OFFICE") {
      dayCount = holidayDayKeys.length
    } else {
      // Unknown appliesTo — skip with warning
      warnings.push(`Holiday ${h.id} (${h.name}) has unknown appliesTo="${appliesTo}"; skipped.`)
      continue
    }

    if (dayCount === 0) continue

    if (valueType === "MULTIPLE_OF_RATE") {
      // Per-day base rate = basePay / deploymentDayCount.
      // If guard worked 0 days, we cannot compute a per-day rate.
      if (deploymentDayCount === 0) {
        warnings.push(
          `Holiday ${h.id} (${h.name}) is MULTIPLE_OF_RATE but guard has no deployment days; skipped.`
        )
        continue
      }
      const perDayRate = basePay / deploymentDayCount
      holidayPay += perDayRate * value * dayCount
    } else {
      // FIXED_PER_DAY (default)
      holidayPay += value * dayCount
    }
  }
  holidayPay = round2(holidayPay)

  // ---- Deductions (canonical, policy-managed resolvers) -----------------
  // See src/lib/deductions for per-code resolver dispatch. Each resolver is
  // gated by an `isWorkflowRuleEnabled("deductions.*")` toggle; rates come
  // from effective-dated tables (no hardcoded constants, no silent fallbacks).
  const resolverContext: ResolverContext = {
    guardId,
    monthStart,
    monthEnd,
    basePay,
    deploymentDayCount,
    branchWeights,
    deployedInPunjab,
    guardRegionId: guard.regionId ?? null,
  }
  const resolved = await resolveDeductionsForPayroll(db, resolverContext, {
    existingPayrollId: existingPayroll?.id ?? null,
  })
  warnings.push(...resolved.warnings)

  const deductionEntries = resolved.entries.map((e) => ({
    deductionTypeId: e.deductionTypeId,
    code: e.code,
    name: e.name,
    amount: e.amount,
    computedAmount: round2(e.computedAmount),
    rateSource: String(e.rateSource),
    rateRowId: e.rateRowId,
    breakdown: e.breakdown,
    isOverride: e.isOverride,
    overrideReason: e.overrideReason,
  }))

  const otherDeductionsTotal = round2(
    deductionEntries.reduce((s, e) => s + e.amount, 0)
  )
  const deductionsTotal = round2(loanTotal + otherDeductionsTotal)

  // ---- Reserve % (weighted) ---------------------------------------------
  const reserveBreakdown: PayrollComputation["reserveBreakdown"] = []
  let reservePct = DEFAULT_RESERVE_PCT
  const totalWeight = Array.from(clientWeights.values()).reduce((s, c) => s + c.weight, 0)
  if (clientWeights.size === 0 || totalWeight <= 0) {
    reservePct = DEFAULT_RESERVE_PCT
  } else {
    let weightedSum = 0
    for (const [cid, info] of clientWeights.entries()) {
      reserveBreakdown.push({
        clientId: cid,
        clientName: info.clientName,
        pct: info.pct,
        weight: round2(info.weight),
      })
      weightedSum += info.pct * info.weight
    }
    reservePct = weightedSum / totalWeight
  }

  // ---- Totals -----------------------------------------------------------
  const gross = round2(basePay + overtimePay + extraHoursPay + specialDutyPay + holidayPay)
  const netBeforeReserve = round2(gross - deductionsTotal)
  const reserveAmount = round2(netBeforeReserve * reservePct)
  const netPayable = round2(netBeforeReserve - reserveAmount)

  return {
    guardId,
    month: monthStart,
    year,

    deploymentDayCount,
    deploymentRowCount,

    basePay,
    overtimePay,
    extraHoursPay,
    specialDutyPay,
    holidayPay,
    gross,

    loanTotal,
    deductionEntries,
    deductionsTotal,

    reservePct,
    reserveBreakdown,
    reserveAmount,

    netBeforeReserve,
    netPayable,

    regionId: guard.regionId ?? null,
    regionalOfficeId: guard.regionalOfficeId ?? null,

    warnings,
  }
}
