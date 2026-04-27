"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import GuardAutocomplete from "@/components/payroll/shared/GuardAutocomplete"
import PayrollStateBadge from "@/components/payroll/PayrollStateBadge"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type Row = {
  id: string
  month: string
  netSalary: number
  paymentStatus: string
  paymentRemarks: string | null
  paymentUpdatedAt: string | null
  state?: string | null
  holdReason?: string | null
  emergencyReleaseReason?: string | null
  guard: { id: string; parwestId: string; name: string }
}

type Region = { id: string; name: string }

type PayrollUnpaidSalariesManagerProps = {
  canUpdate?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}

export default function PayrollUnpaidSalariesManager({
  canUpdate = false,
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: PayrollUnpaidSalariesManagerProps = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState("")

  const [parwestIdInput, setParwestIdInput] = useState("")
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [date, setDate] = useState("")
  const [newStatus, setNewStatus] = useState("")
  const [remarks, setRemarks] = useState("")
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    if (search) params.set("search", search)
    if (effectiveRegionId) params.set("regionId", effectiveRegionId)
    const res = await fetch(`/api/payroll/unpaid?${params}`)
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [month, search, effectiveRegionId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch driven by filter deps via callback
    loadRows()
  }, [loadRows])

  const handleGuardSelect = async (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    // Look up unpaid row for this guard in current month
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    params.set("guardId", opt.id)
    if (effectiveRegionId) params.set("regionId", effectiveRegionId)
    const res = await fetch(`/api/payroll/salary?${params}`)
    if (res.ok) {
      const all: Row[] = await res.json()
      const row = all.find((r) => r.paymentStatus !== "PAID") ?? all[0] ?? null
      setSelectedRow(row)
    }
  }

  const submit = async () => {
    if (!selectedRow || !newStatus || !remarks) return
    setSaving(true)
    setResult(null)
    const res = await fetch(`/api/payroll/salary/${selectedRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentStatus: newStatus.toUpperCase(),
        paymentRemarks: remarks,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setResult("Updated.")
      setParwestIdInput("")
      setSelectedRow(null)
      setDate("")
      setNewStatus("")
      setRemarks("")
      loadRows()
    } else {
      setResult(`Error: ${data.error ?? "Failed."}`)
    }
  }

  return (
    <PayrollPageShell
      title="Payroll — Unpaid Salaries"
      subtitle="Update unpaid salary status for a guard and record remarks."
    >
      <section className="ui-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Parwest ID *
            </label>
            <GuardAutocomplete
              value={parwestIdInput}
              onChange={setParwestIdInput}
              onSelect={handleGuardSelect}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Name
            </label>
            <input
              className="ui-input bg-[var(--surface-muted)]"
              value={selectedRow?.guard.name ?? ""}
              readOnly
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Salary Status
            </label>
            <input
              className="ui-input bg-[var(--surface-muted)]"
              value={selectedRow?.paymentStatus ?? ""}
              readOnly
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Date *
            </label>
            <input
              type="date"
              className="ui-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Change Status *
            </label>
            <select
              className="ui-select"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="">Select Status</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Remarks *
            </label>
            <input
              className="ui-input"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          {result && <span className="text-sm">{result}</span>}
          {canUpdate && (
            <div className="ml-auto">
              <ActionButton
                onClick={submit}
                disabled={!selectedRow || !newStatus || !remarks || saving}
              >
                {saving ? "Updating…" : "Update"}
              </ActionButton>
            </div>
          )}
        </div>
      </section>

      <section className="ui-card p-4 mt-6 space-y-4">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="min-w-[180px]">
            <RegionUrlPicker
              regions={regions}
              locked={locked}
              includeGlobalOption={!locked}
            />
          </div>
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
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Secure Ops ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Salary Month</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-left">Dated</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="px-3 py-2 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No unpaid salaries.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono">{r.guard.parwestId}</td>
                  <td className="px-3 py-2">{r.guard.name}</td>
                  <td className="px-3 py-2">{r.month.slice(0, 7)}</td>
                  <td className="px-3 py-2 text-right">{r.netSalary?.toFixed(0) ?? 0}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.paymentUpdatedAt ? r.paymentUpdatedAt.slice(0, 10) : ""}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.paymentStatus === "PAID"
                          ? "text-green-600 font-medium"
                          : r.paymentStatus === "UNPAID"
                            ? "text-red-500"
                            : "text-[var(--text-muted)]"
                      }
                    >
                      {r.paymentStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.state ? (
                      <PayrollStateBadge
                        state={r.state}
                        reason={r.holdReason ?? r.emergencyReleaseReason ?? null}
                      />
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.paymentRemarks ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PayrollPageShell>
  )
}
