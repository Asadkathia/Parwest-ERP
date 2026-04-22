"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import DeductionsManager from "./deductions-manager"

type Office = { id: string; name: string }
type DefaultRow = {
  id: string
  regionalOfficeId: string | null
  trainingSchoolFeeTotal: number
  trainingSchoolFeeMonthly: number
  cwfDeduction: number
  spBrVerAgeLimit: number | null
  spBrVerDays: number | null
  spBrVerAmount: number | null
  createdByName: string | null
  createdAt: string
}

type TabId =
  | "defaults"
  | "deductions"
  | "month-init"
  | "age-limit"
  | "mental-health"
  | "ojt"
  | "status-update"

export default function PayrollSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("defaults")

  return (
    <PayrollPageShell
      title="Payroll — Settings"
      subtitle="Regional payroll defaults, month init, limits."
      tabs={[
        { id: "defaults", label: "Payroll Defaults" },
        { id: "deductions", label: "Default Deductions" },
        { id: "month-init", label: "Month Initialise" },
        { id: "age-limit", label: "Guard Age Limit" },
        { id: "mental-health", label: "Mental Health Limit" },
        { id: "ojt", label: "OJT Settings" },
        { id: "status-update", label: "Guard Status Update" },
      ]}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as TabId)}
    >
      {activeTab === "defaults" && <PayrollDefaultsTab />}
      {activeTab === "deductions" && <DeductionsManager />}
      {activeTab === "age-limit" && <GuardAgeLimitTab />}
      {activeTab === "month-init" && (
        <PlaceholderTab
          tab={activeTab}
          note="Initialise payroll rows for the current/next month across regions. Requires product decisions on: which regions are auto-initialised, how to surface 'unposted' regions, and whether to auto-populate from deployments."
        />
      )}
      {activeTab === "mental-health" && (
        <PlaceholderTab
          tab={activeTab}
          note="Limit threshold for mental-health-related guard flagging. No schema or screenshot yet — please share the legacy screen."
        />
      )}
      {activeTab === "ojt" && (
        <PlaceholderTab
          tab={activeTab}
          note="On-Job Training configuration. Related models exist (Training / GuardCourse) but settings fields weren't captured in screenshots."
        />
      )}
      {activeTab === "status-update" && (
        <PlaceholderTab
          tab={activeTab}
          note="Bulk guard status update tool. Scope: select guards by filter, change status (ACTIVE/INACTIVE/BLACKLISTED), audit trail."
        />
      )}
    </PayrollPageShell>
  )
}

function PlaceholderTab({ tab, note }: { tab: string; note: string }) {
  return (
    <div className="ui-card p-6">
      <h3 className="font-semibold capitalize mb-2">{tab.replace(/-/g, " ")}</h3>
      <p className="text-sm text-[var(--text-muted)]">{note}</p>
    </div>
  )
}

function GuardAgeLimitTab() {
  const [minAge, setMinAge] = useState("")
  const [maxAge, setMaxAge] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/guard-age-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setMinAge(String(data.minAge ?? ""))
          setMaxAge(String(data.maxAge ?? ""))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setResult(null)
    const res = await fetch("/api/guard-age-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minAge: Number(minAge), maxAge: Number(maxAge) }),
    })
    setSaving(false)
    if (res.ok) {
      setResult("Saved.")
    } else {
      const data = await res.json().catch(() => null)
      setResult(`Error: ${data?.error ?? "Failed."}`)
    }
  }

  return (
    <div className="ui-card p-6 space-y-4 max-w-xl">
      <h3 className="font-semibold">Guard Age Limit</h3>
      <p className="text-sm text-[var(--text-muted)]">
        Age thresholds applied when creating or editing guards. Outside-range guards require
        explicit approval.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Minimum Age
              </label>
              <input
                type="number"
                className="ui-input"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Maximum Age
              </label>
              <input
                type="number"
                className="ui-input"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            {result && <span className="text-sm mr-2">{result}</span>}
            <ActionButton
              onClick={save}
              disabled={saving || !minAge || !maxAge || Number(minAge) >= Number(maxAge)}
            >
              {saving ? "Saving…" : "Save"}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  )
}

function PayrollDefaultsTab() {
  const [rows, setRows] = useState<DefaultRow[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [regionalOfficeId, setRegionalOfficeId] = useState("")
  const [trainingTotal, setTrainingTotal] = useState("")
  const [trainingMonthly, setTrainingMonthly] = useState("")
  const [cwf, setCwf] = useState("")
  const [ageLimit, setAgeLimit] = useState("")
  const [days, setDays] = useState("")
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/payroll/defaults")
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch populates settings state
    load()
    fetch("/api/regional-offices")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.offices ?? data.rows ?? []
        setOffices(list.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })))
      })
      .catch(() => {})
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setRegionalOfficeId("")
    setTrainingTotal("")
    setTrainingMonthly("")
    setCwf("")
    setAgeLimit("")
    setDays("")
    setAmount("")
    setResult(null)
    setFormOpen(true)
  }

  const openEdit = (row: DefaultRow) => {
    setEditingId(row.id)
    setRegionalOfficeId(row.regionalOfficeId ?? "")
    setTrainingTotal(String(row.trainingSchoolFeeTotal))
    setTrainingMonthly(String(row.trainingSchoolFeeMonthly))
    setCwf(String(row.cwfDeduction))
    setAgeLimit(row.spBrVerAgeLimit != null ? String(row.spBrVerAgeLimit) : "")
    setDays(row.spBrVerDays != null ? String(row.spBrVerDays) : "")
    setAmount(row.spBrVerAmount != null ? String(row.spBrVerAmount) : "")
    setResult(null)
    setFormOpen(true)
  }

  const reset = () => {
    setTrainingTotal("")
    setTrainingMonthly("")
    setCwf("")
    setAgeLimit("")
    setDays("")
    setAmount("")
  }

  const submit = async () => {
    setSaving(true)
    setResult(null)
    const payload = {
      regionalOfficeId: regionalOfficeId || null,
      trainingSchoolFeeTotal: Number(trainingTotal || 0),
      trainingSchoolFeeMonthly: Number(trainingMonthly || 0),
      cwfDeduction: Number(cwf || 0),
      spBrVerAgeLimit: ageLimit === "" ? null : Number(ageLimit),
      spBrVerDays: days === "" ? null : Number(days),
      spBrVerAmount: amount === "" ? null : Number(amount),
    }
    const url = editingId ? `/api/payroll/defaults/${editingId}` : "/api/payroll/defaults"
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      setResult("Saved.")
      setFormOpen(false)
      load()
    } else {
      const data = await res.json().catch(() => null)
      setResult(`Error: ${data?.error ?? "Failed."}`)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this defaults row?")) return
    const res = await fetch(`/api/payroll/defaults/${id}`, { method: "DELETE" })
    if (res.ok) load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Payroll Defaults</h3>
        <ActionButton onClick={openCreate}>+ Add Defaults</ActionButton>
      </div>

      <div className="ui-card p-4 overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">Region</th>
              <th className="px-3 py-2 text-right">Training School Fee</th>
              <th className="px-3 py-2 text-right">CWF</th>
              <th className="px-3 py-2 text-right">SP-BR-VER Age</th>
              <th className="px-3 py-2 text-right">SP-BR-VER Days</th>
              <th className="px-3 py-2 text-right">SP-BR-VER Amount</th>
              <th className="px-3 py-2 text-left">Created By</th>
              <th className="px-3 py-2 text-left">Action</th>
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
                  No defaults configured.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const office = offices.find((o) => o.id === r.regionalOfficeId)
              return (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{office?.name ?? (r.regionalOfficeId ?? "All")}</td>
                  <td className="px-3 py-2 text-right">{r.trainingSchoolFeeMonthly}</td>
                  <td className="px-3 py-2 text-right">{r.cwfDeduction}</td>
                  <td className="px-3 py-2 text-right">{r.spBrVerAgeLimit ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.spBrVerDays ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.spBrVerAmount ?? "—"}</td>
                  <td className="px-3 py-2">{r.createdByName ?? "—"}</td>
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

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ui-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Payroll Defaults" : "Add Payroll Defaults"}
              </h2>
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
                  Firing/Training Fee Total
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={trainingTotal}
                  onChange={(e) => setTrainingTotal(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Firing/Training Fee Monthly
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={trainingMonthly}
                  onChange={(e) => setTrainingMonthly(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  CWF Deduction
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={cwf}
                  onChange={(e) => setCwf(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  SP-BR-VER Age Limit (&lt;)
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={ageLimit}
                  onChange={(e) => setAgeLimit(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  SP-BR-VER Days (&gt;)
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                SP-BR-VER Deduction Amount
              </label>
              <input
                type="number"
                className="ui-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <p className="text-xs text-red-500">
              PLEASE ENTER VALUE OR &quot;0 (ZERO)&quot; FOR ALL INPUTS.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              {result && <span className="text-sm mr-2">{result}</span>}
              <ActionButton variant="secondary" onClick={reset}>
                Reset
              </ActionButton>
              <ActionButton onClick={submit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
