"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardBody, CardHeader } from "@/components/ui/card"
import ActionButton from "@/components/ui/action-button"
import { cn } from "@/lib/utils"
import { BellOff, Bell, Save, RotateCcw } from "lucide-react"

type Severity = "HIGH" | "MEDIUM" | "LOW"

type InsightConfig = {
  key: string
  title: string
  description: string
  category: "EFFICIENCY" | "ANOMALY"
  defaultSeverity: Severity
  defaultThresholds: Record<string, number | string | boolean>
  thresholdDocs: Record<string, string>
  thresholds: Record<string, number | string | boolean>
  muted: boolean
  mutedUntil: string | null
  mutedReason: string | null
  severityOverride: Severity | null
}

export default function InsightsConfigManager() {
  const [rows, setRows] = useState<InsightConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/insights/config", { cache: "no-store" })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setRows(json.data.insights)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const efficiency = rows.filter((r) => r.category === "EFFICIENCY")
  const anomaly = rows.filter((r) => r.category === "ANOMALY")

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Insights Configuration"
        subtitle="Tune thresholds and muting for every dashboard insight."
      />
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <>
          <Section title="Efficiency" rows={efficiency} onSaved={load} />
          <Section title="Anomalies" rows={anomaly} onSaved={load} />
        </>
      )}
    </div>
  )
}

function Section({
  title,
  rows,
  onSaved,
}: {
  title: string
  rows: InsightConfig[]
  onSaved: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle title={title} subtitle={`${rows.length} insights`} />
      </CardHeader>
      <CardBody className="space-y-3">
        {rows.map((r) => (
          <InsightConfigRow key={r.key} row={r} onSaved={onSaved} />
        ))}
      </CardBody>
    </Card>
  )
}

function InsightConfigRow({ row, onSaved }: { row: InsightConfig; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [thresholds, setThresholds] = useState<Record<string, string>>(() => {
    const merged = { ...row.defaultThresholds, ...row.thresholds }
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(merged)) out[k] = String(v)
    return out
  })
  const [severity, setSeverity] = useState<Severity | "">(row.severityOverride ?? "")
  const [muted, setMuted] = useState(row.muted)
  const [mutedDays, setMutedDays] = useState<string>("")
  const [mutedReason, setMutedReason] = useState(row.mutedReason ?? "")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      // Cast thresholds back to their original numeric type where possible.
      const casted: Record<string, number | string | boolean> = {}
      for (const [k, v] of Object.entries(thresholds)) {
        const def = row.defaultThresholds[k]
        if (typeof def === "number") casted[k] = Number(v)
        else if (typeof def === "boolean") casted[k] = v === "true"
        else casted[k] = v
      }
      const res = await fetch("/api/insights/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: row.key,
          thresholds: casted,
          muted,
          mutedDays: muted && mutedDays ? Number(mutedDays) : null,
          mutedReason: muted ? mutedReason : null,
          severityOverride: severity === "" ? null : severity,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(row.defaultThresholds)) out[k] = String(v)
    setThresholds(out)
    setSeverity("")
    setMuted(false)
    setMutedDays("")
    setMutedReason("")
  }

  const sevColor =
    row.defaultSeverity === "HIGH"
      ? "bg-red-100 text-red-700"
      : row.defaultSeverity === "MEDIUM"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600"

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{row.title}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", sevColor)}>
              {row.severityOverride ?? row.defaultSeverity}
            </span>
            {row.muted ? (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                <BellOff className="h-3 w-3" />
                Muted
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{row.description}</p>
        </div>
        <span className="text-xs text-[var(--text-muted)]">{open ? "Hide" : "Edit"}</span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-[var(--border)] bg-[var(--surface-muted)] p-4">
          {Object.keys(row.defaultThresholds).length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Thresholds
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(row.defaultThresholds).map(([k, defVal]) => (
                  <label key={k} className="text-sm">
                    <span className="mb-1 block font-medium">{k}</span>
                    <input
                      className="ui-input"
                      value={thresholds[k] ?? ""}
                      onChange={(e) => setThresholds({ ...thresholds, [k]: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {row.thresholdDocs?.[k] ?? ""} Default: {String(defVal)}
                    </p>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">No tunable thresholds.</p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Severity override</span>
              <select
                className="ui-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity | "")}
              >
                <option value="">Default ({row.defaultSeverity})</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium">Mute</span>
              <select
                className="ui-select"
                value={muted ? "1" : "0"}
                onChange={(e) => setMuted(e.target.value === "1")}
              >
                <option value="0">Active</option>
                <option value="1">Muted</option>
              </select>
            </label>
          </div>

          {muted ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Mute days (blank = forever)</span>
                <input
                  className="ui-input"
                  type="number"
                  min={1}
                  value={mutedDays}
                  onChange={(e) => setMutedDays(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Mute reason</span>
                <input
                  className="ui-input"
                  value={mutedReason}
                  onChange={(e) => setMutedReason(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          {err ? <p className="rounded bg-red-50 p-2 text-xs text-red-700">{err}</p> : null}

          <div className="flex gap-2">
            <ActionButton onClick={save} disabled={saving}>
              <Save className="mr-1 inline h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </ActionButton>
            <ActionButton variant="secondary" onClick={reset} disabled={saving}>
              <RotateCcw className="mr-1 inline h-4 w-4" />
              Reset to defaults
            </ActionButton>
            {row.muted ? (
              <ActionButton
                variant="secondary"
                onClick={() => {
                  setMuted(false)
                  setTimeout(save, 0)
                }}
                disabled={saving}
              >
                <Bell className="mr-1 inline h-4 w-4" />
                Unmute now
              </ActionButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
