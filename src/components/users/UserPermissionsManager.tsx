"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import { Checkbox } from "@/components/ui/form-controls"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import { ChevronDown, X } from "lucide-react"

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
type ApiUserRow = { id: string; name?: string | null; email?: string | null }

function emptyMap(): PermissionMap {
  return { CREATE: false, VIEW: false, UPDATE: false, DELETE: false, REQUISITIONS: false }
}

function UserSearchSelect({
  users,
  value,
  onChange,
}: {
  users: UserRow[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = users.find((u) => u.id === value)

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [users, search])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleOpen() {
    setOpen(true)
    setSearch("")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className="ui-select flex items-center justify-between gap-2 text-left w-full"
      >
        <span className={selected ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
          {selected ? `${selected.name} (${selected.email})` : "Select user..."}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="flex-1 bg-transparent text-sm outline-none text-[var(--text)] placeholder:text-[var(--text-muted)]"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
            )}
          </div>
          {/* Options list */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-[var(--text-muted)]">No users found.</li>
            ) : (
              filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(u.id)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-muted)] transition-colors ${
                      u.id === value ? "bg-[var(--surface-muted)] font-medium text-[var(--brand)]" : "text-[var(--text)]"
                    }`}
                  >
                    <span className="font-medium">{u.name}</span>
                    <span className="ml-1.5 text-[var(--text-muted)]">({u.email})</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
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
        const mapped = (Array.isArray(payload) ? (payload as ApiUserRow[]) : []).map((user) => ({
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
          const moduleName = String(row.module || "").toUpperCase()
          if (!nextValues[moduleName]) continue
          nextValues[moduleName] = {
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
            <UserSearchSelect users={users} value={selectedUser} onChange={setSelectedUser} />
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
