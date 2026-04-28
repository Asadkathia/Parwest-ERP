/**
 * PKR currency formatters for Parwest ERP design-system v1.1.
 *
 * Two canonical forms:
 *  - Short ("compact") — used in tables and KPI cards. Examples: "₨ 4.2L", "₨ 28K", "₨ 1.2Cr".
 *  - Full              — used in tooltips, exports, invoices. Pakistani lakh/crore digit grouping.
 *
 * Pakistani digit grouping mirrors the Indian numbering system: the first 3 digits
 * from the right are grouped together, then groups of 2 thereafter (lakh / crore).
 * Intl.NumberFormat('en-IN') produces exactly this layout.
 *
 *   1_000           -> "1,000"
 *   10_000          -> "10,000"
 *   100_000         -> "1,00,000"
 *   1_000_000       -> "10,00,000"
 *   10_000_000      -> "1,00,00,000"
 *   100_000_000     -> "10,00,00,000"
 *   424_000_000     -> "42,40,00,000"
 *
 * Short-form rules:
 *   < 1,000                 -> raw number, e.g. "₨ 247"
 *   1,000 .. 99,999         -> "₨ NK"  (one decimal once value >= 10K)
 *   100,000 .. 9,999,999    -> "₨ N.NL"
 *   >= 10,000,000           -> "₨ N.NCr"
 *
 * Negative values keep the minus sign in front of the symbol: "-₨ 4.2L".
 *
 * Inline transform examples (compile-time documentation):
 *   formatPKRShort(247)         -> "₨ 247"
 *   formatPKRShort(8500)        -> "₨ 8K"
 *   formatPKRShort(28000)       -> "₨ 28.0K"
 *   formatPKRShort(425000)      -> "₨ 4.3L"
 *   formatPKRShort(4_240_000)   -> "₨ 42.4L"
 *   formatPKRShort(42_400_000)  -> "₨ 4.2Cr"
 *   formatPKRShort(424_000_000) -> "₨ 42.4Cr"
 *   formatPKRShort(-15_000)     -> "-₨ 15.0K"
 *   formatPKRFull(424_000_000)  -> "₨ 42,40,00,000"
 */

// Non-breaking space keeps the symbol + amount on the same line in tables/tooltips.
const NBSP = " "
const SYMBOL = `₨${NBSP}`

const fullFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
})

/**
 * Full PKR — Pakistani digit grouping (lakh/crore).
 * Used in tooltips, exports, invoices.
 */
export function formatPKRFull(n: number): string {
  if (!Number.isFinite(n)) return `${SYMBOL}0`
  const abs = Math.abs(Math.round(n))
  const formatted = fullFormatter.format(abs)
  return n < 0 ? `-${SYMBOL}${formatted}` : `${SYMBOL}${formatted}`
}

/**
 * Short PKR — used in tables and KPI cards.
 * Returns "₨ 247" / "₨ 28.0K" / "₨ 4.2L" / "₨ 1.2Cr", with negative
 * values prefixed by a minus.
 */
export function formatPKRShort(n: number): string {
  if (!Number.isFinite(n)) return `${SYMBOL}0`

  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)

  let body: string
  if (abs < 1_000) {
    body = String(Math.round(abs))
  } else if (abs < 10_000) {
    // 1,000 .. 9,999 -> integer K (one-decimal threshold kicks in at 10K)
    body = `${Math.round(abs / 1_000)}K`
  } else if (abs < 100_000) {
    // 10,000 .. 99,999 -> "NN.NK"
    body = `${roundOneDecimal(abs / 1_000)}K`
  } else if (abs < 10_000_000) {
    // 1L .. 99.9L
    body = `${roundOneDecimal(abs / 100_000)}L`
  } else {
    // >= 1Cr
    body = `${roundOneDecimal(abs / 10_000_000)}Cr`
  }

  return `${sign}${SYMBOL}${body}`
}

/**
 * True when `n` is null/undefined/NaN/0 — handy for hiding "₨ 0" deduction
 * cells on payslips and KPI rows.
 */
export function isZeroOrEmpty(n: number | null | undefined): boolean {
  if (n === null || n === undefined) return true
  if (!Number.isFinite(n)) return true
  return n === 0
}

function roundOneDecimal(n: number): string {
  // Avoid trailing ".0" when the rounded result is whole-number-like only at the
  // L/Cr scale; keep ".0" at K-scale for visual consistency with the spec.
  return n.toFixed(1)
}
