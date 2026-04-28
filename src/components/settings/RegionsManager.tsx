"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import { Button } from "@/components/shadcn/button"
import DataTable from "@/components/shared/DataTable"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"

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
      {notice ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

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
          <Button onClick={create} disabled={saving}>
            {saving ? "Saving..." : "Create"}
          </Button>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
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
