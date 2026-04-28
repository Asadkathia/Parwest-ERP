/**
 * Parwest ERP — Payroll Slip Print Document (v1.1 design template)
 * ────────────────────────────────────────────────────────────────
 * Printable React component used by the Bulk Salary Slips manager
 * to render an A4 payslip via the browser's `window.print()` flow.
 *
 * Layout matches `Parwest /payroll-pdf.html`:
 *   - Header: shield+P mark + "Parwest" wordmark + ERP sub-label
 *     + right-side document type / region / period.
 *   - Guard info block: name (large), parwestId mono, cnic mono,
 *     designation.
 *   - Two-column tables: Earnings (left) and Deductions (right) with
 *     subtotals.
 *   - Net payable bar with `<ParwestCurrency value={…} compact={false}>`.
 *   - Footer: page X of Y, generation timestamp, computer-generated
 *     disclaimer.
 *
 * The component is intentionally self-contained: it inlines the styles
 * specific to the slip layout (kept in sync with the v1.1 template) so
 * that it can be rendered into a popup window via `renderToString` and
 * still display correctly even without the global stylesheet.
 *
 * The shared print.css (`src/styles/print.css`) supplies the @media
 * print reset rules; this component focuses on the per-page layout.
 */

"use client"

import * as React from "react"

import { ParwestCurrency } from "@/components/shadcn/parwest-currency"

export interface PayrollSlipPdfProps {
  guardName: string
  parwestId: string
  cnic: string
  /** Human-readable period, e.g. "April 2026". */
  period: string
  region: string
  designation: string
  earnings: { label: string; amount: number }[]
  deductions: { label: string; amount: number }[]
  netPayable: number
  generatedAt: Date
}

/**
 * The slip's bespoke styles. Kept here (rather than in the global
 * stylesheet) so the popup-window print path can ship a single string
 * of CSS alongside the rendered HTML.
 *
 * Exported for reuse by the print trigger which writes both the HTML
 * and these styles into the popup document.
 */
export const PAYROLL_SLIP_PRINT_STYLESHEET = `
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #e5e7eb;
    color: #000;
    font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
    font-size: 9.5pt;
    line-height: 1.5;
  }
  .pw-slip-page {
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 15mm 20mm;
    position: relative;
    box-sizing: border-box;
  }
  .pw-slip-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 6mm;
    margin-bottom: 5mm;
    border-bottom: 2pt solid #000;
  }
  .pw-slip-wordmark { display: flex; align-items: center; gap: 8pt; }
  .pw-slip-mark {
    width: 24pt; height: 24pt;
    background: #000; color: #fff;
    border-radius: 3pt;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 13pt;
    flex-shrink: 0;
  }
  .pw-slip-company { font-size: 13pt; font-weight: 800; letter-spacing: -0.3pt; }
  .pw-slip-company-sub {
    font-size: 7pt; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.4pt;
    margin-top: 1pt;
  }
  .pw-slip-meta { text-align: right; }
  .pw-slip-doc-type { font-size: 14pt; font-weight: 800; }
  .pw-slip-period { font-size: 8pt; color: #6b7280; margin-top: 1pt; }

  .pw-slip-guard {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 5mm; padding: 5mm;
    border: 0.5pt solid #d1d5db;
    background: #f9fafb;
    margin-bottom: 5mm;
  }
  .pw-slip-guard-field { display: flex; flex-direction: column; gap: 1pt; }
  .pw-slip-guard-label {
    font-size: 7pt; font-weight: 700; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.5pt;
  }
  .pw-slip-guard-value { font-size: 9.5pt; font-weight: 600; color: #000; }
  .pw-slip-guard-value.pw-mono {
    font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
  }
  .pw-slip-guard-value.pw-name { font-size: 12pt; font-weight: 700; }

  .pw-slip-cols {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 4mm; margin-bottom: 4mm;
  }
  .pw-slip-section-title {
    font-size: 7pt; font-weight: 700; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.5pt;
    border-bottom: 0.5pt solid #d1d5db;
    padding-bottom: 2pt; margin-bottom: 3pt;
  }

  .pw-slip-table {
    width: 100%; border-collapse: collapse;
    margin-bottom: 4mm; font-size: 9pt;
  }
  .pw-slip-table th {
    background: #f9fafb;
    border: 0.5pt solid #d1d5db;
    padding: 2.5pt 5pt;
    text-align: left;
    font-size: 7pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.4pt;
    color: #6b7280;
  }
  .pw-slip-table th.pw-r { text-align: right; }
  .pw-slip-table td {
    border: 0.5pt solid #d1d5db;
    padding: 3pt 5pt;
    vertical-align: middle;
  }
  .pw-slip-table td.pw-r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .pw-slip-table tr:nth-child(even) td { background: #fafafa; }
  .pw-slip-table .pw-subtotal td {
    border-top: 0.75pt solid #000;
    font-weight: 700;
    background: none !important;
  }
  .pw-slip-table .pw-total td {
    border-top: 1.5pt solid #000;
    font-size: 11pt;
    font-weight: 800;
    background: none !important;
  }
  .pw-slip-table td.pw-slip-empty {
    color: #6b7280;
    text-align: center;
    font-style: italic;
  }

  .pw-slip-footer {
    position: absolute;
    bottom: 10mm; left: 20mm; right: 20mm;
    border-top: 0.5pt solid #d1d5db;
    padding-top: 3pt;
    display: flex;
    justify-content: space-between;
    gap: 8pt;
    font-size: 7pt; color: #6b7280;
  }

  @media print {
    body { background: #fff; }
    .pw-slip-page { box-shadow: none; margin: 0; }
  }
`

function formatPkrCellAmount(amount: number): string {
  // Render numeric cells as plain integer PKR amounts with grouped
  // separators — matches the v1.1 template ("28,000", "1,400" etc.).
  // Negatives use the legacy minus glyph.
  if (Number.isFinite(amount) === false) return "—"
  const sign = amount < 0 ? "‒ " : ""
  const abs = Math.abs(Math.round(amount))
  return sign + abs.toLocaleString("en-PK")
}

function sumAmounts(items: { amount: number }[]): number {
  return items.reduce((acc, item) => acc + (Number.isFinite(item.amount) ? item.amount : 0), 0)
}

function formatTimestamp(date: Date): string {
  // dd/mm/yyyy hh:mm — matches the template footer format.
  const pad = (value: number) => value.toString().padStart(2, "0")
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function PayrollSlipPdfDocument(props: PayrollSlipPdfProps): React.ReactElement {
  const {
    guardName,
    parwestId,
    cnic,
    period,
    region,
    designation,
    earnings,
    deductions,
    netPayable,
    generatedAt,
  } = props

  const grossEarnings = sumAmounts(earnings)
  const totalDeductions = sumAmounts(deductions)

  return (
    <div className="pw-slip-page">
      {/* Header */}
      <div className="pw-slip-header">
        <div className="pw-slip-wordmark">
          <div className="pw-slip-mark">P</div>
          <div>
            <div className="pw-slip-company">Parwest</div>
            <div className="pw-slip-company-sub">ERP Platform</div>
          </div>
        </div>
        <div className="pw-slip-meta">
          <div className="pw-slip-doc-type">Payroll Slip</div>
          <div className="pw-slip-period">{region}</div>
          <div className="pw-slip-period">{period}</div>
        </div>
      </div>

      {/* Guard info */}
      <div className="pw-slip-guard">
        <div className="pw-slip-guard-field" style={{ gridColumn: "1 / -1" }}>
          <div className="pw-slip-guard-label">Full Name</div>
          <div className="pw-slip-guard-value pw-name">{guardName}</div>
        </div>
        <div className="pw-slip-guard-field">
          <div className="pw-slip-guard-label">Parwest ID</div>
          <div className="pw-slip-guard-value pw-mono">{parwestId}</div>
        </div>
        <div className="pw-slip-guard-field">
          <div className="pw-slip-guard-label">CNIC</div>
          <div className="pw-slip-guard-value pw-mono">{cnic}</div>
        </div>
        <div className="pw-slip-guard-field" style={{ gridColumn: "1 / -1" }}>
          <div className="pw-slip-guard-label">Designation</div>
          <div className="pw-slip-guard-value">{designation}</div>
        </div>
      </div>

      {/* Earnings + Deductions */}
      <div className="pw-slip-cols">
        <div>
          <div className="pw-slip-section-title">Earnings</div>
          <table className="pw-slip-table">
            <thead>
              <tr>
                <th>Component</th>
                <th className="pw-r">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {earnings.length === 0 ? (
                <tr>
                  <td colSpan={2} className="pw-slip-empty">
                    No earnings recorded.
                  </td>
                </tr>
              ) : (
                earnings.map((item, idx) => (
                  <tr key={`earn-${idx}`}>
                    <td>{item.label}</td>
                    <td className="pw-r tabular-nums">
                      {formatPkrCellAmount(item.amount)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="pw-subtotal">
                <td>
                  <strong>Gross Earnings</strong>
                </td>
                <td className="pw-r tabular-nums">
                  <strong>{formatPkrCellAmount(grossEarnings)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <div className="pw-slip-section-title">Deductions</div>
          <table className="pw-slip-table">
            <thead>
              <tr>
                <th>Component</th>
                <th className="pw-r">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {deductions.length === 0 ? (
                <tr>
                  <td colSpan={2} className="pw-slip-empty">
                    No deductions recorded.
                  </td>
                </tr>
              ) : (
                deductions.map((item, idx) => (
                  <tr key={`ded-${idx}`}>
                    <td>{item.label}</td>
                    <td className="pw-r tabular-nums">
                      {formatPkrCellAmount(item.amount)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="pw-subtotal">
                <td>
                  <strong>Total Deductions</strong>
                </td>
                <td className="pw-r tabular-nums">
                  <strong>{formatPkrCellAmount(totalDeductions)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net payable */}
      <table className="pw-slip-table" style={{ marginBottom: "5mm" }}>
        <tbody>
          <tr className="pw-total">
            <td style={{ width: "70%" }}>
              <strong>NET SALARY PAYABLE — {period}</strong>
            </td>
            <td className="pw-r tabular-nums">
              <ParwestCurrency value={netPayable} compact={false} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="pw-slip-footer">
        <span>Page 1 of 1</span>
        <span>Generated: {formatTimestamp(generatedAt)}</span>
        <span>Computer-generated, no signature required.</span>
      </div>
    </div>
  )
}

export default PayrollSlipPdfDocument
