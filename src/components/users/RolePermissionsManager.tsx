"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Save, Shield } from "lucide-react"
import InlineAlert from "@/components/ui/inline-alert"

const MODULES = [
    "GUARDS", "PAYROLL", "INVENTORY", "USERS", "CLIENTS",
    "TICKETING", "SETTINGS", "REPORTS", "IMPORTS", "REQUISITIONS", "AUDIT",
]
const ACTIONS = ["CREATE", "VIEW", "UPDATE", "DELETE", "REQUISITIONS"] as const
type ActionName = (typeof ACTIONS)[number]
type PermMap = Record<ActionName, boolean>

function empty(): PermMap {
    return { CREATE: false, VIEW: false, UPDATE: false, DELETE: false, REQUISITIONS: false }
}

type RoleRow = { id: string; name: string; description?: string | null }

interface Props {
    roles: RoleRow[]
}

export default function RolePermissionsManager({ roles }: Props) {
    const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "")
    const [perms, setPerms] = useState<Record<string, PermMap>>({})
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState("")
    const [error, setError] = useState("")
    const [query, setQuery] = useState("")

    useEffect(() => {
        if (!selectedRoleId) return
        setLoading(true)
        setError("")
        fetch(`/api/role-permissions?roleId=${selectedRoleId}`)
            .then((r) => r.ok ? r.json() : [])
            .then((data: Array<{ module: string; canCreate: boolean; canView: boolean; canUpdate: boolean; canDelete: boolean; canRequisition: boolean }>) => {
                const next: Record<string, PermMap> = Object.fromEntries(MODULES.map((m) => [m, empty()]))
                for (const row of Array.isArray(data) ? data : []) {
                    const mod = String(row.module).toUpperCase()
                    if (!next[mod]) continue
                    next[mod] = {
                        CREATE: Boolean(row.canCreate),
                        VIEW: Boolean(row.canView),
                        UPDATE: Boolean(row.canUpdate),
                        DELETE: Boolean(row.canDelete),
                        REQUISITIONS: Boolean(row.canRequisition),
                    }
                }
                setPerms(next)
            })
            .catch(() => setError("Failed to load role permissions"))
            .finally(() => setLoading(false))
    }, [selectedRoleId])

    const toggle = (module: string, action: ActionName) => {
        setPerms((prev) => ({
            ...prev,
            [module]: { ...(prev[module] ?? empty()), [action]: !(prev[module]?.[action] ?? false) },
        }))
    }

    const toggleAll = (module: string, checked: boolean) => {
        setPerms((prev) => ({
            ...prev,
            [module]: { CREATE: checked, VIEW: checked, UPDATE: checked, DELETE: checked, REQUISITIONS: checked },
        }))
    }

    const save = async () => {
        if (!selectedRoleId) return
        setSaving(true); setNotice(""); setError("")
        try {
            const permissions = MODULES.map((module) => {
                const m = perms[module] ?? empty()
                return { module, canCreate: m.CREATE, canView: m.VIEW, canUpdate: m.UPDATE, canDelete: m.DELETE, canRequisition: m.REQUISITIONS }
            })
            const res = await fetch("/api/role-permissions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleId: selectedRoleId, permissions }),
            })
            const payload = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(payload?.message || "Failed to save")
            setNotice(`Permissions saved for "${roles.find((r) => r.id === selectedRoleId)?.name}". All users with this role will inherit these permissions.`)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save")
        } finally { setSaving(false) }
    }

    const visibleModules = useMemo(() =>
        MODULES.filter((m) => !query || m.toLowerCase().includes(query.toLowerCase())),
        [query]
    )

    const selectedRole = roles.find((r) => r.id === selectedRoleId)

    return (
        <div className="space-y-4">
            {notice && <InlineAlert type="success" message={notice} />}
            {error && <InlineAlert type="error" message={error} />}

            <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="ui-label">Select Role</label>
                    <select
                        className="ui-select"
                        value={selectedRoleId}
                        onChange={(e) => setSelectedRoleId(e.target.value)}
                    >
                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[180px]">
                    <label className="ui-label">Search Module</label>
                    <input className="ui-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter modules..." />
                </div>
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || loading || !selectedRoleId}
                    className="ui-btn ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving..." : "Save Role Permissions"}
                </button>
            </div>

            {selectedRole && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                    <Shield className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>Permissions configured here apply to <strong>all users</strong> assigned the <strong>{selectedRole.name}</strong> role. Additional per-user permissions can be set in Permissions Management.</span>
                </div>
            )}

            <div className="ui-card overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase w-36">Module</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase w-16">All</th>
                            {ACTIONS.map((a) => (
                                <th key={a} className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">{a}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-100 rounded" /></td>
                                    <td className="px-4 py-3 text-center"><div className="h-4 w-4 bg-gray-100 rounded mx-auto" /></td>
                                    {ACTIONS.map((a) => <td key={a} className="px-4 py-3 text-center"><div className="h-4 w-4 bg-gray-100 rounded mx-auto" /></td>)}
                                </tr>
                            ))
                        ) : visibleModules.map((module) => {
                            const modulePerms = perms[module] ?? empty()
                            const allChecked = ACTIONS.every((a) => modulePerms[a])
                            const someChecked = ACTIONS.some((a) => modulePerms[a])
                            return (
                                <tr key={module} className="hover:bg-[var(--surface-muted)]">
                                    <td className="px-4 py-3 font-medium text-[var(--text)]">{module}</td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={allChecked}
                                            ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked }}
                                            onChange={(e) => toggleAll(module, e.target.checked)}
                                            className="h-4 w-4 rounded cursor-pointer accent-[var(--brand)]"
                                            title="Toggle all for this module"
                                        />
                                    </td>
                                    {ACTIONS.map((action) => (
                                        <td key={action} className="px-4 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={modulePerms[action]}
                                                onChange={() => toggle(module, action)}
                                                className="h-4 w-4 rounded cursor-pointer accent-[var(--brand)]"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}