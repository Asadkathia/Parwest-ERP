"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, ChevronRight, FileText, Tag, CheckCircle2, Pencil, Users, Trash2 } from "lucide-react"
import { useRegions } from "@/lib/hooks/useRegions"
import { PROVINCE_VALUES } from "@/lib/geo/province-constants"

// ── Static data ────────────────────────────────────────────────────────────────
const CONTRACT_TYPE_OPTIONS = ["GENERAL", "SPECIAL", "RENEWAL"]
const BILLING_MODE_OPTIONS = ["MANUAL", "DYNAMIC"] as const

const SCOPE_LEVEL_OPTIONS = ["BRANCH", "REGION", "PROVINCE", "GLOBAL"] as const
type ScopeLevel = (typeof SCOPE_LEVEL_OPTIONS)[number]
type BillingMode = "MANUAL" | "DYNAMIC"

// ── Types ──────────────────────────────────────────────────────────────────────
type ContractRate = {
    id: string
    scopeLevel: ScopeLevel
    scopeBranchId: string | null
    scopeRegionId: string | null
    scopeProvince: string | null
    guardType: string | null
    exService: string | null
    rate: number
    extraHourRate: number | null
    isCurrentRate: boolean
    rateStartDate: string | null
    rateEndDate: string | null
}

type GuardRate = {
    guardId: string
    parwestId: string
    name: string
    rate: number
    extraHourRate: number | null
    contractGuardRateId: string | null
}

type Contract = {
    id: string
    clientId: string
    branchId: string | null
    branch: { id: string; name: string; province: string | null; city: string | null } | null
    name: string
    type: string
    billingMode: BillingMode
    startDate: string | null
    endDate: string | null
    isActive: boolean
    createdAt: string
    rates: ContractRate[]
}

type Branch = {
    id: string
    name: string
}

type Props = {
    clientId: string
    clientName: string
    branches: Branch[]
    isBranchless: boolean
    /**
     * When rendered embedded on a single branch's page, lock the manager to that
     * branch: the contract list defaults to (and stays on) this branch's
     * contracts, and new contracts are fixed to it.
     */
    lockedBranchId?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(d: string | null | undefined) {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
}

function toInputDate(d: string | null | undefined) {
    if (!d) return ""
    return new Date(d).toISOString().slice(0, 10)
}

// ── Modal wrapper ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-xl bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text)]">{title}</h3>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none">×</button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</label>
            {children}
        </div>
    )
}

const inputCls = "w-full rounded-lg border border-[var(--border)] bg-card px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"

// ── Add / Edit Contract Modal ──────────────────────────────────────────────────
function ContractFormModal({
    clientId, branches, isBranchless, lockedBranchId, existing, onClose, onSaved,
}: {
    clientId: string
    branches: Branch[]
    isBranchless: boolean
    /** When set, a new contract is fixed to this branch and the picker is hidden. */
    lockedBranchId?: string
    existing?: Contract
    onClose: () => void
    onSaved: (c: Contract) => void
}) {
    const isEdit = !!existing
    const [form, setForm] = useState({
        name: existing?.name ?? "",
        type: existing?.type ?? "GENERAL",
        billingMode: (existing?.billingMode ?? "MANUAL") as BillingMode,
        startDate: toInputDate(existing?.startDate),
        endDate: toInputDate(existing?.endDate),
        branchId: existing?.branchId ?? lockedBranchId ?? "",
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

    async function submit() {
        if (!form.name.trim()) { setError("Contract name is required."); return }
        setLoading(true); setError("")
        try {
            const url = isEdit
                ? `/api/clients/${clientId}/contracts/${existing!.id}`
                : `/api/clients/${clientId}/contracts`
            const method = isEdit ? "PATCH" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    type: form.type,
                    startDate: form.startDate || null,
                    endDate: form.endDate || null,
                    // billingMode is only set on create — editing the mode is out of scope.
                    ...(!isEdit && { branchId: form.branchId || null, billingMode: form.billingMode }),
                }),
            })
            if (!res.ok) {
                let msg = "Failed to save contract."
                try { const d = await res.json(); if (d?.message) msg = d.message } catch { /* non-JSON */ }
                throw new Error(msg)
            }
            onSaved(await res.json())
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save contract.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal title={isEdit ? "Edit Contract" : "Add New Contract"} onClose={onClose}>
            <div className="space-y-4">
                {!isEdit && !isBranchless && !lockedBranchId && (
                    <Field label="Branch (leave empty for client-level contract)">
                        <select value={form.branchId} onChange={(e) => set("branchId", e.target.value)} className={inputCls}>
                            <option value="">— Client-level contract —</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </Field>
                )}
                <Field label="Contract Name *">
                    <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HBL Main Branch 2026" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Contract Type">
                        <select value={form.type} onChange={(e) => set("type", e.target.value)} className={inputCls}>
                            {CONTRACT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </Field>
                    <Field label="Billing Mode">
                        {isEdit ? (
                            <div className={`${inputCls} bg-muted text-[var(--text-muted)]`}>{form.billingMode}</div>
                        ) : (
                            <select value={form.billingMode} onChange={(e) => set("billingMode", e.target.value)} className={inputCls}>
                                {BILLING_MODE_OPTIONS.map((m) => (
                                    <option key={m} value={m}>{m === "MANUAL" ? "Manual (scoped rates)" : "Dynamic (per-guard rates)"}</option>
                                ))}
                            </select>
                        )}
                    </Field>
                    <Field label="Start Date">
                        <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="End Date">
                        <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputCls} />
                    </Field>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="ui-btn ui-btn-secondary">Cancel</button>
                    <button onClick={submit} disabled={loading} className="ui-btn ui-btn-primary">
                        {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Contract"}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

// ── Add Rate Modal (MANUAL billing — scope-based) ────────────────────────────────
function AddRateModal({
    clientId, contractId, branch, branchId, guardTypes, exServiceTypes, onClose, onCreated,
}: {
    clientId: string
    contractId: string
    branch: { province: string | null; city: string | null } | null
    branchId: string | null
    guardTypes: string[]
    exServiceTypes: string[]
    onClose: () => void
    onCreated: (r: ContractRate) => void
}) {
    const { regions, loading: regionsLoading } = useRegions()
    // A contract bound to a branch may target the BRANCH scope; client-level
    // contracts (no branch) cannot, so we drop BRANCH from the options.
    const hasBranchContext = !!branchId
    const scopeLevels = hasBranchContext
        ? SCOPE_LEVEL_OPTIONS
        : SCOPE_LEVEL_OPTIONS.filter((l) => l !== "BRANCH")

    const [form, setForm] = useState({
        scopeLevel: (scopeLevels[0] ?? "GLOBAL") as ScopeLevel,
        scopeRegionId: "",
        scopeProvince: PROVINCE_VALUES[0] as string,
        guardType: guardTypes[0] ?? "",
        exServiceYes: false,
        exServiceType: exServiceTypes[0] ?? "",
        rate: "", extraHourRate: "", isCurrentRate: false,
        rateStartDate: "", rateEndDate: "",
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

    async function submit() {
        if (!form.guardType) { setError("Guard type is required."); return }
        if (form.exServiceYes && !form.exServiceType) { setError("Select an ex-service type."); return }
        if (form.scopeLevel === "REGION" && !form.scopeRegionId) { setError("Select a region for REGION scope."); return }
        if (form.scopeLevel === "PROVINCE" && !form.scopeProvince) { setError("Select a province for PROVINCE scope."); return }
        if (form.scopeLevel === "BRANCH" && !branchId) { setError("No branch context for BRANCH scope."); return }
        if (!form.rate || isNaN(Number(form.rate))) { setError("A valid rate is required."); return }
        setLoading(true); setError("")
        try {
            const exService = form.exServiceYes ? form.exServiceType : "CIVILIAN"
            const scopeFields: Record<string, string> = {}
            if (form.scopeLevel === "BRANCH" && branchId) scopeFields.scopeBranchId = branchId
            if (form.scopeLevel === "REGION") scopeFields.scopeRegionId = form.scopeRegionId
            if (form.scopeLevel === "PROVINCE") scopeFields.scopeProvince = form.scopeProvince
            const res = await fetch(`/api/clients/${clientId}/contracts/${contractId}/rates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scopeLevel: form.scopeLevel,
                    ...scopeFields,
                    guardType: form.guardType,
                    exService,
                    rate: Number(form.rate),
                    extraHourRate: form.extraHourRate ? Number(form.extraHourRate) : null,
                    isCurrentRate: form.isCurrentRate,
                    rateStartDate: form.rateStartDate || null,
                    rateEndDate: form.rateEndDate || null,
                }),
            })
            if (!res.ok) {
                let msg = "Failed to add rate."
                try { const d = await res.json(); if (d?.message) msg = d.message } catch { /* non-JSON */ }
                throw new Error(msg)
            }
            onCreated(await res.json())
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to add rate.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal title="Add Contract Rate" onClose={onClose}>
            <div className="space-y-4">
                {/* Is Current Rate toggle */}
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--text)]">Mark as Current Rate</p>
                        <p className="text-xs text-[var(--text-muted)]">Deactivates the previous current rate for this scope</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => set("isCurrentRate", !form.isCurrentRate)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.isCurrentRate ? "bg-green-500" : "bg-muted-foreground/30 dark:bg-muted-foreground/40"}`}
                    >
                        <span className={`inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ${form.isCurrentRate ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                </div>

                {/* Scope picker */}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Scope Level *">
                        <select value={form.scopeLevel} onChange={(e) => set("scopeLevel", e.target.value)} className={inputCls}>
                            {scopeLevels.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </Field>
                    {form.scopeLevel === "REGION" && (
                        <Field label="Region *">
                            <select value={form.scopeRegionId} onChange={(e) => set("scopeRegionId", e.target.value)} className={inputCls}>
                                <option value="">{regionsLoading ? "Loading regions…" : "— Select region —"}</option>
                                {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </Field>
                    )}
                    {form.scopeLevel === "PROVINCE" && (
                        <Field label="Province *">
                            <select value={form.scopeProvince} onChange={(e) => set("scopeProvince", e.target.value)} className={inputCls}>
                                {PROVINCE_VALUES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </Field>
                    )}
                    {form.scopeLevel === "BRANCH" && (
                        <Field label="Branch (this contract)">
                            <div className={`${inputCls} bg-muted text-[var(--text-muted)]`}>
                                {branch?.city ? `${branch.city}${branch.province ? `, ${branch.province}` : ""}` : "This branch"}
                            </div>
                        </Field>
                    )}
                    {form.scopeLevel === "GLOBAL" && (
                        <Field label="Scope Target">
                            <div className={`${inputCls} bg-muted text-[var(--text-muted)]`}>All locations (global)</div>
                        </Field>
                    )}
                </div>

                {/* Ex-service yes/no + type */}
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3">
                    <div>
                        <p className="text-sm font-medium text-[var(--text)]">Ex-Service</p>
                        <p className="text-xs text-[var(--text-muted)]">Has the guard previously served? If no, the rate is stored as Civilian.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => set("exServiceYes", !form.exServiceYes)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.exServiceYes ? "bg-green-500" : "bg-muted-foreground/30 dark:bg-muted-foreground/40"}`}
                    >
                        <span className={`inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ${form.exServiceYes ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {form.exServiceYes && (
                        <Field label="Ex-Service Type *">
                            <select value={form.exServiceType} onChange={(e) => set("exServiceType", e.target.value)} className={inputCls}>
                                {exServiceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                    )}
                    <Field label="Guard Type *">
                        <select value={form.guardType} onChange={(e) => set("guardType", e.target.value)} className={inputCls}>
                            {guardTypes.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </Field>
                    <Field label="Rate Start Date">
                        <input type="date" value={form.rateStartDate} onChange={(e) => set("rateStartDate", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Rate End Date">
                        <input type="date" value={form.rateEndDate} onChange={(e) => set("rateEndDate", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Effective Rate (PKR) *">
                        <input type="number" value={form.rate} onChange={(e) => set("rate", e.target.value)} placeholder="e.g. 40000" className={inputCls} />
                    </Field>
                    <Field label="Extra Hour Rate (PKR/hr)">
                        <input type="number" value={form.extraHourRate} onChange={(e) => set("extraHourRate", e.target.value)} placeholder="e.g. 500" className={inputCls} />
                    </Field>
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="ui-btn ui-btn-secondary">Cancel</button>
                    <button onClick={submit} disabled={loading} className="ui-btn ui-btn-primary">
                        {loading ? "Adding…" : "Add Rate"}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

// ── Guard Rates Modal (DYNAMIC billing — per-guard) ──────────────────────────────
function GuardRatesModal({
    clientId, contractId, onClose,
}: {
    clientId: string
    contractId: string
    onClose: () => void
}) {
    const [rows, setRows] = useState<GuardRate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [savingId, setSavingId] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError("")
        try {
            const res = await fetch(`/api/clients/${clientId}/contracts/${contractId}/guard-rates`)
            if (!res.ok) {
                let msg = "Failed to load guard rates."
                try { const d = await res.json(); if (d?.message) msg = d.message } catch { /* non-JSON */ }
                throw new Error(msg)
            }
            const data = await res.json() as GuardRate[]
            setRows(data)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load guard rates.")
        } finally {
            setLoading(false)
        }
    }, [clientId, contractId])

    useEffect(() => { load() }, [load])

    const setRow = (guardId: string, k: "rate" | "extraHourRate", v: number | null) =>
        setRows((prev) => prev.map((r) => r.guardId === guardId ? { ...r, [k]: v } : r))

    async function save(row: GuardRate) {
        if (row.rate == null || isNaN(Number(row.rate))) { setError("Enter a valid rate before saving."); return }
        setSavingId(row.guardId); setError("")
        try {
            const res = await fetch(`/api/clients/${clientId}/contracts/${contractId}/guard-rates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guardId: row.guardId,
                    rate: Number(row.rate),
                    extraHourRate: row.extraHourRate != null ? Number(row.extraHourRate) : null,
                }),
            })
            if (!res.ok) {
                let msg = "Failed to save guard rate."
                try { const d = await res.json(); if (d?.message) msg = d.message } catch { /* non-JSON */ }
                throw new Error(msg)
            }
            const saved = await res.json() as GuardRate
            setRows((prev) => prev.map((r) => r.guardId === saved.guardId ? saved : r))
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save guard rate.")
        } finally {
            setSavingId(null)
        }
    }

    return (
        <Modal title="Per-Guard Rates (Dynamic)" onClose={onClose}>
            <div className="space-y-4">
                {error && <p className="text-xs text-red-600">{error}</p>}
                {loading ? (
                    <div className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">Loading guards…</div>
                ) : rows.length === 0 ? (
                    <div className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">
                        No guards enrolled on this contract yet.
                    </div>
                ) : (
                    <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-[var(--border)]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-muted">
                                    {["Guard", "Rate (PKR)", "Extra/Hr (PKR)", ""].map((h) => (
                                        <th key={h} className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.guardId} className="border-b border-[var(--border)] last:border-0">
                                        <td className="px-3 py-2">
                                            <div className="text-sm font-medium text-[var(--text)]">{row.name}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{row.parwestId}</div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                value={row.rate ?? ""}
                                                onChange={(e) => setRow(row.guardId, "rate", e.target.value === "" ? null : Number(e.target.value))}
                                                placeholder="e.g. 40000"
                                                className={`${inputCls} !py-1.5`}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                value={row.extraHourRate ?? ""}
                                                onChange={(e) => setRow(row.guardId, "extraHourRate", e.target.value === "" ? null : Number(e.target.value))}
                                                placeholder="e.g. 500"
                                                className={`${inputCls} !py-1.5`}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <button
                                                onClick={() => save(row)}
                                                disabled={savingId === row.guardId}
                                                className="ui-btn ui-btn-primary !py-1.5 !px-3 !text-xs"
                                            >
                                                {savingId === row.guardId ? "…" : "Save"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="ui-btn ui-btn-secondary">Close</button>
                </div>
            </div>
        </Modal>
    )
}

// ── Contract Card ──────────────────────────────────────────────────────────────
function scopeLabel(rate: ContractRate, regionsById: Map<string, string>): string {
    switch (rate.scopeLevel) {
        case "BRANCH": return "Branch"
        case "REGION": return `Region: ${rate.scopeRegionId ? (regionsById.get(rate.scopeRegionId) ?? rate.scopeRegionId) : "—"}`
        case "PROVINCE": return `Province: ${rate.scopeProvince ?? "—"}`
        case "GLOBAL": return "Global"
        default: return "—"
    }
}

function ContractCard({
    contract, clientId, guardTypes, exServiceTypes, onContractUpdated, onRateAdded, onRatesUpdated, onContractDeleted,
}: {
    contract: Contract
    clientId: string
    guardTypes: string[]
    exServiceTypes: string[]
    onContractUpdated: (c: Contract) => void
    onRateAdded: (contractId: string, rate: ContractRate) => void
    onRatesUpdated: (contractId: string, rates: ContractRate[]) => void
    onContractDeleted: (contractId: string) => void
}) {
    const { regions } = useRegions()
    const regionsById = new Map(regions.map((r) => [r.id, r.name]))
    const isDynamic = contract.billingMode === "DYNAMIC"
    const [expanded, setExpanded] = useState(false)
    const [showAddRate, setShowAddRate] = useState(false)
    const [showGuardRates, setShowGuardRates] = useState(false)
    const [showEditContract, setShowEditContract] = useState(false)
    const [markingCurrentId, setMarkingCurrentId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState("")

    async function deleteContract() {
        setDeleting(true)
        setDeleteError("")
        let succeeded = false
        try {
            const res = await fetch(`/api/clients/${clientId}/contracts/${contract.id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setDeleteError(data?.message || "Failed to delete contract.")
                return
            }
            succeeded = true
        } catch {
            setDeleteError("Failed to delete contract.")
        } finally {
            setDeleting(false)
        }
        // Call last: this unmounts the card, so do it after local state cleanup.
        if (succeeded) onContractDeleted(contract.id)
    }

    async function markAsCurrent(rateId: string) {
        setMarkingCurrentId(rateId)
        try {
            const res = await fetch(`/api/clients/${clientId}/contracts/${contract.id}/rates`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rateId }),
            })
            if (res.ok) {
                const updatedRates: ContractRate[] = await res.json()
                onRatesUpdated(contract.id, updatedRates)
            }
        } finally {
            setMarkingCurrentId(null)
        }
    }

    return (
        <div className="rounded-xl border border-[var(--border)] bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-muted">
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex flex-1 items-center gap-3 text-start"
                >
                    <ChevronRight className={`h-4 w-4 text-[var(--text-muted)] transition-transform rtl:rotate-180 ${expanded ? "rotate-90 rtl:rotate-90" : ""}`} />
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-semibold text-[var(--text)]">{contract.name}</span>
                            <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">{contract.type}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isDynamic ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300" : "bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300"}`}>
                                {isDynamic ? "Dynamic" : "Manual"}
                            </span>
                            {contract.branch ? (
                                <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">{contract.branch.name}</span>
                            ) : (
                                <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">Client-Level</span>
                            )}
                            {!contract.isActive && (
                                <span className="rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-300">Inactive</span>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {fmt(contract.startDate)} → {fmt(contract.endDate)}
                            {" · "}{isDynamic
                                ? "Per-guard rates"
                                : `${contract.rates.length} rate${contract.rates.length !== 1 ? "s" : ""}`}
                        </p>
                    </div>
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowEditContract(true)}
                        className="ui-btn ui-btn-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                    >
                        <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                        onClick={() => { setDeleteError(""); setShowDeleteConfirm(true) }}
                        className="ui-btn ui-btn-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1.5 !text-red-600 dark:!text-red-400"
                    >
                        <Trash2 className="h-3 w-3" /> Delete
                    </button>
                    {isDynamic ? (
                        <button
                            onClick={() => setShowGuardRates(true)}
                            className="ui-btn ui-btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                        >
                            <Users className="h-3 w-3" /> Manage Guard Rates
                        </button>
                    ) : (
                        <button
                            onClick={() => { setExpanded(true); setShowAddRate(true) }}
                            className="ui-btn ui-btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                        >
                            <Plus className="h-3 w-3" /> Add Rate
                        </button>
                    )}
                </div>
            </div>

            {/* Rates body */}
            {expanded && (
                <div className="overflow-x-auto">
                    {isDynamic ? (
                        <div className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                            This contract uses <strong>dynamic per-guard rates</strong>. Click <strong>Manage Guard Rates</strong> to set a rate for each enrolled guard.
                        </div>
                    ) : contract.rates.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                            No rates added yet. Click <strong>Add Rate</strong> to configure guard rates for this contract.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-muted">
                                    {["Scope","Guard Type","Ex-Service","Rate (PKR)","Extra/Hr (PKR)","Rate Period","Current","Action"].map((h) => (
                                        <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {contract.rates.map((rate) => (
                                    <tr
                                        key={rate.id}
                                        className={`border-b border-[var(--border)] transition-colors ${rate.isCurrentRate ? "bg-green-50 dark:bg-green-950/30" : "hover:bg-muted"}`}
                                    >
                                        <td className="px-4 py-2.5 text-[var(--text)]">{scopeLabel(rate, regionsById)}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                                                <Tag className="h-3 w-3" />{rate.guardType || "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-[var(--text)]">{rate.exService || "—"}</td>
                                        <td className="px-4 py-2.5 font-semibold text-[var(--text)]">PKR {rate.rate.toLocaleString()}</td>
                                        <td className="px-4 py-2.5 text-[var(--text)]">{rate.extraHourRate != null ? `PKR ${rate.extraHourRate.toLocaleString()}` : "—"}</td>
                                        <td className="px-4 py-2.5 text-xs text-[var(--text-muted)]">
                                            {rate.rateStartDate || rate.rateEndDate
                                                ? `${fmt(rate.rateStartDate)} → ${fmt(rate.rateEndDate)}`
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {rate.isCurrentRate ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-950/40 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300">
                                                    <CheckCircle2 className="h-3 w-3" /> Current
                                                </span>
                                            ) : (
                                                <span className="text-xs text-[var(--text-muted)]">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {!rate.isCurrentRate && (
                                                <button
                                                    onClick={() => markAsCurrent(rate.id)}
                                                    disabled={markingCurrentId === rate.id}
                                                    title="Set as current rate"
                                                    className="rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/40 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/60 disabled:opacity-50"
                                                >
                                                    {markingCurrentId === rate.id ? "…" : "Set Current"}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {showAddRate && (
                <AddRateModal
                    clientId={clientId}
                    contractId={contract.id}
                    branch={contract.branch ? { province: contract.branch.province, city: contract.branch.city } : null}
                    branchId={contract.branchId}
                    guardTypes={guardTypes}
                    exServiceTypes={exServiceTypes}
                    onClose={() => setShowAddRate(false)}
                    onCreated={(rate) => { onRateAdded(contract.id, rate); setShowAddRate(false) }}
                />
            )}
            {showGuardRates && (
                <GuardRatesModal
                    clientId={clientId}
                    contractId={contract.id}
                    onClose={() => setShowGuardRates(false)}
                />
            )}
            {showEditContract && (
                <ContractFormModal
                    clientId={clientId}
                    branches={[]}
                    isBranchless={true}
                    existing={contract}
                    onClose={() => setShowEditContract(false)}
                    onSaved={(updated) => { onContractUpdated(updated); setShowEditContract(false) }}
                />
            )}
            {showDeleteConfirm && (
                <Modal title="Delete Contract" onClose={() => !deleting && setShowDeleteConfirm(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-[var(--text)]">
                            Delete contract <strong>{contract.name}</strong>? This permanently removes the contract and{" "}
                            <strong>
                                {isDynamic
                                    ? "all its per-guard rates"
                                    : `${contract.rates.length} rate${contract.rates.length !== 1 ? "s" : ""}`}
                            </strong>. This cannot be undone.
                        </p>
                        {deleteError && <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
                        <div className="flex justify-end gap-2">
                            <button className="ui-btn ui-btn-secondary !py-1.5 !px-3 !text-xs" disabled={deleting} onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button className="ui-btn ui-btn-danger !py-1.5 !px-3 !text-xs flex items-center gap-1.5" disabled={deleting} onClick={deleteContract}>
                                <Trash2 className="h-3 w-3" /> {deleting ? "Deleting…" : "Delete Contract"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}

// ── Main PricingManager ────────────────────────────────────────────────────────
export default function PricingManager({ clientId, clientName, branches, isBranchless, lockedBranchId }: Props) {
    const [contracts, setContracts] = useState<Contract[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddContract, setShowAddContract] = useState(false)
    // When locked to a branch, default the filter to it and keep it pinned.
    const [filterBranchId, setFilterBranchId] = useState<string>(lockedBranchId ?? "all")
    const [guardTypes, setGuardTypes] = useState<string[]>(["GUARD", "SUPERVISOR", "CPO", "ARMED GUARD", "UNARMED GUARD"])
    const [exServiceTypes, setExServiceTypes] = useState<string[]>(["ARMY", "POLICE", "RANGERS", "MUJAHID", "OTHER"])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [contractsRes, guardRes, exRes] = await Promise.all([
                fetch(`/api/clients/${clientId}/contracts`),
                fetch("/api/guard-designation-types?activeOnly=true"),
                fetch("/api/guard-ex-service-types?activeOnly=true"),
            ])
            if (contractsRes.ok) setContracts(await contractsRes.json())
            if (guardRes.ok) {
                const types = await guardRes.json() as { name: string }[]
                if (types.length > 0) setGuardTypes(types.map((t) => t.name))
            }
            if (exRes.ok) {
                const types = await exRes.json() as { name: string }[]
                if (types.length > 0) setExServiceTypes(types.map((t) => t.name))
            }
        } finally {
            setLoading(false)
        }
    }, [clientId])

    useEffect(() => { load() }, [load])

    function onContractCreated(c: Contract) {
        setContracts((prev) => [c, ...prev])
        setShowAddContract(false)
    }

    function onContractUpdated(updated: Contract) {
        setContracts((prev) => prev.map((c) => c.id === updated.id ? { ...updated, rates: c.rates } : c))
    }

    function onContractDeleted(contractId: string) {
        setContracts((prev) => prev.filter((c) => c.id !== contractId))
    }

    function onRateAdded(contractId: string, rate: ContractRate) {
        // Mirror the server's demote-before-create: when the new rate is current,
        // flip any existing current rate in the SAME scope to non-current so the
        // table doesn't show two "Current" rows until a reload.
        const sameScope = (a: ContractRate, b: ContractRate) =>
            a.scopeLevel === b.scopeLevel &&
            (a.scopeBranchId ?? null) === (b.scopeBranchId ?? null) &&
            (a.scopeRegionId ?? null) === (b.scopeRegionId ?? null) &&
            (a.scopeProvince ?? null) === (b.scopeProvince ?? null)
        setContracts((prev) => prev.map((c) => {
            if (c.id !== contractId) return c
            const existing = rate.isCurrentRate
                ? c.rates.map((r) => (sameScope(r, rate) ? { ...r, isCurrentRate: false } : r))
                : c.rates
            return { ...c, rates: [...existing, rate] }
        }))
    }

    function onRatesUpdated(contractId: string, rates: ContractRate[]) {
        setContracts((prev) => prev.map((c) =>
            c.id === contractId ? { ...c, rates } : c
        ))
    }

    const filtered = filterBranchId === "all"
        ? contracts
        : filterBranchId === "client"
            ? contracts.filter((c) => c.branchId === null)
            : contracts.filter((c) => c.branchId === filterBranchId)

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {!isBranchless && !lockedBranchId && (
                        <select
                            value={filterBranchId}
                            onChange={(e) => setFilterBranchId(e.target.value)}
                            className="rounded-lg border border-[var(--border)] bg-card px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                        >
                            <option value="all">All Contracts</option>
                            <option value="client">Client-Level</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">
                        {filtered.length} contract{filtered.length !== 1 ? "s" : ""}
                        {" · "}{filtered.reduce((s, c) => s + c.rates.length, 0)} rates
                    </span>
                </div>
                <button
                    onClick={() => setShowAddContract(true)}
                    className="ui-btn ui-btn-primary flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Add Contract
                </button>
            </div>

            {/* Contracts list */}
            {loading ? (
                <div className="rounded-xl border border-[var(--border)] bg-card px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                    Loading contracts…
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-card px-5 py-12 text-center">
                    <FileText className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
                    <p className="text-sm font-medium text-[var(--text)]">No contracts yet</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {isBranchless
                            ? `Add a contract for ${clientName} to configure guard rates.`
                            : "Add a client-level or branch-specific contract to configure guard rates."}
                    </p>
                    <button
                        onClick={() => setShowAddContract(true)}
                        className="ui-btn ui-btn-primary mt-4 mx-auto flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Add First Contract
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((contract) => (
                        <ContractCard
                            key={contract.id}
                            contract={contract}
                            clientId={clientId}
                            guardTypes={guardTypes}
                            exServiceTypes={exServiceTypes}
                            onContractUpdated={onContractUpdated}
                            onRateAdded={onRateAdded}
                            onRatesUpdated={onRatesUpdated}
                            onContractDeleted={onContractDeleted}
                        />
                    ))}
                </div>
            )}

            {showAddContract && (
                <ContractFormModal
                    clientId={clientId}
                    branches={branches}
                    isBranchless={isBranchless}
                    lockedBranchId={lockedBranchId}
                    onClose={() => setShowAddContract(false)}
                    onSaved={onContractCreated}
                />
            )}
        </div>
    )
}
