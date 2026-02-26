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
