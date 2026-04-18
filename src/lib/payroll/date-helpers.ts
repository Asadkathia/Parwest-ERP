/**
 * Shared month-parsing helpers for payroll routes.
 *
 * Accepts "YYYY-MM" or "YYYY-MM-DD" format. Returns a date at UTC 00:00 on
 * day 1 of the month, plus the exclusive end-of-month boundary and year.
 * Returns null for invalid input.
 *
 * Use `parseMonthRange` when filtering by `{ gte: start, lt: end }`.
 * Use `parseMonthStart` when a single-date anchor is needed (e.g., upserts
 * keyed on `guardId_month_year`).
 */

export type MonthRange = { start: Date; end: Date; year: number }

export function parseMonthRange(value: string | null | undefined): MonthRange | null {
  if (!value) return null
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return null
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  return { start, end, year: start.getUTCFullYear() }
}

export function parseMonthStart(value: string | null | undefined): Date | null {
  const range = parseMonthRange(value)
  return range?.start ?? null
}
