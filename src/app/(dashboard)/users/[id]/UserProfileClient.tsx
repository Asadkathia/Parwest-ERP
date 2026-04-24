"use client"

import { useState } from "react"
import { User, Mail, Phone, Shield, MapPin, Clock, History, Lock, CheckCircle, XCircle } from "lucide-react"
import InlineAlert from "@/components/ui/inline-alert"

const MODULES = [
    "GUARDS", "PAYROLL", "INVENTORY", "USERS", "CLIENTS",
    "TICKETING", "SETTINGS", "REPORTS", "IMPORTS", "REQUISITIONS", "AUDIT",
]

type UserData = {
    id: string; name: string; email: string; status: string
    contactNumber: string | null; photoUrl: string | null
    createdAt: string; lastLoginAt: string | null
    role: { id: string; name: string } | null
    region: { id: string; name: string } | null
    regionalOffice: { id: string; name: string } | null
    permissions: Array<{ module: string; canCreate: boolean; canView: boolean; canUpdate: boolean; canDelete: boolean; canRequisition: boolean }>
    statusHistory: Array<{ id: string; status: string; reason: string | null; changedAt: string }>
}

type RoleRow = { id: string; name: string }
type RegionRow = { id: string; name: string }
type OfficeRow = { id: string; name: string; regionId: string | null }
type AuditLog = { id: string; event: string; module: string | null; description: string | null; createdAt: string }

interface Props {
    user: UserData
    roles: RoleRow[]
    regions: RegionRow[]
    offices: OfficeRow[]
    auditLogs: AuditLog[]
    isAdmin: boolean
    canUpdate?: boolean
}

type Tab = "general" | "permissions" | "status-history" | "audit"

function fmt(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function UserProfileClient({ user: initial, roles, regions, offices, auditLogs, isAdmin, canUpdate }: Props) {
    const showEdit = canUpdate ?? isAdmin
    const [user, setUser] = useState(initial)
    const [tab, setTab] = useState<Tab>("general")
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({
        name: initial.name,
        contactNumber: initial.contactNumber ?? "",
        roleId: initial.role?.id ?? "",
        regionId: initial.region?.id ?? "",
        regionalOfficeId: initial.regionalOffice?.id ?? "",
        status: initial.status,
    })
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState("")
    const [error, setError] = useState("")

    const filteredOffices = offices.filter((o) => !form.regionId || o.regionId === form.regionId)

    const handleSave = async () => {
        setSaving(true); setNotice(""); setError("")
        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name || undefined,
                    contactNumber: form.contactNumber || null,
                    roleId: form.roleId || undefined,
                    regionId: form.regionId || null,
                    regionalOfficeId: form.regionalOfficeId || null,
                    status: form.status,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || "Failed to update")
            setUser((prev) => ({
                ...prev,
                name: form.name,
                contactNumber: form.contactNumber || null,
                status: form.status,
                role: roles.find((r) => r.id === form.roleId) ?? prev.role,
                region: regions.find((r) => r.id === form.regionId) ?? null,
                regionalOffice: offices.find((o) => o.id === form.regionalOfficeId) ?? null,
            }))
            setEditing(false)
            setNotice("Profile updated successfully.")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update")
        } finally { setSaving(false) }
    }

    const tabs: { key: Tab; label: string }[] = [
        { key: "general", label: "General Information" },
        { key: "permissions", label: "Permissions" },
        { key: "status-history", label: "Status History" },
        { key: "audit", label: "Audit Logs" },
    ]

    return (
        <div className="space-y-6">
            {notice && <InlineAlert type="success" message={notice} />}
            {error && <InlineAlert type="error" message={error} />}

            {/* Header card */}
            <div className="ui-card p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-2xl font-bold shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--text)]">{user.name}</h1>
                            <p className="text-[var(--text-muted)] text-sm">{user.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                                {user.role && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        <Shield className="h-3 w-3" />{user.role.name}
                                    </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                                    {user.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    {showEdit && (
                        <button type="button" onClick={() => setEditing((v) => !v)}
                            className="ui-btn ui-btn-secondary text-sm">
                            {editing ? "Cancel" : "Edit Profile"}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--border)]">
                <div className="flex gap-0 overflow-x-auto">
                    {tabs.map((t) => (
                        <button key={t.key} type="button" onClick={() => setTab(t.key)}
                            className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                                tab === t.key
                                    ? "border-[var(--brand)] text-[var(--brand)]"
                                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* General Information */}
            {tab === "general" && (
                <div className="ui-card p-6 space-y-6">
                    <h2 className="text-base font-semibold text-[var(--text)]">General Information</h2>
                    {editing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Full Name">
                                <input className="ui-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                            </Field>
                            <Field label="Contact Number">
                                <input className="ui-input" value={form.contactNumber} onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))} placeholder="+92-300-0000000" />
                            </Field>
                            <Field label="Role">
                                <select className="ui-select" value={form.roleId} onChange={(e) => setForm((p) => ({ ...p, roleId: e.target.value }))}>
                                    <option value="">-- Select Role --</option>
                                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Status">
                                <select className="ui-select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                </select>
                            </Field>
                            <Field label="Region">
                                <select className="ui-select" value={form.regionId}
                                    onChange={(e) => setForm((p) => ({ ...p, regionId: e.target.value, regionalOfficeId: "" }))}>
                                    <option value="">-- No Region --</option>
                                    {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Regional Office">
                                <select className="ui-select" value={form.regionalOfficeId} onChange={(e) => setForm((p) => ({ ...p, regionalOfficeId: e.target.value }))}
                                    disabled={!form.regionId}>
                                    <option value="">{form.regionId ? "-- Select Office --" : "-- Select Region First --"}</option>
                                    {filteredOffices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            </Field>
                            <div className="md:col-span-2 flex gap-2 pt-2">
                                <button type="button" onClick={handleSave} disabled={saving}
                                    className="ui-btn ui-btn-primary disabled:opacity-50">
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                                <button type="button" onClick={() => { setEditing(false); setError("") }}
                                    className="ui-btn ui-btn-secondary">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InfoRow icon={<User />} label="Full Name" value={user.name} />
                            <InfoRow icon={<Mail />} label="Email" value={user.email} />
                            <InfoRow icon={<Phone />} label="Contact" value={user.contactNumber || "—"} />
                            <InfoRow icon={<Shield />} label="Role" value={user.role?.name || "—"} />
                            <InfoRow icon={<MapPin />} label="Region" value={user.region?.name || "—"} />
                            <InfoRow icon={<MapPin />} label="Regional Office" value={user.regionalOffice?.name || "—"} />
                            <InfoRow icon={<Clock />} label="Created" value={fmt(user.createdAt)} />
                            <InfoRow icon={<Clock />} label="Last Login" value={user.lastLoginAt ? fmt(user.lastLoginAt) : "Never"} />
                        </div>
                    )}
                </div>
            )}

            {/* Permissions (read-only view) */}
            {tab === "permissions" && (
                <div className="ui-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-muted)] flex items-center gap-2">
                        <Lock className="h-4 w-4 text-[var(--text-muted)]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            Additional User Permissions (on top of role)
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[640px]">
                            <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Module</th>
                                    {["CREATE", "VIEW", "UPDATE", "DELETE", "REQUISITIONS"].map((a) => (
                                        <th key={a} className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">{a}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {MODULES.map((mod) => {
                                    const p = user.permissions.find((x) => x.module === mod)
                                    const vals = [p?.canCreate, p?.canView, p?.canUpdate, p?.canDelete, p?.canRequisition]
                                    return (
                                        <tr key={mod} className="hover:bg-[var(--surface-muted)]">
                                            <td className="px-4 py-3 font-medium text-[var(--text)]">{mod}</td>
                                            {vals.map((v, i) => (
                                                <td key={i} className="px-4 py-3 text-center">
                                                    {v
                                                        ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                                                        : <XCircle className="h-4 w-4 text-gray-300 mx-auto" />}
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Status History */}
            {tab === "status-history" && (
                <div className="ui-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-muted)] flex items-center gap-2">
                        <History className="h-4 w-4 text-[var(--text-muted)]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status History</h2>
                    </div>
                    {user.statusHistory.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">No status history recorded.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                                    <tr>
                                        {["Status", "Reason", "Date"].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {user.statusHistory.map((h) => (
                                        <tr key={h.id} className="hover:bg-[var(--surface-muted)]">
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${h.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                                                    {h.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-muted)]">{h.reason || "—"}</td>
                                            <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">{fmt(h.changedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Audit Logs */}
            {tab === "audit" && (
                <div className="ui-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--surface-muted)] flex items-center gap-2">
                        <History className="h-4 w-4 text-[var(--text-muted)]" />
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Audit Logs</h2>
                        <span className="ml-auto text-xs text-[var(--text-muted)]">{auditLogs.length} records</span>
                    </div>
                    {auditLogs.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">No audit logs found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                                    <tr>
                                        {["Event", "Module", "Description", "Date"].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {auditLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-[var(--surface-muted)]">
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">{log.event}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{log.module || "—"}</td>
                                            <td className="px-4 py-3 text-[var(--text)] max-w-sm truncate" title={log.description ?? ""}>{log.description || "—"}</td>
                                            <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">{fmt(log.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="ui-label">{label}</label>
            {children}
        </div>
    )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[var(--text-muted)] h-4 w-4 shrink-0">{icon}</span>
            <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
                <p className="text-sm font-medium text-[var(--text)] mt-0.5">{value}</p>
            </div>
        </div>
    )
}