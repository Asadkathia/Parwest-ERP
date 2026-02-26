"use client"

import { useCallback, useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type GuardOption = { id: string; name: string; parwestId: string }
type Row = {
  id: string
  month: string
  extraHours: number
  extraHoursAmount: number
  guard: { id: string; name: string; parwestId: string }
}

export default function PayrollExtraHoursManager() {
  const [guards, setGuards] = useState<GuardOption[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [form, setForm] = useState({ guardId: "", month: "", hours: "", rate: "" })
  const [filters, setFilters] = useState({ guardId: "", month: "", search: "" })

  const loadGuards = useCallback(async () => {
    const response = await fetch("/api/guards?status=ACTIVE")
    if (!response.ok) throw new Error("Failed to load guards")
    const data = await response.json()
    setGuards((data || []).map((g: any) => ({ id: g.id, name: g.name, parwestId: g.parwestId })))
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.guardId) params.set("guardId", filters.guardId)
      if (filters.month) params.set("month", filters.month)
      if (filters.search) params.set("search", filters.search)
      const response = await fetch(`/api/payroll/extra-hours?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to load records")
      const data = await response.json()
      setRows(data || [])
    } catch (error) {
      console.error(error)
      setNotice({ type: "error", message: "Unable to fetch extra hours records." })
    } finally {
      setLoading(false)
    }
  }, [filters.guardId, filters.month, filters.search])

  useEffect(() => {
    loadGuards().catch((error) => {
      console.error(error)
      setNotice({ type: "error", message: "Unable to fetch guards." })
    })
  }, [loadGuards])

  useEffect(() => {
    loadRows().catch((error) => {
      console.error(error)
      setNotice({ type: "error", message: "Unable to fetch extra hours records." })
    })
  }, [loadRows])

  const submit = async () => {
    if (!form.guardId || !form.month || !form.hours || !form.rate) {
      setNotice({ type: "error", message: "Guard, month, hours and rate are required." })
      return
    }
    try {
      const response = await fetch("/api/payroll/extra-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: form.guardId,
          month: form.month,
          hours: Number(form.hours),
          rate: Number(form.rate),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || "Failed to save")
      }
      setForm({ guardId: "", month: "", hours: "", rate: "" })
      setNotice({ type: "success", message: "Extra hours saved." })
      await loadRows()
    } catch (error: any) {
      setNotice({ type: "error", message: error?.message || "Unable to save extra hours." })
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Extra Hours" subtitle="Backend-connected extra-hours records." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4 space-y-4">
        <p className="text-sm font-semibold text-[var(--text)]">Add Extra Hours</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Guard *</span>
            <select className="ui-select" value={form.guardId} onChange={(e) => setForm((p) => ({ ...p, guardId: e.target.value }))}>
              <option value="">-- Select Guard --</option>
              {guards.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.parwestId} - {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Month *</span>
            <input className="ui-input" type="date" value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Hours *</span>
            <input className="ui-input" type="number" value={form.hours} onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Rate *</span>
            <input className="ui-input" type="number" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} />
          </label>
        </div>
        <div className="flex justify-end">
          <ActionButton onClick={submit}>Submit</ActionButton>
        </div>
      </section>

      <section className="ui-card p-4 space-y-4">
        <p className="text-sm font-semibold text-[var(--text)]">Filters</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            className="ui-input"
            placeholder="Search guard"
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          />
          <select className="ui-select" value={filters.guardId} onChange={(e) => setFilters((p) => ({ ...p, guardId: e.target.value }))}>
            <option value="">All guards</option>
            {guards.map((g) => (
              <option key={g.id} value={g.id}>
                {g.parwestId} - {g.name}
              </option>
            ))}
          </select>
          <input className="ui-input" type="date" value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} />
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[860px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Month</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Hours</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No records.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.guard?.parwestId} - {row.guard?.name}</td>
                  <td className="px-4 py-3 text-sm">{new Date(row.month).toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-sm">{row.extraHours || 0}</td>
                  <td className="px-4 py-3 text-sm">{(row.extraHoursAmount || 0).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
