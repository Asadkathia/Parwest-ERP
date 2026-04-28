import type { InvoiceDraft } from "@/lib/invoicing/types"

export default function InvoicePreviewTable({ draft }: { draft: InvoiceDraft }) {
  return (
    <section className="ui-card overflow-x-auto p-0">
      <table className="w-full min-w-[640px]">
        <thead className="bg-[var(--surface-muted)]">
          <tr>
            <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Item</th>
            <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Units</th>
            <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Rate</th>
            <th className="px-4 py-2 text-start text-xs uppercase text-[var(--text-muted)]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((line) => (
            <tr key={line.id} className="border-t border-[var(--border)]">
              <td className="px-4 py-2 text-sm text-[var(--text)]">{line.label}</td>
              <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{line.units}</td>
              <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{line.rate.toLocaleString()}</td>
              <td className="px-4 py-2 text-sm font-medium text-[var(--text)]">{line.amount.toLocaleString()}</td>
            </tr>
          ))}
          <tr className="border-t border-[var(--border)] bg-[var(--surface-muted)]">
            <td colSpan={3} className="px-4 py-2 text-sm text-end text-[var(--text-muted)]">Subtotal</td>
            <td className="px-4 py-2 text-sm font-medium text-[var(--text)]">{draft.subtotal.toLocaleString()}</td>
          </tr>
          <tr className="border-t border-[var(--border)] bg-[var(--surface-muted)]">
            <td colSpan={3} className="px-4 py-2 text-sm text-end text-[var(--text-muted)]">Tax</td>
            <td className="px-4 py-2 text-sm font-medium text-[var(--text)]">{draft.tax.toLocaleString()}</td>
          </tr>
          <tr className="border-t border-[var(--border)] bg-[var(--surface-muted)]">
            <td colSpan={3} className="px-4 py-2 text-sm text-end text-[var(--text-muted)]">Total</td>
            <td className="px-4 py-2 text-sm font-semibold text-[var(--text)]">{draft.total.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}
