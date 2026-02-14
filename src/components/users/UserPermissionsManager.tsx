"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import { Checkbox } from "@/components/ui/form-controls"
import StatusChip from "@/components/ui/status-chip"

const modules = [
  "Guard",
  "Payroll",
  "Inventory",
  "Users",
  "Clients",
  "Ticketing",
  "Settings",
  "Reports",
  "Imports",
  "Requisitions",
  "Audit",
]

const actions = ["CREATE", "VIEW", "UPDATE", "DELETE", "REQUISITIONS"]

type PermissionMap = Record<string, boolean>

type UserPermission = {
  user: string
  values: Record<string, PermissionMap>
}

function emptyMap(): PermissionMap {
  return { CREATE: false, VIEW: false, UPDATE: false, DELETE: false, REQUISITIONS: false }
}

const seed: UserPermission[] = [
  {
    user: "Admin",
    values: Object.fromEntries(modules.map((m) => [m, { CREATE: true, VIEW: true, UPDATE: true, DELETE: true, REQUISITIONS: true }])) as Record<string, PermissionMap>,
  },
  {
    user: "Supervisor",
    values: Object.fromEntries(modules.map((m) => [m, m === "Guard" || m === "Ticketing" ? { CREATE: false, VIEW: true, UPDATE: true, DELETE: false, REQUISITIONS: true } : emptyMap()])) as Record<string, PermissionMap>,
  },
]

type PermissionRow = {
  moduleName: string
}

export default function UserPermissionsManager() {
  const [selectedUser, setSelectedUser] = useState("Admin")
  const [store, setStore] = useState<UserPermission[]>(seed)
  const [query, setQuery] = useState("")

  const current = useMemo(() => store.find((s) => s.user === selectedUser) || seed[0], [store, selectedUser])

  const visibleModules = useMemo(() => {
    if (!query) return modules
    return modules.filter((m) => m.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  const rows = useMemo<PermissionRow[]>(() => visibleModules.map((moduleName) => ({ moduleName })), [visibleModules])

  const toggle = (moduleName: string, actionName: string) => {
    setStore((prev) =>
      prev.map((entry) => {
        if (entry.user !== selectedUser) return entry
        return {
          ...entry,
          values: {
            ...entry.values,
            [moduleName]: {
              ...entry.values[moduleName],
              [actionName]: !entry.values[moduleName][actionName],
            },
          },
        }
      })
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Permissions Management"
        subtitle="Module permissions: CREATE, VIEW, UPDATE, DELETE, REQUISITIONS."
        action={<StatusChip label={selectedUser} variant="neutral" />}
      />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select User</label>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="ui-select">
              {store.map((s) => <option key={s.user} value={s.user}>{s.user}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search Module</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="ui-input" placeholder="Search module" />
          </div>
        </div>

        <div className="flex gap-2">
          <ActionButton>Save Permissions</ActionButton>
          <ActionButton variant="secondary" onClick={() => setQuery("")}>Reset</ActionButton>
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
                checked={current.values[row.moduleName]?.[action] || false}
                onChange={() => toggle(row.moduleName, action)}
              />
            ),
          })),
        ]}
        getRowKey={(row) => row.moduleName}
        searchable={false}
        stickyHeader
        emptyText="No modules found."
      />
    </div>
  )
}
