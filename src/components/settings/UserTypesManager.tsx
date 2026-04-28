"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import SectionTitle from "@/components/ui/section-title"
import { Button } from "@/components/shadcn/button"
import InlineAlert from "@/components/ui/inline-alert"
import { Plus, Users, ChevronDown, ChevronUp, Trash2 } from "lucide-react"

type RoleRow = { id: string; name: string; description?: string | null }
type RegionOption = { id: string; name: string }
type OfficeOption = { id: string; name: string; regionId?: string | null }
type UserRow = {
  id: string
  name: string
  email: string
  status: string
  role: { id: string; name: string } | null
  region: { id: string; name: string } | null
  regionalOffice: { id: string; name: string } | null
  createdAt: string
}

const EMAIL_DOMAIN = "@parwestgroup.com"
const SUPERVISOR_ROLES = ["supervisor", "manager"]
const isSupervisorRole = (roleName: string) =>
  SUPERVISOR_ROLES.some((r) => roleName.toLowerCase().includes(r))

export default function UserTypesManager() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session?.user as any)?.role === "Admin"

  // Lookups
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [regions, setRegions] = useState<RegionOption[]>([])
  const [offices, setOffices] = useState<OfficeOption[]>([])
  // Users list
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  // Form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: "", email: "", password: "", contactNumber: "",
    roleId: "", regionId: "", regionalOfficeId: "", status: "ACTIVE",
  })
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  // Role management section
  const [showRolesSection, setShowRolesSection] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDesc, setNewRoleDesc] = useState("")
  const [savingRole, setSavingRole] = useState(false)
  const [roleError, setRoleError] = useState("")
  const [roleNotice, setRoleNotice] = useState("")
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [rolesRes, regionsRes, officesRes] = await Promise.all([
        fetch("/api/roles", { cache: "no-store" }),
        fetch("/api/regions", { cache: "no-store" }),
        fetch("/api/regional-offices", { cache: "no-store" }),
      ])
      if (rolesRes.ok) setRoles(await rolesRes.json())
      if (regionsRes.ok) setRegions(await regionsRes.json())
      if (officesRes.ok) setOffices(await officesRes.json())
    } catch { /* ignore */ }
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch("/api/users?status=ACTIVE", { cache: "no-store" })
      if (res.ok) setUsers(await res.json())
    } catch { /* ignore */ }
    finally { setUsersLoading(false) }
  }, [])

  useEffect(() => { void loadData(); void loadUsers() }, [loadData, loadUsers])

  const availableOffices = useMemo(() => {
    if (!form.regionId) return []
    return offices.filter((o) => o.regionId === form.regionId)
  }, [offices, form.regionId])

  const selectedRole = useMemo(() => roles.find((r) => r.id === form.roleId), [roles, form.roleId])
  const needsRegion = selectedRole ? isSupervisorRole(selectedRole.name) : false

  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleCreate = async () => {
    setError(""); setNotice("")
    if (!form.name || !form.email || !form.password || !form.roleId) {
      setError("Name, Email, Password, and Role are required."); return
    }
    if (!form.email.endsWith(EMAIL_DOMAIN)) {
      setError(`Email must end with ${EMAIL_DOMAIN}.`); return
    }
    if (needsRegion && (!form.regionId || !form.regionalOfficeId)) {
      setError("Region and Regional Office are required for Supervisor/Manager roles."); return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to create user")
      setNotice(`User "${form.name}" created successfully.`)
      setForm({ name: "", email: "", password: "", contactNumber: "", roleId: "", regionId: "", regionalOfficeId: "", status: "ACTIVE" })
      setShowForm(false)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user")
    } finally { setSubmitting(false) }
  }

  const handleCreateRole = async () => {
    setRoleError(""); setRoleNotice("")
    if (!newRoleName.trim()) { setRoleError("Role name is required"); return }
    setSavingRole(true)
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim(), description: newRoleDesc.trim() || null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d?.message || "Failed") }
      setNewRoleName(""); setNewRoleDesc("")
      setRoleNotice("Role created successfully.")
      await loadData()
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "Failed to create role")
    } finally { setSavingRole(false) }
  }

  const handleDeleteRole = async (role: RoleRow) => {
    if (!isAdmin) return
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return
    setRoleError(""); setRoleNotice("")
    setDeletingRoleId(role.id)
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Failed to delete role")
      setRoleNotice(`Role "${role.name}" deleted.`)
      await loadData()
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "Failed to delete role")
    } finally { setDeletingRoleId(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle
          title="Settings: User Types"
          subtitle="Create and manage supervisor and manager accounts with region and office assignment."
        />
        {isAdmin && (
          <Button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "Add User"}
          </Button>
        )}
      </div>

      {notice && <InlineAlert type="success" message={notice} />}
      {error && <InlineAlert type="error" message={error} />}

      {/* ── Create User Form (Admin only) ── */}
      {showForm && isAdmin && (
        <div className="ui-card p-6 space-y-4">
          <h3 className="text-base font-semibold text-[var(--text)]">Create User Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="ui-label">Full Name <span className="text-red-500">*</span></label>
              <input className="ui-input" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="User full name" />
            </div>
            <div>
              <label className="ui-label">Email <span className="text-red-500">*</span></label>
              <input
                className="ui-input"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder={`username${EMAIL_DOMAIN}`}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">Must end with {EMAIL_DOMAIN}</p>
            </div>
            <div>
              <label className="ui-label">Password <span className="text-red-500">*</span></label>
              <input className="ui-input" type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="ui-label">Contact Number</label>
              <input className="ui-input" value={form.contactNumber} onChange={(e) => setField("contactNumber", e.target.value)} placeholder="+92-300-0000000" />
            </div>
            <div>
              <label className="ui-label">Role <span className="text-red-500">*</span></label>
              <select
                className="ui-select"
                value={form.roleId}
                onChange={(e) => {
                  setField("roleId", e.target.value)
                  setField("regionId", "")
                  setField("regionalOfficeId", "")
                }}
              >
                <option value="">-- Select Role --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-label">Status</label>
              <select className="ui-select" value={form.status} onChange={(e) => setField("status", e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            {/* Region & Office — required for supervisor/manager roles */}
            <div>
              <label className="ui-label">
                Region {needsRegion && <span className="text-red-500">*</span>}
              </label>
              <select
                className="ui-select"
                value={form.regionId}
                onChange={(e) => {
                  setField("regionId", e.target.value)
                  setField("regionalOfficeId", "")
                }}
              >
                <option value="">-- Select Region --</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {!form.regionId && !needsRegion && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">Required for Supervisor/Manager roles</p>
              )}
            </div>
            <div>
              <label className="ui-label">
                Regional Office {needsRegion && <span className="text-red-500">*</span>}
              </label>
              <select
                className="ui-select"
                value={form.regionalOfficeId}
                onChange={(e) => setField("regionalOfficeId", e.target.value)}
                disabled={!form.regionId}
              >
                <option value="">
                  {form.regionId ? "-- Select Office --" : "-- Select Region First --"}
                </option>
                {availableOffices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating..." : "Create User"}
            </Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setError("") }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── User List ── */}
      <div className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">System Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                {["#", "Name", "Email", "Role", "Region", "Regional Office", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No users found.</td></tr>
              ) : users.map((u, idx) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors">
                  <td className="px-4 py-3 text-[var(--text-muted)]">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{u.name}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isSupervisorRole(u.role.name) ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"
                      }`}>{u.role.name}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{u.region?.name || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{u.regionalOffice?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}>{u.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Role Definitions (collapsible) — Admin only ── */}
      {isAdmin && (
        <div className="ui-card overflow-hidden">
          <button
            onClick={() => setShowRolesSection((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Role Definitions</h3>
            {showRolesSection ? <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />}
          </button>
          {showRolesSection && (
            <div className="p-5 space-y-4">
              {roleError && <InlineAlert type="error" message={roleError} />}
              {roleNotice && <InlineAlert type="success" message={roleNotice} />}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className="ui-label">Role Name <span className="text-red-500">*</span></label>
                  <input className="ui-input" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g., Supervisor" />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="ui-label">Description</label>
                  <input className="ui-input" value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Optional description" />
                </div>
                <Button onClick={handleCreateRole} disabled={savingRole}>
                  {savingRole ? "Saving..." : "Add Role"}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Role</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Created</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">No roles defined</td></tr>
                    ) : roles.map((r, idx) => (
                      <tr key={r.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                        <td className="px-4 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-[var(--text-muted)]">{r.description || "—"}</td>
                        <td className="px-4 py-2 text-xs text-[var(--text-muted)]">—</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleDeleteRole(r)}
                            disabled={deletingRoleId === r.id}
                            title="Delete role"
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deletingRoleId === r.id ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}