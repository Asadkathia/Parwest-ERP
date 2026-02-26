"use client"

import { useEffect, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import { Checkbox } from "@/components/ui/form-controls"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"

const modules = [
  "GUARDS",
  "PAYROLL",
  "INVENTORY",
  "USERS",
  "CLIENTS",
  "TICKETING",
  "SETTINGS",
  "REPORTS",
  "IMPORTS",
  "REQUISITIONS",
  "AUDIT",
]

const actions = ["CREATE", "VIEW", "UPDATE", "DELETE", "REQUISITIONS"] as const

type ActionName = (typeof actions)[number]

type PermissionMap = Record<ActionName, boolean>

type UserRow = {
  id: string
  name: string
  email: string
}

type PermissionRow = {
  moduleName: string
}

function emptyMap(): PermissionMap {
  return { CREATE: false, VIEW: false, UPDATE: false, DELETE: false, REQUISITIONS: false }
}

export default function UserPermissionsManager() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [selectedUser, setSelectedUser] = useState("")
  const [values, setValues] = useState<Record<string, PermissionMap>>({})
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      try {
        const response = await fetch("/api/users", { cache: "no-store" })
        const payload = await response.json().catch(() => [])
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to fetch users.")
        }
        const mapped = (Array.isArray(payload) ? payload : []).map((user: any) => ({
          id: String(user.id),
          name: String(user.name || "Unnamed"),
          email: String(user.email || ""),
        }))

        if (cancelled) return
        setUsers(mapped)
        if (mapped.length > 0) {
          setSelectedUser(mapped[0].id)
        }
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : "Failed to fetch users.")
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedUser) return

    let cancelled = false
    async function loadPermissions() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/user-permissions?userId=${selectedUser}`, { cache: "no-store" })
        const payload = await response.json().catch(() => [])
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to fetch permissions.")
        }

        const nextValues: Record<string, PermissionMap> = Object.fromEntries(
          modules.map((module) => [module, emptyMap()])
        )

        for (const row of Array.isArray(payload) ? payload : []) {
          const module = String(row.module || "").toUpperCase()
          if (!nextValues[module]) continue
          nextValues[module] = {
            CREATE: Boolean(row.canCreate),
            VIEW: Boolean(row.canView),
            UPDATE: Boolean(row.canUpdate),
            DELETE: Boolean(row.canDelete),
            REQUISITIONS: Boolean(row.canRequisition),
          }
        }

        if (!cancelled) {
          setValues(nextValues)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to fetch permissions.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPermissions()
    return () => {
      cancelled = true
    }
  }, [selectedUser])

  const visibleModules = useMemo(() => {
    if (!query) return modules
    return modules.filter((module) => module.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  const rows = useMemo<PermissionRow[]>(
    () => visibleModules.map((moduleName) => ({ moduleName })),
    [visibleModules]
  )

  const selectedUserName = useMemo(
    () => users.find((user) => user.id === selectedUser)?.name || "No user selected",
    [users, selectedUser]
  )

  const toggle = (moduleName: string, actionName: ActionName) => {
    setValues((prev) => ({
      ...prev,
      [moduleName]: {
        ...(prev[moduleName] || emptyMap()),
        [actionName]: !(prev[moduleName]?.[actionName] || false),
      },
    }))
  }

  const save = async () => {
    if (!selectedUser) return
    setSaving(true)
    setNotice("")
    setError("")
    try {
      const permissions = modules.map((module) => {
        const map = values[module] || emptyMap()
        return {
          module,
          canCreate: map.CREATE,
          canView: map.VIEW,
          canUpdate: map.UPDATE,
          canDelete: map.DELETE,
          canRequisition: map.REQUISITIONS,
        }
      })

      const response = await fetch("/api/user-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser, permissions }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to save permissions.")
      }
      setNotice("Permissions saved successfully.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save permissions.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Permissions Management"
        subtitle="Module permissions: CREATE, VIEW, UPDATE, DELETE, REQUISITIONS."
        action={<StatusChip label={selectedUserName} variant="neutral" />}
      />
      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select User</label>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="ui-select">
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search Module</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="ui-input" placeholder="Search module" />
          </div>
        </div>

        <div className="flex gap-2">
          <ActionButton onClick={save} disabled={saving || loading || !selectedUser}>
            {saving ? "Saving..." : "Save Permissions"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => setQuery("")}>
            Reset
          </ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={rows}
        columns={[
          { key: "moduleName", header: "Module", sortable: true, render: (row) => <span className="font-medium">{row.moduleName}</span> },
          ...actions.map((action) => ({
            key: action,
            header: action,
            render: (row: PermissionRow) => (
              <Checkbox
                checked={Boolean(values[row.moduleName]?.[action])}
                onChange={() => toggle(row.moduleName, action)}
              />
            ),
          })),
        ]}
        rowKey="moduleName"
        searchable={false}
        stickyHeader
        emptyText={loading ? "Loading modules..." : "No modules found."}
      />
    </div>
  )
}
