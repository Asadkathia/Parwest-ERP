"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"

type Row = {
  id: string
  name: string
  date: string
  dateFrom: string | null
  dateTo: string | null
  regionalOfficeId: string | null
  valueType: "FIXED_PER_DAY" | "MULTIPLE_OF_RATE" | null
  value: number | null
  status: string | null
  comments: string | null
  notes: string | null
}

type Office = { id: string; name: string }

const VALUE_TYPES = [
  { id: "FIXED_PER_DAY", label: "Fixed per day amount" },
  { id: "MULTIPLE_OF_RATE", label: "Multiple of location Rate" },
] as const

export default function PayrollHolidaysManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [regionalOfficeId, setRegionalOfficeId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [valueType, setValueType] = useState<"FIXED_PER_DAY" | "MULTIPLE_OF_RATE">("MULTIPLE_OF_RATE")
  const [value, setValue] = useState("")
  const [status, setStatus] = useState("active")
  const [comments, setComments] = useState("")
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/payroll/holidays")
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch("/api/regional-offices")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.offices ?? data.rows ?? []
        setOffices(list.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })))
      })
      .catch(() => {})
  }, [load])

  const filteredRows = rows.filter((r) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(s) ||
      (r.comments ?? "").toLowerCase().includes(s)
    )
  })

  const openCreate = () => {
    setEditingId(null)
    setName("")
    setRegionalOfficeId("")
    setDateFrom("")
    setDateTo("")
    setValueType("MULTIPLE_OF_RATE")
    setValue("")
    setStatus("active")
    setComments("")
    setResult(null)
    setFormOpen(true)
  }

  const openEdit = (row: Row) => {
    setEditingId(row.id)
    setName(row.name ?? "")
    setRegionalOfficeId(row.regionalOfficeId ?? "")
    setDateFrom((row.dateFrom ?? row.date).slice(0, 10))
    setDateTo((row.dateTo ?? row.date).slice(0, 10))
    setValueType(row.valueType ?? "MULTIPLE_OF_RATE")
    setValue(row.value != null ? String(row.value) : "")
    setStatus(row.status ?? "active")
    setComments(row.comments ?? "")
    setResult(null)
    setFormOpen(true)
  }

  const submit = async () => {
    if (!dateFrom) return
    setSaving(true)
    setResult(null)
    const payload = {
      name: name || "Holiday",
      regionalOfficeId: regionalOfficeId || null,
      dateFrom,
      dateTo: dateTo || dateFrom,
      valueType,
      value: value === "" ? null : Number(value),
      status,
      comments: comments || null,
    }
    const url = editingId ? `/api/payroll/holidays/${editingId}` : "/api/payroll/holidays"
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setResult("Saved.")
      setFormOpen(false)
      load()
    } else {
      setResult(`Error: ${data.error ?? "Failed."}`)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this holiday?")) return
    const res = await fetch(`/api/payroll/holidays/${id}`, { method: "DELETE" })
    if (res.ok) load()
  }

  return (
    <PayrollPageShell
      title="Payroll — Holidays"
      subtitle="Regional holidays with fixed or rate-multiple payouts."
      actions={<ActionButton onClick={openCreate}>+ Add Holiday</ActionButton>}
    >
      <section className="ui-card p-4 space-y-4">
        <input
          className="ui-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or comments"
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Regional Office</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-left">From</th>
                <th className="px-3 py-2 text-left">To</th>
                <th className="px-3 py-2 text-left">Comments</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No holidays.
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => {
                const office = offices.find((o) => o.id === r.regionalOfficeId)
                return (
                  <tr key={r.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{office?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.valueType === "FIXED_PER_DAY"
                        ? "Fixed"
                        : r.valueType === "MULTIPLE_OF_RATE"
                          ? "Multiple of Rate"
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{r.value ?? ""}</td>
                    <td className="px-3 py-2">{(r.dateFrom ?? r.date).slice(0, 10)}</td>
                    <td className="px-3 py-2">{(r.dateTo ?? r.date).slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs">{r.comments ?? r.notes ?? ""}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "active"
                            ? "text-green-600 font-medium"
                            : "text-[var(--text-muted)]"
                        }
                      >
                        {r.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 space-x-2">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-[var(--brand)] hover:underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-red-500 hover:underline text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ui-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Holiday" : "Add Holidays"}</h2>
              <button
                type="button"
                className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]"
                onClick={() => setFormOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Regional Office
                </label>
                <select
                  className="ui-select"
                  value={regionalOfficeId}
                  onChange={(e) => setRegionalOfficeId(e.target.value)}
                >
                  <option value="">All / None</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  From *
                </label>
                <input
                  type="date"
                  className="ui-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  To
                </label>
                <input
                  type="date"
                  className="ui-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                Value Type *
              </label>
              <div className="flex gap-6">
                {VALUE_TYPES.map((vt) => (
                  <label key={vt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="valueType"
                      value={vt.id}
                      checked={valueType === vt.id}
                      onChange={() => setValueType(vt.id)}
                      className="accent-[var(--brand)]"
                    />
                    {vt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Value
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Status
                </label>
                <select
                  className="ui-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Name
                </label>
                <input
                  className="ui-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Holiday name"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Comments
              </label>
              <textarea
                className="ui-textarea"
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              {result && <span className="text-sm">{result}</span>}
              <div className="ml-auto flex gap-2">
                <ActionButton variant="secondary" onClick={() => setFormOpen(false)}>
                  Cancel
                </ActionButton>
                <ActionButton onClick={submit} disabled={!dateFrom || saving}>
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
