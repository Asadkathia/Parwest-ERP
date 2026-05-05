/**
 * Deductions policy — shared types.
 *
 * The canonical contract for what a resolver returns. Every policy-managed
 * deduction (APSAA, CWF, EOBI, etc.) returns one of these so the engine can
 * persist a fully-traceable PayrollDeductionEntry.
 */

export const CANONICAL_CODES = [
  "APSAA",
  "CWF",
  "ADVANCE_SALARY",
  "UNIFORM",
  "APSAA_PUNJAB",
  "NIGHT_CALL",
  "ABSENT",
  "EOBI",
  "ESSI",
  "TRAINING_SCHOOL_FEES",
  "OTHER",
] as const

export type CanonicalDeductionCode = (typeof CANONICAL_CODES)[number]

export const RATE_SOURCES = [
  "CLIENT_BRANCH_RATE",
  "REGION_RATE",
  "ACTUAL",
  "INSTALLMENT_PLAN",
  "ATTENDANCE_DERIVED",
  "CALL_LOG_DERIVED",
  "EOBI_RATE",
  "MANUAL",
] as const

export type RateSource = (typeof RATE_SOURCES)[number]

export type DeductionBreakdownLine = {
  // Free-form structured detail. Examples:
  //   { branchId, branchName, days, rate, subTotal }     for APSAA
  //   { regionId, regionName, rate }                     for CWF
  //   { issuanceId, installmentId, amount }              for UNIFORM
  //   { date, type, daysDeducted, perDayRate, subTotal } for NIGHT_CALL
  [key: string]: unknown
}

export type ResolvedDeduction = {
  code: string
  rateSource: RateSource | string
  computedAmount: number
  // Reference to the rate row (or aggregate row id) that produced this amount.
  // For aggregate sources (UNIFORM = many installments) we store the
  // PayrollDeductionType id and put per-row ids in `breakdown`.
  rateRowId: string | null
  breakdown: DeductionBreakdownLine[]
  warnings: string[]
}

export type ResolverContext = {
  guardId: string
  monthStart: Date
  monthEnd: Date
  // Pre-fetched in calculate.ts to avoid repeat queries.
  basePay: number
  deploymentDayCount: number
  // Branch ids guard had deployments at this month, with day-weight.
  branchWeights: Map<string, { branchName: string; days: number }>
  // True if any deployment branch was in Punjab.
  deployedInPunjab: boolean
  guardRegionId: string | null
}
