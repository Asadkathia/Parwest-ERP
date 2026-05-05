/**
 * Deductions engine entry point.
 *
 * `resolveDeductionsForPayroll` is called by the canonical payroll engine
 * (src/lib/payroll/calculate.ts). It walks every active PayrollDeductionType,
 * dispatches to the matching resolver by `code`, and returns one
 * ResolvedDeduction per active type.
 *
 * For policy-managed types we use the canonical resolvers below. For non-
 * policy types (legacy / OTHER) we honour the existing per-payroll override
 * model: amount = override (if any) else type.defaultAmount.
 */

import type { Prisma } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/db"
import {
  resolveAbsent,
  resolveAdvanceSalary,
  resolveApsaa,
  resolveApsaaPunjab,
  resolveCwf,
  resolveEobi,
  resolveEssi,
  resolveNightCall,
  resolveTrainingSchoolFees,
  resolveUniform,
} from "./resolvers"
import type { ResolvedDeduction, ResolverContext } from "./types"

type DbClient = Prisma.TransactionClient | typeof defaultPrisma

export type ResolvedEntry = ResolvedDeduction & {
  deductionTypeId: string
  name: string
  // Final applied amount = override if isOverride else computedAmount.
  amount: number
  isOverride: boolean
  overrideReason: string | null
}

export async function resolveDeductionsForPayroll(
  db: DbClient,
  ctx: ResolverContext,
  options: {
    existingPayrollId: string | null
  }
): Promise<{ entries: ResolvedEntry[]; warnings: string[] }> {
  const types = await db.payrollDeductionType.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      defaultAmount: true,
      rateSource: true,
      isPolicyManaged: true,
    },
    orderBy: { sortOrder: "asc" },
  })

  // Pre-load existing entries (overrides take precedence over computed values).
  const existingByType = new Map<
    string,
    {
      id: string
      amount: number
      isOverride: boolean
      overrideReason: string | null
    }
  >()
  if (options.existingPayrollId) {
    const rows = await db.payrollDeductionEntry.findMany({
      where: { payrollId: options.existingPayrollId },
      select: {
        id: true,
        deductionTypeId: true,
        amount: true,
        isOverride: true,
        overrideReason: true,
      },
    })
    for (const r of rows) {
      existingByType.set(r.deductionTypeId, {
        id: r.id,
        amount: Number(r.amount),
        isOverride: r.isOverride,
        overrideReason: r.overrideReason,
      })
    }
  }

  const entries: ResolvedEntry[] = []
  const warnings: string[] = []

  for (const t of types) {
    let resolved: ResolvedDeduction
    switch (t.code) {
      case "APSAA":
        resolved = await resolveApsaa(db, ctx)
        break
      case "CWF":
        resolved = await resolveCwf(db, ctx)
        break
      case "APSAA_PUNJAB":
        resolved = await resolveApsaaPunjab(db, ctx)
        break
      case "EOBI":
        resolved = await resolveEobi(db, ctx)
        break
      case "ESSI":
        resolved = await resolveEssi(db, ctx)
        break
      case "TRAINING_SCHOOL_FEES":
        resolved = await resolveTrainingSchoolFees(db, ctx)
        break
      case "UNIFORM":
        resolved = await resolveUniform(db, ctx)
        break
      case "ADVANCE_SALARY":
        resolved = await resolveAdvanceSalary(db, ctx)
        break
      case "NIGHT_CALL":
        resolved = await resolveNightCall(db, ctx)
        break
      case "ABSENT":
        resolved = await resolveAbsent(db, ctx)
        break
      default:
        resolved = {
          code: t.code,
          rateSource: t.rateSource ?? "MANUAL",
          computedAmount: Number(t.defaultAmount ?? 0),
          rateRowId: null,
          breakdown: [],
          warnings: [],
        }
    }

    const existing = existingByType.get(t.id)
    const amount = existing?.isOverride ? existing.amount : resolved.computedAmount

    entries.push({
      ...resolved,
      deductionTypeId: t.id,
      name: t.name,
      amount: Number(amount.toFixed(2)),
      isOverride: existing?.isOverride ?? false,
      overrideReason: existing?.overrideReason ?? null,
    })
    warnings.push(...resolved.warnings)
  }

  return { entries, warnings }
}

export type { ResolvedDeduction, ResolverContext } from "./types"
