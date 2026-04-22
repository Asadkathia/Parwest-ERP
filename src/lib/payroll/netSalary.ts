type PayrollAmountFields = {
  baseSalary?: number | null
  extraHoursAmount?: number | null
  specialDutyAmount?: number | null
  loans?: number | null
  otherDeductions?: number | null
  trainingSchoolFees?: number | null
  cwf?: number | null
  eobi?: number | null
  essi?: number | null
}

function toNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0
  return value
}

/**
 * @deprecated Use `calculateGuardPayroll` from `./calculate` instead.
 *
 * This function is retained only for the legacy `/api/payroll/salary`,
 * `/api/payroll/extra-hours`, and `/api/payroll/other-deductions` endpoints,
 * which will be refactored in Wave 2. The canonical engine in `./calculate.ts`
 * supersedes this formula (handles overtime, holidays, special duty, weighted
 * reserve %, deduction entries, and state machine).
 */
export function calculatePayrollNetSalary(fields: PayrollAmountFields) {
  const gross =
    toNumber(fields.baseSalary) +
    toNumber(fields.extraHoursAmount) +
    toNumber(fields.specialDutyAmount)

  const deductions =
    toNumber(fields.loans) +
    toNumber(fields.otherDeductions) +
    toNumber(fields.trainingSchoolFees) +
    toNumber(fields.cwf) +
    toNumber(fields.eobi) +
    toNumber(fields.essi)

  return Number((gross - deductions).toFixed(2))
}
