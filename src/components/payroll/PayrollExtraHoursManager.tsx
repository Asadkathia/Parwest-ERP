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
  extraHours: number
  extraHoursAmount: number
  guard: { id: string; name: string; parwestId: string }
}

type Client = { id: string; name: string }
type Branch = { id: string; name: string; clientId: string }

export default function PayrollExtraHoursManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [hours, setHours] = useState("")
  const [rate, setRate] = useState("")
  const [selectClientId, setSelectClientId] = useState("")
  const [selectBranchId, setSelectBranchId] = useState("")
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    if (search) params.set("search", search)
    try {
      const res = await fetch(`/api/payroll/extra-hours?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRows(await res.json())
    } catch (e) {
      setFetchError((e as Error).message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [month, search])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  useEffect(() => {
    if (!formOpen) return
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.clients ?? data.rows ?? []
        setClients(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
  }, [formOpen])

  useEffect(() => {
    if (!selectClientId) {
      setBranches([])
      return
    }
    fetch(`/api/branches?clientId=${selectClientId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches ?? data.rows ?? []
        setBranches(list)
      })
      .catch(() => {})
  }, [selectClientId])

  const handleGuardSelect = async (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    const res = await fetch(`/api/guards/${opt.id}/current-context?month=${month}`)
    if (res.ok) setContext(await res.json())
  }

  const resetForm = () => {
    setParwestIdInput("")
    setContext(null)
    setHours("")
    setRate("")
    setSelectClientId("")
    setSelectBranchId("")
    setResult(null)
  }

  const submit = async () => {
    if (!context || !hours || !rate) return
    setSaving(true)
    setResult(null)
    const res = await fetch("/api/payroll/extra-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guardId: context.guardId,
        month: `${month}-01`,
        hours: Number(hours),
        rate: Number(rate),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setResult(`Saved for ${context.name}.`)
      resetForm()
      setFormOpen(false)
      loadRows()
    } else {
      setResult(`Error: ${data.error ?? "Failed."}`)
    }
  }

  return (
    <PayrollPageShell
      title="Payroll — Extra Hours"
      subtitle="Record monthly extra-hour adjustments per guard."
      actions={<ActionButton onClick={() => setFormOpen(true)}>+ Add Extra Hours</ActionButton>}
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

        {fetchError && (
          <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
            Failed to load extra-hours records: {fetchError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Parwest ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No records.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono">{r.guard.parwestId}</td>
                  <td className="px-3 py-2">{r.guard.name}</td>
                  <td className="px-3 py-2">{r.month.slice(0, 7)}</td>
                  <td className="px-3 py-2 text-right">{r.extraHours}</td>
                  <td className="px-3 py-2 text-right">{r.extraHoursAmount?.toFixed(0) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ui-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Extra Hours</h2>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Hours *
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Rate *
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
            </div>

            <GuardContextFields
              context={context}
              showRows={["name", "status", "type", "location"]}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Select Client
                </label>
                <select
                  className="ui-select"
                  value={selectClientId}
                  onChange={(e) => {
                    setSelectClientId(e.target.value)
                    setSelectBranchId("")
                  }}
                >
                  <option value="">--Select Client--</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Select Branch
                </label>
                <select
                  className="ui-select"
                  value={selectBranchId}
                  onChange={(e) => setSelectBranchId(e.target.value)}
                  disabled={!selectClientId}
                >
                  <option value="">--Select Branch--</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Month
                </label>
                <input type="month" className="ui-input" value={month} readOnly />
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
                <ActionButton onClick={submit} disabled={!context || !hours || !rate || saving}>
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
