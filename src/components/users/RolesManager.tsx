"use client"

import { useState } from "react"
import { Plus, Trash2, Shield } from "lucide-react"
import InlineAlert from "@/components/ui/inline-alert"
import ActionButton from "@/components/ui/action-button"
import RolePermissionsManager from "@/components/users/RolePermissionsManager"
import UserPermissionsManager from "@/components/users/UserPermissionsManager"

type RoleRow = { id: string; name: string; description: string | null; scopeType: "GLOBAL" | "REGIONAL" }

type TabKey = "roles" | "permissions" | "overrides"

interface Props {
    initialRoles: RoleRow[]
    initialTab?: TabKey
}

export default function RolesManager({ initialRoles, initialTab = "roles" }: Props) {
    const [roles, setRoles] = useState<RoleRow[]>(initialRoles)
    const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

    // Create role form
    const [name, setName] = useState("")
    const [desc, setDesc] = useState("")
    const [scopeType, setScopeType] = useState<"GLOBAL" | "REGIONAL">("REGIONAL")
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [notice, setNotice] = useState("")
    const [error, setError] = useState("")

    const handleCreate = async () => {
        if (!name.trim()) { setError("Role name is required"); return }
        setSaving(true); setError(""); setNotice("")
        try {
            const res = await fetch("/api/roles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), description: desc.trim() || null, scopeType }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || "Failed to create role")
            setRoles((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
            setName(""); setDesc(""); setScopeType("REGIONAL")
            setNotice(`Role "${data.name}" created.`)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create role")
        } finally { setSaving(false) }
    }

    const handleDelete = async (role: RoleRow) => {
        if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return
        setDeletingId(role.id); setError(""); setNotice("")
        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || "Failed to delete role")
            setRoles((prev) => prev.filter((r) => r.id !== role.id))
            setNotice(`Role "${role.name}" deleted.`)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete role")
        } finally { setDeletingId(null) }
    }

    return (
        <div className="space-y-6">
            {notice && <InlineAlert type="success" message={notice} />}
            {error && <InlineAlert type="error" message={error} />}

            {/* Tabs */}
            <div className="border-b border-[var(--border)]">
                <div className="flex gap-0">
                    {[
                        { key: "roles", label: "Role Definitions" },
                        { key: "permissions", label: "Role Permissions" },
                        { key: "overrides", label: "User Overrides" },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key as TabKey)}
                            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.key
                                    ? "border-[var(--brand)] text-[var(--brand)]"
                                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === "roles" && (
                <div className="space-y-6">
                    {/* Create role form */}
                    <div className="ui-card p-5">
                        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Create New Role</h3>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[180px]">
                                <label className="ui-label">Role Name <span className="text-red-500">*</span></label>
                                <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Supervisor" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
                            </div>
                            <div className="flex-1 min-w-[220px]">
                                <label className="ui-label">Description</label>
                                <input className="ui-input" value={desc} onChange={(e) => setDesc(e.target.value)}
                                    placeholder="Optional description" />
                            </div>
                            <div className="min-w-[200px]">
                                <label className="ui-label">Scope</label>
                                <select className="ui-input" value={scopeType} onChange={(e) => setScopeType(e.target.value as "GLOBAL" | "REGIONAL")}>
                                    <option value="REGIONAL">Regional (scoped to region)</option>
                                    <option value="GLOBAL">Global (sees all regions)</option>
                                </select>
                            </div>
                            <ActionButton onClick={handleCreate} disabled={saving} className="inline-flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                {saving ? "Creating..." : "Add Role"}
                            </ActionButton>
                        </div>
                        <p className="mt-3 text-xs text-[var(--text-muted)]">
                            Global roles see all data across regions. Regional roles only see data for the region and office assigned to the user.
                        </p>
                    </div>

                    {/* Roles table */}
                    <div className="ui-card overflow-hidden">
                        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-[var(--text-muted)]" />
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Defined Roles</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                                        {["#", "Role", "Scope", "Description", "Actions"].map((h) => (
                                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {roles.length === 0 ? (
                                        <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No roles defined.</td></tr>
                                    ) : roles.map((r, idx) => (
                                        <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors">
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{idx + 1}</td>
                                            <td className="px-4 py-3 font-medium text-[var(--text)]">{r.name}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    r.scopeType === "GLOBAL"
                                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                                }`}>
                                                    {r.scopeType === "GLOBAL" ? "Global" : "Regional"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{r.description || "—"}</td>
                                            <td className="px-4 py-3 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => { setActiveTab("permissions") }}
                                                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                                                    title="Configure permissions"
                                                >
                                                    <Shield className="h-3.5 w-3.5" />
                                                    Permissions
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(r)}
                                                    disabled={deletingId === r.id}
                                                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    {deletingId === r.id ? "Deleting..." : "Delete"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "permissions" && (
                roles.length === 0
                    ? <p className="text-sm text-[var(--text-muted)]">Create a role first to configure its permissions.</p>
                    : <RolePermissionsManager roles={roles} />
            )}

            {activeTab === "overrides" && <UserPermissionsManager />}
        </div>
    )
}