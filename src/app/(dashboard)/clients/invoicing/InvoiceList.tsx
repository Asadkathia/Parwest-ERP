"use client"

import StatusChip from "@/components/ui/status-chip"
import { STATUS_OPTIONS, statusVariant, type InvoiceRow } from "./types"

type Props = {
  rows: InvoiceRow[]
  statusFilter: string
  onChangeStatusFilter: (s: string) => void
  onOpenDetail: (id: string) => void
}

export default function InvoiceList({ rows, statusFilter, onChangeStatusFilter, onOpenDetail }: Props) {
  return (
    <section className="ui-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Invoices for selected client / period</h3>
        <select className="ui-select" value={statusFilter} onChange={(e) => onChangeStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <Th>Invoice #</Th>
              <Th>Client</Th>
              <Th>Branch</Th>
              <Th>Month</Th>
              <Th className="text-right">Subtotal</Th>
              <Th className="text-right">Tax</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Paid</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-6 text-sm text-[var(--text-muted)]">No invoices found.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-[var(--text)]">{row.invoiceNumber}</td>
                <td className="px-4 py-2 text-[var(--text)]">{row.client?.name || "-"}</td>
                <td className="px-4 py-2 text-[var(--text-muted)]">{row.branch?.name || "-"}</td>
                <td className="px-4 py-2 text-[var(--text-muted)]">{new Date(row.month).toISOString().slice(0, 7)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{Number(row.subtotal || 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-right tabular-nums">{Number(row.taxAmount || 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{Number(row.amount || 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-right tabular-nums">{Number(row.paidAmount || 0).toLocaleString()}</td>
                <td className="px-4 py-2"><StatusChip label={row.status} variant={statusVariant(row.status)} /></td>
                <td className="px-4 py-2 text-right">
                  <button type="button" className="text-[var(--text)] underline" onClick={() => onOpenDetail(row.id)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)] ${className}`}>{children}</th>
}
