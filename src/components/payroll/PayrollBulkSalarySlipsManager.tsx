"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Row = {
  id: string
  month: string
  netSalary: number
  paymentStatus: string
  guard: { id: string; name: string; parwestId: string }
}

export default function PayrollBulkSalarySlipsManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [filters, setFilters] = useState({ month: "", search: "" })
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = async () => {
    const params = new URLSearchParams()
    if (filters.month) params.set("month", filters.month)
    if (filters.search) params.set("search", filters.search)
    const response = await fetch(`/api/payroll/salary?${params.toString()}`)
    if (!response.ok) {
      setRows([])
      return
    }
    setRows(await response.json())
  }

  useEffect(() => {
    load().catch(() => null)
  }, [filters.month, filters.search])

  const generate = () => {
    if (rows.length === 0) {
      setNotice({ type: "error", message: "No salary rows found for selected filters." })
      return
    }
    setNotice({ type: "success", message: `Generated ${rows.length} salary slips (backend data, export simulation).` })
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Bulk Salary Slips" subtitle="Generate slips from backend salary rows." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input className="ui-input" type="date" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} />
          <input className="ui-input" placeholder="Search guard" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
          <div className="flex justify-end">
            <ActionButton onClick={generate}>Generate Slips</ActionButton>
          </div>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[940px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Month</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Amount</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No salary rows.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.guard?.parwestId} - {row.guard?.name}</td>
                  <td className="px-4 py-3 text-sm">{new Date(row.month).toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-sm">{(row.netSalary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{row.paymentStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
