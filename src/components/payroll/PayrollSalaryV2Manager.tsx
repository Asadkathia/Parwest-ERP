"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Row = {
  id: string
  month: string
  baseSalary: number
  extraHoursAmount: number
  specialDutyAmount: number
  otherDeductions: number
  netSalary: number
  paymentStatus: string
  paymentMethod: string | null
  guard: { id: string; name: string; parwestId: string }
}

export default function PayrollSalaryV2Manager() {
  const [rows, setRows] = useState<Row[]>([])
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [filters, setFilters] = useState({ month: "", paymentStatus: "", search: "" })

  const load = async () => {
    const params = new URLSearchParams()
    if (filters.month) params.set("month", filters.month)
    if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus)
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
  }, [filters.month, filters.paymentStatus, filters.search])

  const updateStatus = async (id: string, paymentStatus: string) => {
    const response = await fetch(`/api/payroll/salary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setNotice({ type: "error", message: body?.message || "Failed to update salary row." })
      return
    }
    setNotice({ type: "success", message: `Payment status set to ${paymentStatus}.` })
    await load()
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Salary V2" subtitle="Backend-connected salary listing and payment status update." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input className="ui-input" type="date" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} />
          <select className="ui-select" value={filters.paymentStatus} onChange={(e) => setFilters((p) => ({ ...p, paymentStatus: e.target.value }))}>
            <option value="">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
            <option value="UNPAID">UNPAID</option>
          </select>
          <input className="ui-input" placeholder="Search guard" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Month</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Base</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Extra</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Special</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Deductions</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Net</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No salary rows found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.guard?.parwestId} - {row.guard?.name}</td>
                  <td className="px-4 py-3 text-sm">{new Date(row.month).toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-sm">{(row.baseSalary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{(row.extraHoursAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{(row.specialDutyAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{(row.otherDeductions || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{(row.netSalary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{row.paymentStatus}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <ActionButton variant="secondary" onClick={() => updateStatus(row.id, "PAID")}>Mark Paid</ActionButton>
                      <ActionButton variant="secondary" onClick={() => updateStatus(row.id, "UNPAID")}>Mark Unpaid</ActionButton>
                    </div>
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
