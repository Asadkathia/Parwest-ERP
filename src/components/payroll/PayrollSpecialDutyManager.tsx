"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import GuardAutocomplete from "@/components/payroll/shared/GuardAutocomplete"
import GuardContextFields from "@/components/payroll/shared/GuardContextFields"
import Base64FileUpload from "@/components/payroll/shared/Base64FileUpload"
import type { GuardCurrentContext } from "@/lib/guards/currentContext"

type Row = {
  id: string
  dateFrom: string
  dateTo: string
  hours: number
  hourRate: number
  amount: number
  comments: string | null
  attachmentBase64: string | null
  status: string
  guard: { id: string; parwestId: string; name: string }
}

export default function PayrollSpecialDutyManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [hours, setHours] = useState("")
  const [hourRate, setHourRate] = useState("")
  const [comments, setComments] = useState("")
  const [attachment, setAttachment] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    const res = await fetch(`/api/payroll/special-duty-records?${params}`)
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch driven by filter deps via callback
    loadRows()
  }, [loadRows])

  const handleGuardSelect = async (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    const res = await fetch(`/api/guards/${opt.id}/current-context`)
    if (res.ok) setContext(await res.json())
  }

  const resetForm = () => {
    setParwestIdInput("")
    setContext(null)
    setDateFrom("")
    setDateTo("")
    setHours("")
    setHourRate("")
    setComments("")
    setAttachment(null)
    setResult(null)
  }

  const submit = async () => {
    if (!context || !dateFrom || !dateTo || !hours || !hourRate) return
    setSaving(true)
    setResult(null)
    const res = await fetch("/api/payroll/special-duty-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guardId: context.guardId,
        dateFrom,
        dateTo,
        hours: Number(hours),
        hourRate: Number(hourRate),
        comments: comments || null,
        attachmentBase64: attachment,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setResult("Saved.")
      resetForm()
      setFormOpen(false)
      loadRows()
    } else {
      setResult(`Error: ${data.error ?? "Failed."}`)
    }
  }

  const cancel = async (id: string) => {
    if (!confirm("Cancel this special duty record?")) return
    const res = await fetch(`/api/payroll/special-duty-records/${id}`, { method: "DELETE" })
    if (res.ok) loadRows()
  }

  return (
    <PayrollPageShell
      title="Payroll — Special Duty"
      subtitle="Record date-range special duty with attachment."
      actions={<ActionButton onClick={() => setFormOpen(true)}>+ Add Special Duty</ActionButton>}
    >
      <section className="ui-card p-4 space-y-4">
        <input
          className="ui-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Parwest ID or name"
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Secure Ops ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Date From</th>
                <th className="px-3 py-2 text-left">Date To</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Comments</th>
                <th className="px-3 py-2 text-left">File</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No records.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono">{r.guard.parwestId}</td>
                  <td className="px-3 py-2">{r.guard.name}</td>
                  <td className="px-3 py-2">{r.dateFrom.slice(0, 10)}</td>
                  <td className="px-3 py-2">{r.dateTo.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-right">{r.hours}</td>
                  <td className="px-3 py-2 text-right">{r.hourRate}</td>
                  <td className="px-3 py-2 text-right">{r.amount.toFixed(0)}</td>
                  <td className="px-3 py-2 text-xs">{r.comments ?? ""}</td>
                  <td className="px-3 py-2">
                    {r.attachmentBase64 ? (
                      <a
                        href={r.attachmentBase64}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--brand)] underline text-xs"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => cancel(r.id)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      Cancel
                    </button>
                  </td>
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
              <h2 className="text-lg font-semibold">Add Special Duty</h2>
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

            <GuardContextFields context={context} showRows={["name", "type", "status"]} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Date From *
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
                  Date To *
                </label>
                <input
                  type="date"
                  className="ui-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Hour *
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Hour Rate *
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={hourRate}
                  onChange={(e) => setHourRate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Amount
                </label>
                <input
                  className="ui-input bg-[var(--surface-muted)]"
                  value={hours && hourRate ? (Number(hours) * Number(hourRate)).toFixed(0) : "0"}
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Comments *
              </label>
              <textarea
                className="ui-textarea"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Attachment *
              </label>
              <Base64FileUpload
                value={attachment}
                onChange={setAttachment}
                accept="image/*,.pdf"
                label="Choose File"
                previewMode="link"
              />
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
                <ActionButton
                  onClick={submit}
                  disabled={!context || !dateFrom || !dateTo || !hours || !hourRate || saving}
                >
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
