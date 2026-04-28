"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { useSession } from "next-auth/react"
import DataTable from "@/components/shared/DataTable"
import { Pencil, X, Check, CheckCircle2, AlertCircle } from "lucide-react"

type Role = { id: string; name: string }
type User = { id: string; name: string; roleId?: string | null; role?: { id: string; name: string } | null }
type RelationshipRow = {
  id: string
  manager?: { id: string; name: string } | null
  supervisor?: { id: string; name: string } | null
  status: string
}

// ── Searchable dropdown ──────────────────────────────────────────────────────
function SearchableSelect({
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
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options.slice(0, 20)
  }, [query, options])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={wrapRef}>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <div className="relative">
        <input
          className="ui-input pe-8"
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? "")}
          onFocus={() => { setQuery(""); setOpen(true) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          autoComplete="off"
        />
        {value && !open && (
          <button
            type="button"
            className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-red-500"
            onClick={() => { onChange(""); setQuery("") }}
            tabIndex={-1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-card shadow-lg max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[var(--text-muted)]">No results</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="w-full px-3 py-2 text-start text-sm hover:bg-[var(--surface-muted)]"
                  onMouseDown={() => { onChange(opt.value); setOpen(false); setQuery("") }}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MsRelationshipManager() {
  const { data: sessionData } = useSession()
  const sessionUser = sessionData?.user as
    | { regionId?: string | null; roleScopeType?: "GLOBAL" | "REGIONAL" }
    | undefined
  const sessionRegionId = sessionUser?.roleScopeType === "REGIONAL" ? sessionUser?.regionId ?? null : null

  const [rows, setRows] = useState<RelationshipRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [managerId, setManagerId] = useState("")
  const [supervisorId, setSupervisorId] = useState("")
  const [notes, setNotes] = useState("")
  const [filterManagerId, setFilterManagerId] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editSupervisorId, setEditSupervisorId] = useState("")
  const [editManagerId, setEditManagerId] = useState("")
  const [editSaving, setEditSaving] = useState(false)

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

  // Filtered rows by selected manager
  const displayRows = useMemo(
    () => filterManagerId ? rows.filter((r) => r.manager?.id === filterManagerId) : rows,
    [rows, filterManagerId]
  )

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const regionParam = sessionRegionId ? `?regionId=${encodeURIComponent(sessionRegionId)}` : ""
      const [rolesRes, usersRes, relRes] = await Promise.all([
        fetch("/api/roles", { cache: "no-store" }),
        fetch(`/api/users${regionParam}`, { cache: "no-store" }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRegionId])

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
          notes: notes || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create relationship.")
      setNotice("Relationship assigned.")
      setManagerId("")
      setSupervisorId("")
      setNotes("")
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

  const startEdit = (row: RelationshipRow) => {
    setEditId(row.id)
    setEditManagerId(row.manager?.id ?? "")
    setEditSupervisorId(row.supervisor?.id ?? "")
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditManagerId("")
    setEditSupervisorId("")
  }

  const saveEdit = async (id: string) => {
    setNotice("")
    setError("")
    if (!editManagerId || !editSupervisorId) {
      setError("Manager and supervisor are required.")
      return
    }
    setEditSaving(true)
    try {
      // Delete old + create new (PATCH not available; this is the cleanest approach)
      const delRes = await fetch(`/api/users/ms-relationships/${id}`, { method: "DELETE" })
      if (!delRes.ok) throw new Error("Failed to remove old relationship.")
      const createRes = await fetch("/api/users/ms-relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: editManagerId, supervisorId: editSupervisorId }),
      })
      const payload = await createRes.json().catch(() => ({}))
      if (!createRes.ok) throw new Error(payload?.message || "Failed to save updated relationship.")
      setNotice("Relationship updated.")
      cancelEdit()
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update relationship.")
    } finally {
      setEditSaving(false)
    }
  }

  const managerOptions = managers.map((m) => ({ value: m.id, label: m.name }))
  const supervisorOptions = supervisors.map((s) => ({ value: s.id, label: s.name }))

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"M/S Relationship"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Assign managers to supervisors."}</p></div></div>
      {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}
      {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}

      {/* Assign form */}
      <div className="ui-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">New Assignment</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchableSelect label="Manager" value={managerId} onChange={setManagerId} options={managerOptions} placeholder="Search manager…" />
          <SearchableSelect label="Supervisor" value={supervisorId} onChange={setSupervisorId} options={supervisorOptions} placeholder="Search supervisor…" />
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Notes</label>
            <input className="ui-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={assign} disabled={saving}>{saving ? "Assigning..." : "Assign"}</Button>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {/* Filter by manager */}
      <div className="ui-card p-4">
        <SearchableSelect
          label="Filter by Manager (shows linked supervisors)"
          value={filterManagerId}
          onChange={setFilterManagerId}
          options={[{ value: "", label: "— Show All —" }, ...managerOptions]}
          placeholder="Search manager to filter…"
        />
      </div>

      {/* Table */}
      <DataTable
        rows={displayRows}
        columns={[
          {
            key: "manager",
            header: "Manager",
            render: (row) => editId === row.id ? (
              <SearchableSelect label="" value={editManagerId} onChange={setEditManagerId} options={managerOptions} placeholder="Manager…" />
            ) : (row.manager?.name || "—"),
          },
          {
            key: "supervisor",
            header: "Supervisor",
            render: (row) => editId === row.id ? (
              <SearchableSelect label="" value={editSupervisorId} onChange={setEditSupervisorId} options={supervisorOptions} placeholder="Supervisor…" />
            ) : (row.supervisor?.name || "—"),
          },
          { key: "status", header: "Status" },
          {
            key: "action",
            header: "Action",
            render: (row) => editId === row.id ? (
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline disabled:opacity-50"
                  onClick={() => void saveEdit(row.id)}
                  disabled={editSaving}
                >
                  <Check className="h-3.5 w-3.5" />{editSaving ? "Saving…" : "Save"}
                </button>
                <button className="text-sm text-[var(--text-muted)] hover:underline" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  onClick={() => startEdit(row)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button className="text-sm text-red-600 hover:underline" onClick={() => void remove(row.id)}>
                  Delete
                </button>
              </div>
            ),
          },
        ]}
        rowKey="id"
        emptyText={loading ? "Loading relationships..." : filterManagerId ? "No supervisors linked to this manager." : "No relationship records."}
        searchable={false}
      />
    </div>
  )
}