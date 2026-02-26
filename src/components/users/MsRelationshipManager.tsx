"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type Role = { id: string; name: string }
type User = { id: string; name: string; roleId?: string | null; role?: { id: string; name: string } | null }
type RelationshipRow = {
  id: string
  manager?: { id: string; name: string } | null
  supervisor?: { id: string; name: string } | null
  effectiveDate: string
  status: string
}

export default function MsRelationshipManager() {
  const [rows, setRows] = useState<RelationshipRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [managerId, setManagerId] = useState("")
  const [supervisorId, setSupervisorId] = useState("")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const managerRoleIds = useMemo(
    () => new Set(roles.filter((role) => /manager|admin/i.test(role.name)).map((role) => role.id)),
    [roles]
  )
  const supervisorRoleIds = useMemo(
    () => new Set(roles.filter((role) => /supervisor/i.test(role.name)).map((role) => role.id)),
    [roles]
  )

  const managers = useMemo(
    () => users.filter((user) => (user.roleId && managerRoleIds.has(user.roleId)) || /manager|admin/i.test(user.role?.name || "")),
    [users, managerRoleIds]
  )
  const supervisors = useMemo(
    () => users.filter((user) => (user.roleId && supervisorRoleIds.has(user.roleId)) || /supervisor/i.test(user.role?.name || "")),
    [users, supervisorRoleIds]
  )

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [rolesRes, usersRes, relRes] = await Promise.all([
        fetch("/api/roles", { cache: "no-store" }),
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/users/ms-relationships", { cache: "no-store" }),
      ])
      const [rolesJson, usersJson, relJson] = await Promise.all([
        rolesRes.json().catch(() => []),
        usersRes.json().catch(() => []),
        relRes.json().catch(() => []),
      ])
      if (!rolesRes.ok || !usersRes.ok || !relRes.ok) {
        throw new Error(relJson?.message || usersJson?.message || rolesJson?.message || "Failed to load M/S data.")
      }
      setRoles(Array.isArray(rolesJson) ? rolesJson : [])
      setUsers(Array.isArray(usersJson) ? usersJson : [])
      setRows(Array.isArray(relJson) ? relJson : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load M/S data.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const assign = async () => {
    setNotice("")
    setError("")
    if (!managerId || !supervisorId) {
      setError("Manager and supervisor are required.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/users/ms-relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerId,
          supervisorId,
          effectiveDate: effectiveDate || null,
          notes: notes || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create relationship.")
      setNotice("Relationship assigned.")
      setNotes("")
      setEffectiveDate("")
      await load()
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Failed to assign relationship.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setNotice("")
    setError("")
    try {
      const response = await fetch(`/api/users/ms-relationships/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete relationship.")
      setNotice("Relationship removed.")
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove relationship.")
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="M/S Relationship" subtitle="Assign managers to supervisors." />
      {notice ? <InlineAlert type="success" message={notice} /> : null}
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select label="Manager" value={managerId} onChange={setManagerId} options={managers.map((m) => ({ value: m.id, label: m.name }))} placeholder="-- Select Manager --" />
          <Select label="Supervisor" value={supervisorId} onChange={setSupervisorId} options={supervisors.map((s) => ({ value: s.id, label: s.name }))} placeholder="-- Select Supervisor --" />
          <Input label="Effective Date" type="date" value={effectiveDate} onChange={setEffectiveDate} />
          <Input label="Notes" value={notes} onChange={setNotes} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={assign} disabled={saving}>{saving ? "Assigning..." : "Assign"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={rows}
        columns={[
          { key: "manager", header: "Manager", render: (row) => row.manager?.name || "—" },
          { key: "supervisor", header: "Supervisor", render: (row) => row.supervisor?.name || "—" },
          { key: "effectiveDate", header: "Effective Date", render: (row) => new Date(row.effectiveDate).toLocaleDateString("en-US") },
          { key: "status", header: "Status" },
          { key: "action", header: "Action", render: (row) => <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>Delete</button> },
        ]}
        rowKey="id"
        emptyText={loading ? "Loading relationships..." : "No relationship records."}
        searchable={false}
      />
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Select({
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
