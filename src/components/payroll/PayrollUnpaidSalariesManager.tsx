"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"

type Row = {
  id: string
  month: string
  netSalary: number
  paymentStatus: string
  guard: { id: string; name: string; parwestId: string }
}

export default function PayrollUnpaidSalariesManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [filters, setFilters] = useState({ month: "", search: "" })

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.month) params.set("month", filters.month)
    if (filters.search) params.set("search", filters.search)
    fetch(`/api/payroll/unpaid?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setRows(d || []))
      .catch(() => setRows([]))
  }, [filters.month, filters.search])

  return (
    <div className="space-y-6">
      <SectionTitle title="UnPaid Salaries" subtitle="Backend-connected unpaid salary rows." />

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input className="ui-input" type="date" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} />
          <input className="ui-input" placeholder="Search guard" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[900px]">
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
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No unpaid salary rows found.</td></tr>
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
