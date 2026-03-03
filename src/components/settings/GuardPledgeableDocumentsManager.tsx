"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type DocumentRow = {
  id: string
  name: string
  description?: string | null
  createdAt?: string
}

export default function GuardPledgeableDocumentsManager() {
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback
  const [rows, setRows] = useState<DocumentRow[]>([])
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
      const response = await fetch("/api/guard-pledgeable-documents", { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to load document types.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (error: unknown) {
      setRows([])
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to load document types.") })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reset = () => {
    setEditingId(null)
    setName("")
    setDescription("")
  }

  const save = async () => {
    setNotice(null)
    if (!name.trim()) {
      setNotice({ type: "error", message: "Document type name is required." })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(
        editingId ? `/api/guard-pledgeable-documents/${editingId}` : "/api/guard-pledgeable-documents",
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
      if (!response.ok) throw new Error(payload?.message || "Failed to save document type.")
      setNotice({ type: "success", message: editingId ? "Document type updated." : "Document type created." })
      reset()
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to save document type.") })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setNotice(null)
    try {
      const response = await fetch(`/api/guard-pledgeable-documents/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete document type.")
      setNotice({ type: "success", message: "Document type deleted." })
      if (editingId === id) reset()
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to delete document type.") })
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) => `${row.name} ${row.description || ""}`.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings: Guard Pledgeable Document Types" subtitle="Manage document types accepted in guard pledges." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Document Type *</label>
            <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Document type" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
            <input className="ui-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
            <input className="ui-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search types" />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</ActionButton>
          <ActionButton variant="secondary" onClick={reset}>Reset</ActionButton>
          <ActionButton variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={filtered}
        columns={[
          { key: "name", header: "Document Type", sortable: true },
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
        emptyText={loading ? "Loading document types..." : "No document types found."}
      />
    </div>
  )
}
