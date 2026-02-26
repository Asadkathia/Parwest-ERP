"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type RoleRow = {
  id: string
  name: string
  description?: string | null
  createdAt?: string
}

export default function UserTypesManager() {
  const [rows, setRows] = useState<RoleRow[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/roles", { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to load user types.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load user types.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visibleRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) => `${row.name} ${row.description || ""}`.toLowerCase().includes(q))
  }, [rows, search])

  const create = async () => {
    setNotice("")
    setError("")
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Role name is required.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, description: description.trim() || null }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create role.")
      setNotice("Role created.")
      setName("")
      setDescription("")
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create role.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings: User Types" subtitle="Manage roles such as Admin, Supervisor, and Manager." />
      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Role Name</label>
            <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
            <input className="ui-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
            <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search role" />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={create} disabled={saving}>
            {saving ? "Saving..." : "Create"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={visibleRows}
        columns={[
          { key: "name", header: "Role", sortable: true },
          { key: "description", header: "Description", render: (row) => row.description || "—" },
          { key: "createdAt", header: "Created At", render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-US") : "—"), sortable: true },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading user types..." : "No user types found."}
      />
    </div>
  )
}
