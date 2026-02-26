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

export default function PayrollClearanceManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [filters, setFilters] = useState({ search: "", month: "" })
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = async () => {
    const params = new URLSearchParams()
    if (filters.search) params.set("search", filters.search)
    if (filters.month) params.set("month", filters.month)
    const response = await fetch(`/api/payroll/salary?${params.toString()}`)
    if (!response.ok) {
      setRows([])
      return
    }
    setRows(await response.json())
  }

  useEffect(() => {
    load().catch(() => null)
  }, [filters.search, filters.month])

  const processClearance = async (row: Row) => {
    const response = await fetch(`/api/payroll/salary/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "PAID" }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setNotice({ type: "error", message: body?.message || "Failed to process clearance." })
      return
    }
    setNotice({ type: "success", message: `Clearance processed for ${row.guard?.name || "guard"}.` })
    await load()
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Clearance" subtitle="Process final salary clearance using backend payroll rows." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input className="ui-input" placeholder="Search guard" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
          <input className="ui-input" type="date" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} />
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[980px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Month</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Amount</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No rows found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.guard?.parwestId} - {row.guard?.name}</td>
                  <td className="px-4 py-3 text-sm">{new Date(row.month).toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-sm">{(row.netSalary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{row.paymentStatus}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.paymentStatus !== "PAID" ? (
                      <ActionButton variant="secondary" onClick={() => processClearance(row)}>Process Clearance</ActionButton>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Completed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
