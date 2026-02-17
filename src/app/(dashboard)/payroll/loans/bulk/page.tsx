"use client"

import { useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import { mockBulkLoanDraftRows, type BulkLoanDraftRow } from "@/lib/mockData/loansBulk"

export default function BulkLoansPage() {
  const [rows, setRows] = useState<BulkLoanDraftRow[]>(mockBulkLoanDraftRows)
  const [uploaded, setUploaded] = useState(false)

  const readyCount = useMemo(() => rows.filter((row) => row.status !== "DRAFT").length, [rows])

  const updateRow = (id: string, patch: Partial<BulkLoanDraftRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const commit = () => {
    setRows((prev) => prev.map((row) => ({ ...row, status: "COMMITTED" })))
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Bulk Loans Upload" subtitle="Upload formatted sheet, review rows, edit loan date and commit batch." />

      <section className="ui-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton variant="secondary">Download Template</ActionButton>
          <label className="ui-btn ui-btn-secondary px-3 py-2 text-sm cursor-pointer">
            Upload Sheet
            <input type="file" className="hidden" accept=".xlsx,.csv" onChange={() => setUploaded(true)} />
          </label>
          <ActionButton onClick={commit} disabled={rows.length === 0}>Commit Batch</ActionButton>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {uploaded ? "Sheet parsed successfully (mock)." : "No sheet uploaded yet."} Ready rows: {readyCount}/{rows.length}
        </p>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Amount</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Loan Date</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Notes</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-sm">{row.guardId} - {row.guardName}</td>
                <td className="px-4 py-2 text-sm"><input className="ui-input" type="number" value={row.amount} onChange={(e) => updateRow(row.id, { amount: Number(e.target.value), status: "READY" })} /></td>
                <td className="px-4 py-2 text-sm"><input className="ui-input" type="date" value={row.loanDate} onChange={(e) => updateRow(row.id, { loanDate: e.target.value, status: "READY" })} /></td>
                <td className="px-4 py-2 text-sm"><input className="ui-input" value={row.notes} onChange={(e) => updateRow(row.id, { notes: e.target.value, status: "READY" })} /></td>
                <td className="px-4 py-2 text-sm">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
