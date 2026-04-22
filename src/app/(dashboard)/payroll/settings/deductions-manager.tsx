"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"

type DeductionType = {
  id: string
  code: string
  name: string
  description: string | null
  defaultAmount: number
  isActive: boolean
  sortOrder: number
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

type FormState = {
  code: string
  name: string
  description: string
  defaultAmount: string
  sortOrder: string
  isActive: boolean
}

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  description: "",
  defaultAmount: "0",
  sortOrder: "0",
  isActive: true,
}

async function readEnvelope<T>(res: Response): Promise<{ ok: boolean; data?: T; message?: string }> {
  try {
    const json = await res.json()
    if (json && typeof json === "object" && "success" in json) {
      if (json.success) return { ok: true, data: json.data as T }
      return { ok: false, message: json.message ?? "Request failed." }
    }
    // Fallback for raw responses
    if (res.ok) return { ok: true, data: json as T }
    return { ok: false, message: "Request failed." }
  } catch {
    return { ok: false, message: "Invalid server response." }
  }
}

export default function DeductionsManager() {
  const [rows, setRows] = useState<DeductionType[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/payroll/deduction-types")
    const env = await readEnvelope<DeductionType[]>(res)
    if (env.ok && env.data) setRows(env.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch
    load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setResult(null)
    setFormOpen(true)
  }

  const openEdit = (row: DeductionType) => {
    setEditingId(row.id)
    setForm({
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      defaultAmount: String(row.defaultAmount),
      sortOrder: String(row.sortOrder),
      isActive: row.isActive,
    })
    setResult(null)
    setFormOpen(true)
  }

  const submit = async () => {
    setSaving(true)
    setResult(null)
    const isEdit = Boolean(editingId)
    const url = isEdit
      ? `/api/payroll/deduction-types/${editingId}`
      : "/api/payroll/deduction-types"
    const method = isEdit ? "PATCH" : "POST"

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      defaultAmount: Number(form.defaultAmount || 0),
      sortOrder: Number(form.sortOrder || 0),
      isActive: form.isActive,
    }
    if (!isEdit) payload.code = form.code.trim().toUpperCase()

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const env = await readEnvelope<DeductionType>(res)
    setSaving(false)
    if (env.ok) {
      setResult("Saved.")
      setFormOpen(false)
      load()
    } else {
      setResult(`Error: ${env.message ?? "Failed."}`)
    }
  }

  const toggleActive = async (row: DeductionType) => {
    setBusyId(row.id)
    const res = await fetch(`/api/payroll/deduction-types/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    })
    const env = await readEnvelope<DeductionType>(res)
    setBusyId(null)
    if (env.ok) {
      load()
    } else {
      alert(env.message ?? "Failed to update.")
    }
  }

  const remove = async (row: DeductionType) => {
    if (
      !confirm(
        `Deactivate "${row.name}"? Existing payroll entries will be preserved. (To permanently delete, do so via the API only when no entries reference it.)`
      )
    )
      return
    setBusyId(row.id)
    const res = await fetch(`/api/payroll/deduction-types/${row.id}`, { method: "DELETE" })
    const env = await readEnvelope<{ deactivated?: boolean; deleted?: boolean }>(res)
    setBusyId(null)
    if (env.ok) {
      load()
    } else {
      alert(env.message ?? "Failed to delete.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Default Deductions</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Admin-managed deduction types applied to payroll. Codes are stable identifiers used by
            the calculation engine.
          </p>
        </div>
        <ActionButton onClick={openCreate}>+ Add Deduction</ActionButton>
      </div>

      <div className="ui-card p-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Default Amount</th>
              <th className="px-3 py-2 text-right">Sort</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  No deduction types configured.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{r.description ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.defaultAmount}</td>
                <td className="px-3 py-2 text-right">{r.sortOrder}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => toggleActive(r)}
                    className={
                      r.isActive
                        ? "text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                        : "text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }
                  >
                    {r.isActive ? "Active" : "Inactive"}
                  </button>
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
                    onClick={() => remove(r)}
                    disabled={busyId === r.id}
                    className="text-red-500 hover:underline text-xs"
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ui-card w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Deduction Type" : "Add Deduction Type"}
              </h2>
              <button
                type="button"
                className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]"
                onClick={() => setFormOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Code {editingId && <span className="text-[var(--text-muted)]">(immutable)</span>}
                </label>
                <input
                  type="text"
                  className="ui-input font-mono"
                  value={form.code}
                  disabled={Boolean(editingId)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="E.G. EOBI"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Uppercase letters, digits, underscores. Must start with a letter.
                </p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Name
                </label>
                <input
                  type="text"
                  className="ui-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Description
              </label>
              <textarea
                className="ui-input"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Default Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="ui-input"
                  value={form.defaultAmount}
                  onChange={(e) => setForm((f) => ({ ...f, defaultAmount: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  className="ui-input"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Active
                </label>
                <label className="inline-flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <span className="text-sm">Apply this deduction in payroll</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {result && <span className="text-sm mr-2">{result}</span>}
              <ActionButton variant="secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </ActionButton>
              <ActionButton
                onClick={submit}
                disabled={saving || !form.name.trim() || (!editingId && !form.code.trim())}
              >
                {saving ? "Saving…" : "Save"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
