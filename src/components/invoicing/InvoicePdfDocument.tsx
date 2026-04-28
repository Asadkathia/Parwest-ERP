/**
 * Parwest ERP — Invoice Print Document (v1.1 design template)
 * ────────────────────────────────────────────────────────────────
 * Sister component to {@link ../payroll/PayrollSlipPdfDocument}. Renders an
 * A4 invoice for the popup-window `window.print()` flow used elsewhere in
 * the app — `renderToString` the component, write the HTML + the exported
 * stylesheet into a `window.open(...)` document, then call `print()`.
 *
 * Layout matches `Parwest /invoice-pdf.html`:
 *   - Header: shield+P mark + "Parwest" wordmark + ERP sub-label
 *     + right-side "Tax Invoice" / mono invoice number / region+period.
 *   - Bill-to block: client name (large), client address, branch.
 *   - Meta grid: invoice date, due date — `tabular-nums`.
 *   - Line items table: description, quantity, unit price, total
 *     (numerics right-aligned, `tabular-nums`).
 *   - Totals block: subtotal / tax (X%) / total (large bold via
 *     `<ParwestCurrency value compact={false}>`).
 *   - Footer: notes (if any), bank details placeholder, computer-generated
 *     disclaimer.
 *
 * The shared print.css (`src/styles/print.css`) supplies the @media print
 * reset rules; the inline {@link INVOICE_PRINT_STYLESHEET} below carries
 * the per-page layout so the popup can render standalone.
 */

"use client"

import * as React from "react"

import { ParwestCurrency } from "@/components/shadcn/parwest-currency"

export interface InvoicePdfLineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface InvoicePdfProps {
  invoiceNumber: string
  /** Human-readable period, e.g. "April 2026". */
  period: string
  region: string
  clientName: string
  clientAddress?: string
  branchName?: string
  invoiceDate: Date
  dueDate: Date
  lineItems: InvoicePdfLineItem[]
  subtotal: number
  taxRatePct: number
  taxAmount: number
  total: number
  notes?: string
  generatedAt: Date
}

/**
 * Bespoke invoice styles — kept in this module so the popup-window print
 * path can ship a single string of CSS alongside the rendered HTML.
 *
 * Mirrors the structure of `PAYROLL_SLIP_PRINT_STYLESHEET`.
 */
export const INVOICE_PRINT_STYLESHEET = `
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
  .pw-inv-page {
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 16mm 18mm;
    position: relative;
    box-sizing: border-box;
  }

  .pw-inv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 6mm;
    margin-bottom: 5mm;
    border-bottom: 2pt solid #000;
  }
  .pw-inv-wordmark { display: flex; align-items: center; gap: 10pt; }
  .pw-inv-mark {
    width: 28pt; height: 28pt;
    background: #000; color: #fff;
    border-radius: 4pt;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 14pt;
    flex-shrink: 0;
  }
  .pw-inv-company { font-size: 15pt; font-weight: 800; letter-spacing: -0.3pt; }
  .pw-inv-company-sub {
    font-size: 7pt; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.5pt;
    margin-top: 1pt;
  }
  .pw-inv-meta { text-align: right; }
  .pw-inv-doc-label {
    font-size: 8pt; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.5pt;
  }
  .pw-inv-doc-no {
    font-size: 18pt; font-weight: 800; letter-spacing: -0.5pt;
    font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
  }
  .pw-inv-doc-period { font-size: 8pt; color: #6b7280; margin-top: 1pt; }

  .pw-inv-billing {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8mm; margin-bottom: 5mm;
  }
  .pw-inv-billing-label {
    font-size: 7pt; font-weight: 700; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.6pt;
    margin-bottom: 3pt;
  }
  .pw-inv-billing-name { font-size: 13pt; font-weight: 700; }
  .pw-inv-billing-sub {
    font-size: 9pt; color: #374151; margin-top: 1pt;
    white-space: pre-line;
  }

  .pw-inv-meta-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    border: 0.5pt solid #d1d5db;
    margin-bottom: 5mm;
  }
  .pw-inv-meta-cell {
    padding: 4pt 6pt;
    border-right: 0.5pt solid #d1d5db;
  }
  .pw-inv-meta-cell:last-child { border-right: none; }
  .pw-inv-meta-label {
    font-size: 7pt; font-weight: 700; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.5pt;
    margin-bottom: 2pt;
  }
  .pw-inv-meta-val {
    font-size: 10pt; font-weight: 600;
    font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
  }

  .pw-inv-table {
    width: 100%; border-collapse: collapse;
    margin-bottom: 5mm; font-size: 9pt;
  }
  .pw-inv-table th {
    background: #f9fafb;
    border: 0.5pt solid #d1d5db;
    padding: 3pt 6pt;
    text-align: left;
    font-size: 7pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.4pt;
    color: #6b7280;
  }
  .pw-inv-table th.pw-r { text-align: right; }
  .pw-inv-table td {
    border: 0.5pt solid #d1d5db;
    padding: 4pt 6pt;
    vertical-align: middle;
  }
  .pw-inv-table td.pw-r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .pw-inv-table tr:nth-child(even) td { background: #f9fafb; }
  .pw-inv-table td.pw-empty {
    color: #6b7280;
    text-align: center;
    font-style: italic;
  }

  .pw-inv-amounts { display: flex; justify-content: flex-end; margin-bottom: 5mm; }
  .pw-inv-amounts-table { width: 75mm; border-collapse: collapse; }
  .pw-inv-amounts-table td { padding: 3pt 0; font-size: 9pt; }
  .pw-inv-amounts-table td.pw-l { color: #6b7280; }
  .pw-inv-amounts-table td.pw-r {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .pw-inv-amounts-table tr.pw-total td {
    font-size: 13pt; font-weight: 800;
    border-top: 1.5pt solid #000;
    padding-top: 4pt;
  }
  .pw-inv-amounts-table tr.pw-total td.pw-r { font-size: 14pt; }

  .pw-inv-note {
    border: 0.5pt solid #d1d5db;
    padding: 5pt 8pt;
    background: #f9fafb;
    font-size: 8pt;
    color: #374151;
    margin-bottom: 5mm;
  }
  .pw-inv-note strong { color: #000; }

  .pw-inv-footer {
    position: absolute;
    bottom: 12mm; left: 18mm; right: 18mm;
    border-top: 0.5pt solid #d1d5db;
    padding-top: 4pt;
    display: flex;
    justify-content: space-between;
    gap: 8pt;
    font-size: 7pt; color: #6b7280;
  }

  @media print {
    body { background: #fff; }
    .pw-inv-page { box-shadow: none; margin: 0; }
  }
`

function formatDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—"
  const pad = (v: number) => v.toString().padStart(2, "0")
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatTimestamp(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—"
  const pad = (v: number) => v.toString().padStart(2, "0")
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

function formatQty(q: number): string {
  if (!Number.isFinite(q)) return "—"
  return q.toLocaleString("en-PK")
}

export function InvoicePdfDocument(props: InvoicePdfProps): React.ReactElement {
  const {
    invoiceNumber,
    period,
    region,
    clientName,
    clientAddress,
    branchName,
    invoiceDate,
    dueDate,
    lineItems,
    subtotal,
    taxRatePct,
    taxAmount,
    total,
    notes,
    generatedAt,
  } = props

  const taxLabel = `Tax (${Number.isFinite(taxRatePct) ? taxRatePct : 0}%)`

  return (
    <div className="pw-inv-page">
      {/* Header */}
      <div className="pw-inv-header">
        <div className="pw-inv-wordmark">
          <div className="pw-inv-mark">P</div>
          <div>
            <div className="pw-inv-company">Parwest</div>
            <div className="pw-inv-company-sub">ERP Platform</div>
          </div>
        </div>
        <div className="pw-inv-meta">
          <div className="pw-inv-doc-label">Tax Invoice</div>
          <div className="pw-inv-doc-no">{invoiceNumber}</div>
          <div className="pw-inv-doc-period">{region}</div>
          <div className="pw-inv-doc-period">{period}</div>
        </div>
      </div>

      {/* Billing parties */}
      <div className="pw-inv-billing">
        <div>
          <div className="pw-inv-billing-label">Service Provider</div>
          <div className="pw-inv-billing-name">
            Parwest Security Services (Pvt.) Ltd.
          </div>
          <div className="pw-inv-billing-sub">
            13-B, Gulberg III, Lahore 54000, Pakistan
            {"\n"}Tel: +92 42 3578 0000 · Email: billing@parwest.com
          </div>
        </div>
        <div>
          <div className="pw-inv-billing-label">Bill To</div>
          <div className="pw-inv-billing-name">{clientName}</div>
          <div className="pw-inv-billing-sub">
            {branchName ? `Branch: ${branchName}` : null}
            {branchName && clientAddress ? "\n" : null}
            {clientAddress ?? null}
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div className="pw-inv-meta-grid">
        <div className="pw-inv-meta-cell">
          <div className="pw-inv-meta-label">Invoice No.</div>
          <div className="pw-inv-meta-val">{invoiceNumber}</div>
        </div>
        <div className="pw-inv-meta-cell">
          <div className="pw-inv-meta-label">Service Period</div>
          <div className="pw-inv-meta-val">{period}</div>
        </div>
        <div className="pw-inv-meta-cell">
          <div className="pw-inv-meta-label">Issue Date</div>
          <div className="pw-inv-meta-val tabular-nums">
            {formatDate(invoiceDate)}
          </div>
        </div>
        <div className="pw-inv-meta-cell">
          <div className="pw-inv-meta-label">Due Date</div>
          <div className="pw-inv-meta-val tabular-nums">
            {formatDate(dueDate)}
          </div>
        </div>
      </div>

      {/* Line items */}
      <table className="pw-inv-table">
        <thead>
          <tr>
            <th>Description</th>
            <th className="pw-r">Quantity</th>
            <th className="pw-r">Unit Price</th>
            <th className="pw-r">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="pw-empty">
                No line items.
              </td>
            </tr>
          ) : (
            lineItems.map((li, idx) => (
              <tr key={`li-${idx}`}>
                <td>{li.description}</td>
                <td className="pw-r tabular-nums">{formatQty(li.quantity)}</td>
                <td className="pw-r tabular-nums">
                  <ParwestCurrency value={li.unitPrice} compact={false} />
                </td>
                <td className="pw-r tabular-nums">
                  <ParwestCurrency value={li.total} compact={false} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totals block */}
      <div className="pw-inv-amounts">
        <table className="pw-inv-amounts-table">
          <tbody>
            <tr>
              <td className="pw-l">Subtotal</td>
              <td className="pw-r">
                <ParwestCurrency value={subtotal} compact={false} />
              </td>
            </tr>
            <tr>
              <td className="pw-l">{taxLabel}</td>
              <td className="pw-r">
                <ParwestCurrency value={taxAmount} compact={false} />
              </td>
            </tr>
            <tr className="pw-total">
              <td className="pw-l">
                <strong>Amount Due</strong>
              </td>
              <td className="pw-r">
                <strong>
                  <ParwestCurrency value={total} compact={false} />
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes / payment details */}
      <div className="pw-inv-note">
        {notes ? (
          <>
            <strong>Notes:</strong> {notes}
            <br />
          </>
        ) : null}
        <strong>Bank Transfer Details:</strong> Habib Bank Limited · Account:
        0001-79004209-01 · IBAN: PK84HABB0001790042090100 · Branch Code: 0001
        (Main Branch, Lahore)
        <br />
        <strong>Note:</strong> Please quote invoice number{" "}
        <strong>{invoiceNumber}</strong> in your payment reference. Late
        payments attract a surcharge of 2% per month after the due date. This
        invoice is computer-generated and requires no physical signature.
      </div>

      {/* Footer */}
      <div className="pw-inv-footer">
        <span>
          Parwest Security Services (Pvt.) Ltd. · NTN 1234567-8 · 13-B Gulberg
          III, Lahore
        </span>
        <span>Page 1 of 1</span>
        <span>Generated: {formatTimestamp(generatedAt)}</span>
      </div>
    </div>
  )
}

export default InvoicePdfDocument
