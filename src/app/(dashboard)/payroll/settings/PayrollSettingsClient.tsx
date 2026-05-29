"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import DeductionsManager from "./deductions-manager"

type TabId =
  | "deductions"
  | "month-init"
  | "age-limit"
  | "mental-health"
  | "ojt"
  | "status-update"

type PayrollSettingsClientProps = {
  canCreate?: boolean
  canUpdate?: boolean
  canDelete?: boolean
}

export default function PayrollSettingsClient({
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}: PayrollSettingsClientProps = {}) {
  const [activeTab, setActiveTab] = useState<TabId>("deductions")

  return (
    <PayrollPageShell
      title="Payroll — Settings"
      subtitle="Regional payroll defaults, month init, limits."
      tabs={[
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
      {activeTab === "deductions" && (
        <DeductionsManager
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      )}
      {activeTab === "age-limit" && <GuardAgeLimitTab canUpdate={canUpdate} />}
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
          note="Bulk guard lifecycle status update tool. Scope: select guards by filter, change lifecycleStatus (ACTIVE/INACTIVE/TERMINATED), audit trail."
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

function GuardAgeLimitTab({ canUpdate = false }: { canUpdate?: boolean }) {
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
            {canUpdate && (
              <Button onClick={save} disabled={saving || !minAge || !maxAge || Number(minAge) >= Number(maxAge)}>
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
