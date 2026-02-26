"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"

type RoleOption = { id: string; name: string }
type UserRow = {
  id: string
  name: string
  email: string
  status: string
  createdAt: string
  role?: { id: string; name: string } | null
  regionalOffice?: { id: string; name: string } | null
}

export default function UserSearchManager() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [search, setSearch] = useState("")
  const [roleId, setRoleId] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      if (roleId) params.set("roleId", roleId)
      if (status) params.set("status", status)

      const response = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to fetch users.")
      }
      setRows(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to fetch users.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadDependencies() {
      try {
        const response = await fetch("/api/roles", { cache: "no-store" })
        const payload = await response.json().catch(() => [])
        if (!response.ok) return
        if (!cancelled) {
          setRoles(Array.isArray(payload) ? payload : [])
        }
      } catch {
        // no-op: search works without role options
      }
    }
    void loadDependencies()
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const rowsForExport = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role?.name || "—",
        office: row.regionalOffice?.name || "—",
        status: row.status,
      })),
    [rows]
  )

  return (
    <div className="space-y-6">
      <SectionTitle title="Search Users" subtitle="Search and filter users from backend data." />
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Search" value={search} onChange={setSearch} placeholder="Name or email" />
          <SelectField
            label="User Role"
            value={roleId}
            onChange={setRoleId}
            options={roles.map((role) => ({ value: role.id, label: role.name }))}
            placeholder="-- Select User Role --"
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            placeholder="-- Select Status --"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={load} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => {
              setSearch("")
              setRoleId("")
              setStatus("")
              void load()
            }}
          >
            Clear
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => {
              const blob = new Blob([JSON.stringify(rowsForExport, null, 2)], { type: "application/json" })
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = `users-export-${Date.now()}.json`
              link.click()
              URL.revokeObjectURL(url)
            }}
          >
            Export
          </ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={rows}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "email", header: "Email", sortable: true },
          { key: "role", header: "Role", render: (row) => row.role?.name || "—", sortable: true },
          { key: "regionalOffice", header: "Regional Office", render: (row) => row.regionalOffice?.name || "—", sortable: true },
          {
            key: "status",
            header: "Status",
            sortable: true,
            render: (row) => (
              <StatusChip
                label={row.status}
                variant={String(row.status).toUpperCase() === "ACTIVE" ? "success" : "warning"}
              />
            ),
          },
          {
            key: "createdAt",
            header: "Created",
            sortable: true,
            render: (row) => new Date(row.createdAt).toLocaleDateString("en-US"),
          },
        ]}
        rowKey="id"
        emptyText={loading ? "Loading users..." : "No users found."}
        searchable={false}
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
