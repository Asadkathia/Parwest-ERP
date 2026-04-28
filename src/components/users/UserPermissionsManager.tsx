"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import { useSession } from "next-auth/react"
import { ChevronDown, Info, Trash2, X, CheckCircle2, AlertCircle } from "lucide-react"
import { ACTIONS, MODULES } from "@/lib/constants/permissions"

type ActionName = (typeof ACTIONS)[number]

type ActionMap = Record<ActionName, boolean>

type MergedPerm = {
    module: string
    canCreate: boolean; canView: boolean; canUpdate: boolean; canDelete: boolean; canRequisition: boolean
    fromRole: ActionMap
    fromUser: ActionMap
    source: "ROLE" | "USER" | "BOTH" | "NONE"
}

type UserRow = { id: string; name: string; email: string }

function emptyMap(): ActionMap {
    return { CREATE: false, VIEW: false, UPDATE: false, DELETE: false, REQUISITIONS: false }
}

function actionKey(a: ActionName) {
    const map: Record<ActionName, keyof MergedPerm> = {
        CREATE: "canCreate", VIEW: "canView", UPDATE: "canUpdate",
        DELETE: "canDelete", REQUISITIONS: "canRequisition",
    }
    return map[a]
}

// ── User search select ────────────────────────────────────────────────────────
function UserSearchSelect({ users, value, onChange }: { users: UserRow[]; value: string; onChange: (id: string) => void }) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const selected = users.find((u) => u.id === value)

    const filtered = useMemo(() => {
        if (!search.trim()) return users
        const q = search.toLowerCase()
        return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }, [users, search])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false); setSearch("")
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            <button type="button" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
                className="ui-select flex items-center justify-between gap-2 text-start w-full">
                <span className={selected ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
                    {selected ? `${selected.name} (${selected.email})` : "Select user..."}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                    <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                        <input ref={inputRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or email..." className="flex-1 bg-transparent text-sm outline-none" />
                        {search && <button type="button" onClick={() => setSearch("")}><X className="h-3.5 w-3.5" /></button>}
                    </div>
                    <ul className="max-h-56 overflow-y-auto py-1">
                        {filtered.length === 0
                            ? <li className="px-4 py-3 text-sm text-[var(--text-muted)]">No users found.</li>
                            : filtered.map((u) => (
                                <li key={u.id}>
                                    <button type="button" onClick={() => { onChange(u.id); setOpen(false); setSearch("") }}
                                        className={`w-full px-4 py-2.5 text-start text-sm hover:bg-[var(--surface-muted)] transition-colors ${u.id === value ? "bg-[var(--surface-muted)] font-medium text-[var(--brand)]" : "text-[var(--text)]"}`}>
                                        <span className="font-medium">{u.name}</span>
                                        <span className="ms-1.5 text-[var(--text-muted)]">({u.email})</span>
                                    </button>
                                </li>
                            ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UserPermissionsManager() {
    const { data: sessionData } = useSession()
    const sessionUser = sessionData?.user as
        | { regionId?: string | null; roleScopeType?: "GLOBAL" | "REGIONAL" }
        | undefined
    const sessionRegionId = sessionUser?.roleScopeType === "REGIONAL" ? sessionUser?.regionId ?? null : null

    const [users, setUsers] = useState<UserRow[]>([])
    const [selectedUser, setSelectedUser] = useState("")
    const [merged, setMerged] = useState<MergedPerm[]>([])
    // user-level overrides (what we edit)
    const [userOverrides, setUserOverrides] = useState<Record<string, ActionMap>>({})
    const [query, setQuery] = useState("")
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState("")
    const [error, setError] = useState("")

    // Load users (scoped by session region for regional admins)
    useEffect(() => {
        const url = sessionRegionId
            ? `/api/users?regionId=${encodeURIComponent(sessionRegionId)}`
            : "/api/users"
        fetch(url, { cache: "no-store" })
            .then((r) => r.ok ? r.json() : [])
            .then((data) => {
                const mapped = (Array.isArray(data) ? data : []).map((u: { id?: string; name?: string; email?: string }) => ({
                    id: String(u.id ?? ""), name: String(u.name ?? "Unnamed"), email: String(u.email ?? ""),
                }))
                setUsers(mapped)
                if (mapped.length > 0) setSelectedUser(mapped[0].id)
            })
            .catch(() => {})
    }, [sessionRegionId])

    // Load permissions when user changes
    useEffect(() => {
        if (!selectedUser) return
        setLoading(true)
        setError("")
        fetch(`/api/user-permissions?userId=${selectedUser}`, { cache: "no-store" })
            .then((r) => r.ok ? r.json() : [])
            .then((data: MergedPerm[]) => {
                setMerged(Array.isArray(data) ? data : [])
                // Initialize user overrides from the fromUser portion
                const overrides: Record<string, ActionMap> = {}
                for (const row of Array.isArray(data) ? data : []) {
                    overrides[row.module] = row.fromUser ?? emptyMap()
                }
                setUserOverrides(overrides)
            })
            .catch(() => setError("Failed to load permissions"))
            .finally(() => setLoading(false))
    }, [selectedUser])

    const visibleModules = useMemo(() =>
        MODULES.filter((m) => !query || m.toLowerCase().includes(query.toLowerCase())),
        [query]
    )

    const toggleUser = (module: string, action: ActionName) => {
        setUserOverrides((prev) => ({
            ...prev,
            [module]: {
                ...(prev[module] ?? emptyMap()),
                [action]: !(prev[module]?.[action] ?? false),
            },
        }))
    }

    const save = async () => {
        if (!selectedUser) return
        setSaving(true); setNotice(""); setError("")
        try {
            const permissions = MODULES.map((module) => {
                const m = userOverrides[module] ?? emptyMap()
                return {
                    module,
                    canCreate: m.CREATE, canView: m.VIEW, canUpdate: m.UPDATE,
                    canDelete: m.DELETE, canRequisition: m.REQUISITIONS,
                }
            })
            const res = await fetch("/api/user-permissions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: selectedUser, permissions }),
            })
            const payload = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(payload?.message || "Failed to save")
            setNotice("Additional permissions saved successfully.")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save permissions")
        } finally { setSaving(false) }
    }

    const refetchPermissions = async () => {
        if (!selectedUser) return
        const res = await fetch(`/api/user-permissions?userId=${selectedUser}`, { cache: "no-store" })
        const data: MergedPerm[] = res.ok ? await res.json() : []
        setMerged(Array.isArray(data) ? data : [])
        const overrides: Record<string, ActionMap> = {}
        for (const row of Array.isArray(data) ? data : []) {
            overrides[row.module] = row.fromUser ?? emptyMap()
        }
        setUserOverrides(overrides)
    }

    const clearAll = async () => {
        if (!selectedUser) return
        if (!confirm("Remove all additional permissions for this user? Role-granted permissions will remain.")) return
        setSaving(true); setNotice(""); setError("")
        try {
            const res = await fetch(`/api/user-permissions?userId=${selectedUser}`, { method: "DELETE" })
            const payload = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(payload?.message || "Failed to clear overrides")
            await refetchPermissions()
            setNotice(`All additional permissions removed (${payload?.deleted ?? 0} rows).`)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to clear overrides")
        } finally { setSaving(false) }
    }

    const clearModule = async (module: string) => {
        if (!selectedUser) return
        setSaving(true); setNotice(""); setError("")
        try {
            const res = await fetch(
                `/api/user-permissions?userId=${selectedUser}&module=${encodeURIComponent(module)}`,
                { method: "DELETE" }
            )
            const payload = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(payload?.message || "Failed to clear module")
            await refetchPermissions()
            setNotice(`Removed additional permissions for ${module}.`)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to clear module")
        } finally { setSaving(false) }
    }

    const selectedUserName = users.find((u) => u.id === selectedUser)?.name ?? "No user selected"

    // Get effective (merged) value for display
    const effectiveCheck = (module: string, action: ActionName): boolean => {
        const row = merged.find((r) => r.module === module)
        if (!row) return false
        return Boolean(row[actionKey(action) as keyof MergedPerm])
    }

    const fromRoleCheck = (module: string, action: ActionName): boolean => {
        const row = merged.find((r) => r.module === module)
        return row?.fromRole?.[action] ?? false
    }

    return (
        <div className="space-y-6">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Permissions Management"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Configure role-based and additional user permissions."}</p></div></div>

            {notice && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert>}
            {error && <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

            <Card>
        <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Select User</label>
                        <UserSearchSelect users={users} value={selectedUser} onChange={setSelectedUser} />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Search Module</label>
                        <input value={query} onChange={(e) => setQuery(e.target.value)} className="ui-input" placeholder="Search module..." />
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <Button onClick={save} disabled={saving || loading || !selectedUser}>
                        {saving ? "Saving..." : "Save Additional Permissions"}
                    </Button>
                    <Button variant="destructive" onClick={clearAll} disabled={saving || loading || !selectedUser}>
                        Clear All Additional
                    </Button>
                    <Button variant="secondary" onClick={() => setQuery("")}>Reset Filter</Button>
                    <span className="text-sm font-medium text-[var(--text)]">{selectedUserName}</span>
                </div>
            </CardContent>
      </Card>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded border-2 border-blue-400 bg-blue-100 dark:bg-blue-950/40 dark:border-blue-500" />
                    Inherited from Role (read-only)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded border-2 border-green-500 bg-green-100 dark:bg-green-950/40 dark:border-green-500" />
                    Additional User Permission
                </span>
                <span className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Effective access = Role OR Additional
                </span>
            </div>

            {/* Permissions table */}
            <div className="ui-card overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-4 py-3 text-start text-xs font-semibold text-[var(--text-muted)] uppercase w-32">Module</th>
                            {ACTIONS.map((a) => (
                                <th key={a} className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">{a}</th>
                            ))}
                            <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase w-16">Clear</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-4 py-3"><div className="h-4 w-20 bg-muted rounded" /></td>
                                    {ACTIONS.map((a) => (
                                        <td key={a} className="px-4 py-3 text-center">
                                            <div className="h-4 w-4 bg-muted rounded mx-auto" />
                                        </td>
                                    ))}
                                    <td className="px-4 py-3" />
                                </tr>
                            ))
                        ) : visibleModules.map((module) => {
                            return (
                                <tr key={module} className="hover:bg-[var(--surface-muted)]">
                                    <td className="px-4 py-3 font-medium text-[var(--text)]">{module}</td>
                                    {ACTIONS.map((action) => {
                                        const fromRole = fromRoleCheck(module, action)
                                        const userVal = userOverrides[module]?.[action] ?? false
                                        const effective = effectiveCheck(module, action)
                                        return (
                                            <td key={action} className="px-4 py-3 text-center">
                                                <div className="inline-flex flex-col items-center gap-1">
                                                    {/* Role-inherited checkbox (read-only) */}
                                                    <input
                                                        type="checkbox"
                                                        checked={fromRole}
                                                        readOnly
                                                        className="h-4 w-4 rounded cursor-not-allowed accent-blue-500 opacity-70"
                                                        title={fromRole ? "Granted by role" : "Not in role"}
                                                    />
                                                    {/* User additional checkbox (editable) */}
                                                    <input
                                                        type="checkbox"
                                                        checked={userVal}
                                                        onChange={() => toggleUser(module, action)}
                                                        disabled={fromRole} // can't remove what role already grants
                                                        className={`h-4 w-4 rounded accent-green-600 ${fromRole ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                                                        title={fromRole ? "Already granted by role" : "Additional user permission (uncheck to remove)"}
                                                    />
                                                    {/* Effective indicator */}
                                                    {effective && (
                                                        <span className="text-[10px] text-green-600 font-semibold leading-none">✓</span>
                                                    )}
                                                </div>
                                            </td>
                                        )
                                    })}
                                    <td className="px-4 py-3 text-center">
                                        {(() => {
                                            const hasOverride = ACTIONS.some((a) => userOverrides[module]?.[a])
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => clearModule(module)}
                                                    disabled={!hasOverride || saving}
                                                    title={hasOverride ? `Remove all additional permissions for ${module}` : "No additional permissions to remove"}
                                                    className={`inline-flex items-center justify-center rounded p-1.5 transition-colors ${
                                                        hasOverride
                                                            ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                                            : "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
                                                    }`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )
                                        })()}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {!loading && visibleModules.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No modules match your search.</p>
                )}
            </div>
        </div>
    )
}