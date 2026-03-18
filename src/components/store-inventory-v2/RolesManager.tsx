"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Role = {
  id: string
  name: string
  description?: string | null
}

const EMPTY_FORM = {
  name: "",
  description: "",
}

export default function RolesManager() {
  const [rows, setRows] = useState<Role[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const data = await apiGet<Role[]>("/api/roles")
      setRows(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load roles."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => `${row.name} ${row.description || ""}`.toLowerCase().includes(q))
  }, [rows, query])

  const createRole = async () => {
    const name = form.name.trim()
    if (!name) {
      setNotice({ type: "error", message: "Role name is required." })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      await apiSend<Role>("/api/roles", "POST", {
        name,
        description: form.description.trim() || null,
      })
      setNotice({ type: "success", message: "Role created successfully." })
      setForm(EMPTY_FORM)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create role."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Roles" subtitle="Manage inventory role definitions used by inventory users." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Role Name *</label>
            <input
              className="ui-input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
            <input
              className="ui-input"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={() => void createRole()} disabled={saving}>
            {saving ? "Saving..." : "Create Role"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => setForm(EMPTY_FORM)}>
            Reset
          </ActionButton>
        </div>
      </FilterBar>

      <FilterBar>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
          <input
            className="ui-input"
            placeholder="Search by role name or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </FilterBar>

      <DataTable
        rows={visibleRows}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading roles..." : "No roles found."}
        columns={[
          { key: "name", header: "Role Name", sortable: true },
          { key: "description", header: "Description", render: (row) => row.description || "—" },
        ]}
      />
    </div>
  )
}
