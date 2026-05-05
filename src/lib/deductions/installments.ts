/**
 * Helpers for installment-based deductions (Uniform, Training School Fees).
 *
 * `buildInstallmentSchedule` produces N { payrollMonth, amount } rows starting
 * from the month immediately AFTER the issuance month. The final installment
 * absorbs any rounding remainder so the sum equals totalCost exactly.
 */

export type InstallmentRow = { payrollMonth: Date; amount: number }

function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function addMonthsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}

export function buildInstallmentSchedule(args: {
  issuedOn: Date
  totalCost: number
  installmentAmount: number
  installmentCount: number
}): InstallmentRow[] {
  const { issuedOn, totalCost, installmentAmount, installmentCount } = args
  if (installmentCount <= 0) return []
  const start = addMonthsUTC(firstOfMonthUTC(issuedOn), 1)
  const rows: InstallmentRow[] = []
  let acc = 0
  for (let i = 0; i < installmentCount; i++) {
    const isLast = i === installmentCount - 1
    const amount = isLast ? round2(totalCost - acc) : round2(installmentAmount)
    acc += amount
    rows.push({ payrollMonth: addMonthsUTC(start, i), amount })
  }
  return rows
}
