"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import GuardAutocomplete from "@/components/payroll/shared/GuardAutocomplete"
import GuardContextFields from "@/components/payroll/shared/GuardContextFields"
import type { GuardCurrentContext } from "@/lib/guards/currentContext"

type Row = {
  id: string
  month: string
  otherDeductions: number
  guard: { id: string; name: string; parwestId: string }
}

export default function PayrollOtherDeductionsManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [dated, setDated] = useState("")
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    if (search) params.set("search", search)
    const res = await fetch(`/api/payroll/other-deductions?${params}`)
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [month, search])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  const handleGuardSelect = async (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    const res = await fetch(`/api/guards/${opt.id}/current-context?month=${month}`)
    if (res.ok) setContext(await res.json())
  }

  const resetForm = () => {
    setParwestIdInput("")
    setContext(null)
    setDated("")
    setAmount("")
    setResult(null)
  }

  const submit = async () => {
    if (!context || !amount) return
    setSaving(true)
    setResult(null)
    const res = await fetch("/api/payroll/other-deductions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guardId: context.guardId,
        month: `${month}-01`,
        amount: Number(amount),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setResult(`Saved.`)
      resetForm()
      setFormOpen(false)
      loadRows()
    } else {
      setResult(`Error: ${data.error ?? "Failed."}`)
    }
  }

  return (
    <PayrollPageShell
      title="Payroll — Other Deductions"
      subtitle="Record ad-hoc deductions per guard per month."
      actions={<ActionButton onClick={() => setFormOpen(true)}>+ Add Deduction</ActionButton>}
    >
      <section className="ui-card p-4 space-y-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Month
            </label>
            <input
              type="month"
              className="ui-input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Search
            </label>
            <input
              className="ui-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Parwest ID or name"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Secure Ops ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No records.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono">{r.guard.parwestId}</td>
                  <td className="px-3 py-2">{r.guard.name}</td>
                  <td className="px-3 py-2">{r.month.slice(0, 7)}</td>
                  <td className="px-3 py-2 text-right">{r.otherDeductions?.toFixed(0) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ui-card w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Other Deductions</h2>
              <button
                type="button"
                className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]"
                onClick={() => {
                  setFormOpen(false)
                  resetForm()
                }}
              >
                ×
              </button>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Secure Ops ID *
              </label>
              <GuardAutocomplete
                value={parwestIdInput}
                onChange={setParwestIdInput}
                onSelect={handleGuardSelect}
              />
            </div>

            <GuardContextFields
              context={context}
              showRows={["name", "status", "type", "location"]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Dated
                </label>
                <input
                  type="date"
                  className="ui-input"
                  value={dated}
                  onChange={(e) => setDated(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {result && <span className="text-sm">{result}</span>}
              <div className="ml-auto flex gap-2">
                <ActionButton
                  variant="secondary"
                  onClick={() => {
                    setFormOpen(false)
                    resetForm()
                  }}
                >
                  Cancel
                </ActionButton>
                <ActionButton onClick={submit} disabled={!context || !amount || saving}>
                  {saving ? "Saving…" : "Save"}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </PayrollPageShell>
  )
}
