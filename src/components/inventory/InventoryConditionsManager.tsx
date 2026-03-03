"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type ConditionRow = {
  id: string
  name: string
  description?: string | null
  createdAt?: string
}

export default function InventoryConditionsManager() {
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback
  const [rows, setRows] = useState<ConditionRow[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await fetch("/api/inventory/conditions", { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to load conditions.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (error: unknown) {
      setRows([])
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to load conditions.") })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setName("")
    setDescription("")
    setEditingId(null)
  }

  const save = async () => {
    setNotice(null)
    if (!name.trim()) {
      setNotice({ type: "error", message: "Condition name is required." })
      return
    }
    setSaving(true)
    try {
      const response = await fetch(
        editingId ? `/api/inventory/conditions/${editingId}` : "/api/inventory/conditions",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to save condition.")
      setNotice({ type: "success", message: editingId ? "Condition updated." : "Condition created." })
      resetForm()
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to save condition.") })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setNotice(null)
    try {
      const response = await fetch(`/api/inventory/conditions/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete condition.")
      setNotice({ type: "success", message: "Condition deleted." })
      if (editingId === id) resetForm()
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to delete condition.") })
    }
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) => `${row.name} ${row.description || ""}`.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <SectionTitle title="Define Conditions" subtitle="Inventory item condition master data." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label="Condition Name *" value={name} onChange={setName} placeholder="NEW / USED / DAMAGED" />
          <Input label="Description" value={description} onChange={setDescription} placeholder="Optional description" />
          <Input label="Search" value={search} onChange={setSearch} placeholder="Search conditions" />
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</ActionButton>
          <ActionButton variant="secondary" onClick={resetForm}>Reset</ActionButton>
          <ActionButton variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={filteredRows}
        columns={[
          { key: "name", header: "Condition", sortable: true },
          { key: "description", header: "Description", render: (row) => row.description || "—" },
          {
            key: "edit",
            header: "Edit",
            render: (row) => (
              <button
                className="text-[var(--brand)] hover:underline"
                onClick={() => {
                  setEditingId(row.id)
                  setName(row.name)
                  setDescription(row.description || "")
                }}
              >
                Edit
              </button>
            ),
          },
          {
            key: "delete",
            header: "Delete",
            render: (row) => (
              <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>
                Delete
              </button>
            ),
          },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading conditions..." : "No conditions found."}
      />
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}
