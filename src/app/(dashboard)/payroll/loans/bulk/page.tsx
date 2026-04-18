"use client"

import { useMemo, useRef, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import { parseCsvToLoanRows, type BulkLoanDraftRow } from "@/lib/payroll/loans-bulk"

export default function BulkLoansPage() {
  const [rows, setRows] = useState<BulkLoanDraftRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const readyCount = useMemo(() => rows.filter((r) => r.status === "READY").length, [rows])
  const errorCount = useMemo(() => rows.filter((r) => r.status === "ERROR").length, [rows])

  const updateRow = (id: string, patch: Partial<BulkLoanDraftRow>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              ...patch,
              status:
                patch.status ??
                (row.guardId && row.amount > 0 ? "READY" : "ERROR"),
            }
          : row
      )
    )
  }

  const handleUpload = (file: File | null) => {
    if (!file) return
    setParseError(null)
    setCommitResult(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== "string") {
        setParseError("Could not read file.")
        return
      }
      const parsed = parseCsvToLoanRows(text)
      if (parsed.length === 0) {
        setParseError("No rows found. Check that the file has a header row and data rows.")
        return
      }
      setRows(parsed)
    }
    reader.onerror = () => setParseError("Failed to read file.")
    reader.readAsText(file)
  }

  const commit = async () => {
    const readyRows = rows.filter((r) => r.status === "READY" && r.guardId)
    if (readyRows.length === 0) return

    setCommitting(true)
    setCommitResult(null)
    try {
      const res = await fetch("/api/payroll/loans/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: readyRows.map((r) => ({
            guardId: r.guardId,
            amount: r.amount,
            loanDate: r.loanDate,
            notes: r.notes,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setRows((prev) =>
          prev.map((row) =>
            row.status === "READY" ? { ...row, status: "COMMITTED" } : row
          )
        )
        setCommitResult(`Committed ${data.committed}/${data.total} loans successfully.`)
      } else {
        setCommitResult(`Error: ${data.error ?? "Commit failed."}`)
      }
    } catch {
      setCommitResult("Network error. Please try again.")
    } finally {
      setCommitting(false)
    }
  }

  const downloadTemplate = () => {
    const csv = "guardId,amount,loanDate,notes\n,0,2026-04-01,\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bulk-loans-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Bulk Loans Upload"
        subtitle="Upload a CSV with columns: guardId, amount, loanDate, notes. Review rows then commit."
      />

      <section className="ui-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton variant="secondary" onClick={downloadTemplate}>
            Download Template
          </ActionButton>
          <label className="ui-btn ui-btn-secondary px-3 py-2 text-sm cursor-pointer">
            Upload CSV
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv"
              onChange={(e) => handleUpload(e.target.files?.[0] || null)}
            />
          </label>
          <ActionButton onClick={commit} disabled={readyCount === 0 || committing}>
            {committing ? "Committing…" : `Commit ${readyCount} Ready Rows`}
          </ActionButton>
        </div>

        {parseError && (
          <p className="text-sm text-red-500">{parseError}</p>
        )}
        {rows.length > 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            {rows.length} rows parsed — {readyCount} ready, {errorCount} with errors
          </p>
        )}
        {commitResult && (
          <p className="text-sm font-medium text-[var(--text-primary)]">{commitResult}</p>
        )}
      </section>

      {rows.length > 0 && (
        <section className="ui-card overflow-x-auto p-0">
          <table className="w-full min-w-[900px]">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Guard ID</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Name</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Amount</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Loan Date</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Notes</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-[var(--border)] ${row.status === "ERROR" ? "bg-red-50" : ""}`}
                >
                  <td className="px-4 py-2 text-sm font-mono">{row.guardId || <span className="text-red-500">missing</span>}</td>
                  <td className="px-4 py-2 text-sm">{row.guardName}</td>
                  <td className="px-4 py-2 text-sm">
                    <input
                      className="ui-input"
                      type="number"
                      value={row.amount}
                      disabled={row.status === "COMMITTED"}
                      onChange={(e) => updateRow(row.id, { amount: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <input
                      className="ui-input"
                      type="date"
                      value={row.loanDate}
                      disabled={row.status === "COMMITTED"}
                      onChange={(e) => updateRow(row.id, { loanDate: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <input
                      className="ui-input"
                      value={row.notes}
                      disabled={row.status === "COMMITTED"}
                      onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={
                        row.status === "COMMITTED"
                          ? "text-green-600 font-medium"
                          : row.status === "ERROR"
                            ? "text-red-500"
                            : "text-[var(--text-muted)]"
                      }
                    >
                      {row.status}
                      {row.error ? ` — ${row.error}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
