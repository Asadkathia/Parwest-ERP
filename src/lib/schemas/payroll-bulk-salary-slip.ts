import { z } from "zod"

/**
 * Payroll bulk-salary-slip generation schema.
 *
 * Mirrors the validation enforced by:
 *   - src/app/api/payroll/salary-slips/generate/route.ts POST handler
 *     (`month`, `earnings`, `deductions`, `rows` are required; rows must
 *     have at least one entry; the API converts month to first-of-month)
 *   - The legacy "Generate" submit gate which required `parsedRows.length`
 *     to be non-zero.
 *
 * IMPORTANT: this schema MUST mirror the legacy validations exactly — do
 * not tighten or loosen. Any policy change goes through the API first.
 */

export const PAYROLL_SALARY_SLIP_EARNINGS = [
  { key: "basicSalary", label: "Basic Salary" },
  { key: "workingDays", label: "Working Days" },
  { key: "paidWorkingDays", label: "Paid Working Days" },
  { key: "overtime", label: "Overtime / Hours" },
  { key: "gazettedHolidays", label: "Gazetted Holidays" },
  {
    key: "gazettedHolidaysOvertimeAmount",
    label: "Gazetted Holidays / Overtime Amount",
  },
  { key: "arrears", label: "Arrears" },
] as const

// Canonical deduction codes from the deductions policy. These align with
// PayrollDeductionType.code so a slip can pull the same line directly from
// PayrollDeductionEntry without a key-translation step.
export const PAYROLL_SALARY_SLIP_DEDUCTIONS = [
  { key: "ADVANCE_SALARY", label: "Advance Salary" },
  { key: "EOBI", label: "EOBI" },
  { key: "ESSI", label: "ESSI" },
  { key: "CWF", label: "CWF" },
  { key: "APSAA", label: "APSAA" },
  { key: "APSAA_PUNJAB", label: "APSAA — Punjab" },
  { key: "UNIFORM", label: "Uniform / Jersey" },
  { key: "TRAINING_SCHOOL_FEES", label: "Training School Fees" },
  { key: "NIGHT_CALL", label: "Night Call Monitoring" },
  { key: "ABSENT", label: "Absentees" },
  { key: "OTHER", label: "Other" },
] as const

export const payrollBulkSalarySlipGenerateSchema = z.object({
  // YYYY-MM string from a <input type="month">. The API converts this to a
  // first-of-month Date — we keep the shorter shape here.
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),

  // Earnings keys to include. Legacy form allowed empty selection (zero
  // earnings simply produces zero gross), so we don't enforce a minimum.
  earnings: z.array(z.string()),

  // Deductions keys to include. Same as earnings — legacy allowed empty.
  deductions: z.array(z.string()),

  // CSV-parsed rows. Legacy form required at least one row before submit.
  rows: z
    .array(z.record(z.string(), z.string()))
    .min(1, "Upload a CSV with at least one row"),
})

export type PayrollBulkSalarySlipGenerateInput = z.infer<
  typeof payrollBulkSalarySlipGenerateSchema
>
