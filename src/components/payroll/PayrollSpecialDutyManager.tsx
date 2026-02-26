"use client"

import { useCallback, useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Guard = { id: string; name: string; parwestId: string }
type Row = {
  id: string
  month: string
  specialDutyHours: number
  specialDutyAmount: number
  guard: Guard
}

export default function PayrollSpecialDutyManager() {
  const [guards, setGuards] = useState<Guard[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [form, setForm] = useState({ guardId: "", month: "", hours: "", rate: "" })

  const load = useCallback(async () => {
    const [guardsRes, rowsRes] = await Promise.all([
      fetch("/api/guards?status=ACTIVE"),
      fetch("/api/payroll/special-duty"),
    ])
    if (guardsRes.ok) setGuards(await guardsRes.json())
    if (rowsRes.ok) setRows(await rowsRes.json())
  }, [])

  useEffect(() => {
    load().catch(() => null)
  }, [load])

  const submit = async () => {
    if (!form.guardId || !form.month || !form.hours || !form.rate) {
      setNotice({ type: "error", message: "Guard, month, hours and rate are required." })
      return
    }
    const response = await fetch("/api/payroll/special-duty", {
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
      setNotice({ type: "error", message: body?.message || "Failed to save special duty." })
      return
    }
    setNotice({ type: "success", message: "Special duty saved." })
    setForm({ guardId: "", month: "", hours: "", rate: "" })
    await load()
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Special Duty" subtitle="Backend-connected special-duty records." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select className="ui-select" value={form.guardId} onChange={(e) => setForm((p) => ({ ...p, guardId: e.target.value }))}>
            <option value="">Select Guard</option>
            {guards.map((g) => (
              <option key={g.id} value={g.id}>{g.parwestId} - {g.name}</option>
            ))}
          </select>
          <input className="ui-input" type="date" value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))} />
          <input className="ui-input" type="number" placeholder="Hours" value={form.hours} onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))} />
          <input className="ui-input" type="number" placeholder="Rate" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} />
        </div>
        <div className="mt-4 flex justify-end">
          <ActionButton onClick={submit}>Submit</ActionButton>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[900px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Month</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Hours</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No records.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.guard?.parwestId} - {row.guard?.name}</td>
                  <td className="px-4 py-3 text-sm">{new Date(row.month).toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-sm">{row.specialDutyHours || 0}</td>
                  <td className="px-4 py-3 text-sm">{(row.specialDutyAmount || 0).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
