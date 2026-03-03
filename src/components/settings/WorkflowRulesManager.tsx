"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import SectionTitle from "@/components/ui/section-title"

type WorkflowRule = {
  key: string
  value: boolean
  defaultValue: boolean
  envOverrideKey: string
}

type WorkflowPreset = {
  id: string
  label: string
  description: string
}

type ApiPayload = {
  rules?: WorkflowRule[]
  presets?: WorkflowPreset[]
  activePresetId?: string | null
  message?: string
}

export default function WorkflowRulesManager() {
  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [presets, setPresets] = useState<WorkflowPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>("")
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [applyingPreset, setApplyingPreset] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) || null

  const loadRules = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await fetch("/api/workflow-rules", { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load workflow rules.")
      }
      setRules(Array.isArray(payload.rules) ? payload.rules : [])
      const nextPresets = Array.isArray(payload.presets) ? payload.presets : []
      setPresets(nextPresets)
      setActivePresetId(typeof payload.activePresetId === "string" ? payload.activePresetId : null)
      setSelectedPresetId((prev) => prev || nextPresets[0]?.id || "")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load workflow rules."
      setRules([])
      setNotice({ type: "error", message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const toggleRule = async (rule: WorkflowRule) => {
    setSavingKey(rule.key)
    setNotice(null)
    try {
      const response = await fetch("/api/workflow-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            [rule.key]: !rule.value,
          },
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to update workflow rule.")
      }
      setRules(Array.isArray(payload.rules) ? payload.rules : [])
      setActivePresetId(typeof payload.activePresetId === "string" ? payload.activePresetId : null)
      setNotice({ type: "success", message: `${rule.key} updated.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update workflow rule."
      setNotice({ type: "error", message })
    } finally {
      setSavingKey(null)
    }
  }

  const resetToDefaults = async () => {
    setNotice(null)
    const updates: Record<string, boolean> = {}
    rules.forEach((rule) => {
      updates[rule.key] = rule.defaultValue
    })
    try {
      const response = await fetch("/api/workflow-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to reset workflow rules.")
      }
      setRules(Array.isArray(payload.rules) ? payload.rules : [])
      setActivePresetId(typeof payload.activePresetId === "string" ? payload.activePresetId : null)
      setNotice({ type: "success", message: "Workflow rules reset to defaults." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset workflow rules."
      setNotice({ type: "error", message })
    }
  }

  const applyPreset = async () => {
    if (!selectedPresetId) return
    setApplyingPreset(true)
    setNotice(null)
    try {
      const response = await fetch("/api/workflow-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: selectedPresetId }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiPayload
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to apply workflow preset.")
      }
      setRules(Array.isArray(payload.rules) ? payload.rules : [])
      setActivePresetId(typeof payload.activePresetId === "string" ? payload.activePresetId : null)
      setNotice({ type: "success", message: `Preset ${selectedPresetId} applied.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply workflow preset."
      setNotice({ type: "error", message })
    } finally {
      setApplyingPreset(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Workflow Rules"
        subtitle="Toggle workflow strictness without changing route code. Changes are persisted and applied immediately."
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-[var(--text-muted)]">
            <p>Rules here control deployment and inventory workflow behavior.</p>
            <p>Active preset: <span className="font-mono">{activePresetId || "custom"}</span></p>
          </div>
          <div className="flex gap-2">
            <ActionButton variant="secondary" onClick={() => void loadRules()} disabled={loading}>
              Refresh
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => void resetToDefaults()} disabled={loading || !rules.length}>
              Reset Defaults
            </ActionButton>
          </div>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <div>
            <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">Preset</label>
            <select
              className="ui-select"
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            {selectedPreset?.description ? (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {selectedPreset.description}
              </p>
            ) : null}
          </div>
          <div className="flex items-end">
            <ActionButton variant="secondary" onClick={() => void applyPreset()} disabled={!selectedPresetId || applyingPreset}>
              {applyingPreset ? "Applying..." : "Apply Preset"}
            </ActionButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Rule Key</th>
                <th className="px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Current</th>
                <th className="px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Default</th>
                <th className="px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Env Override Key</th>
                <th className="px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.key} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-sm font-mono">{rule.key}</td>
                  <td className="px-3 py-2 text-sm">{rule.value ? "enabled" : "disabled"}</td>
                  <td className="px-3 py-2 text-sm">{rule.defaultValue ? "enabled" : "disabled"}</td>
                  <td className="px-3 py-2 text-xs font-mono text-[var(--text-muted)]">{rule.envOverrideKey}</td>
                  <td className="px-3 py-2 text-sm">
                    <ActionButton
                      className="px-2 py-1 text-xs"
                      variant="secondary"
                      onClick={() => void toggleRule(rule)}
                      disabled={savingKey === rule.key}
                    >
                      {savingKey === rule.key ? "Saving..." : rule.value ? "Disable" : "Enable"}
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rules.length ? (
            <p className="p-3 text-sm text-[var(--text-muted)]">{loading ? "Loading workflow rules..." : "No workflow rules found."}</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
