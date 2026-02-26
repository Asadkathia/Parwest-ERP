"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type RegionRow = {
  id: string
  name: string
  createdAt: string
}

export default function RegionsManager() {
  const [rows, setRows] = useState<RegionRow[]>([])
  const [name, setName] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/regions", { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to load regions.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load regions.")
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
    return rows.filter((row) => row.name.toLowerCase().includes(q))
  }, [rows, search])

  const create = async () => {
    setNotice("")
    setError("")
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Region name is required.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create region.")
      setNotice("Region created.")
      setName("")
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create region.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setNotice("")
    setError("")
    try {
      const response = await fetch(`/api/regions/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete region.")
      setNotice("Region deleted.")
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete region.")
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings: Regions" subtitle="Manage broad geographical regions." />
      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Region Name</label>
            <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Region name" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
            <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search region" />
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
          { key: "name", header: "Region", sortable: true },
          { key: "createdAt", header: "Created At", sortable: true, render: (row) => new Date(row.createdAt).toLocaleDateString("en-US") },
          {
            key: "action",
            header: "Action",
            render: (row) => (
              <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>
                Delete
              </button>
            ),
          },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading regions..." : "No regions found."}
      />
    </div>
  )
}
