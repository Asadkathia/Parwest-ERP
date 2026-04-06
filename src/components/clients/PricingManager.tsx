"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, ChevronRight, FileText, Tag, CheckCircle2, Pencil } from "lucide-react"

// ── Static data ────────────────────────────────────────────────────────────────
const PROVINCE_OPTIONS = ["Punjab", "Sindh", "KPK", "Balochistan", "Islamabad", "All Pakistan"]

const CITY_OPTIONS = [
    "All Cities","Lahore","Gujranwala","Sahiwal","Islamabad","Karachi","Multan",
    "Faisalabad","Khanpur","Chichawatni","Bahawalpur","Mian Channu","Khanewal",
    "Ahmedpur East","Attock","Bahawalnagar","Bhakkar","Burewala","Chakwal",
    "Chiniot","Daska","Gujrat","Hafizabad","Jhang","Kasur","Khushab",
    "Mandi Bahauddin","Mianwali","Narowal","Okara","Pakpattan","Rahim Yar Khan",
    "Rawalpindi","Sheikhupura","Sialkot","Toba Tek Singh","Vehari",
]

const CONTRACT_TYPE_OPTIONS = ["GENERAL", "SPECIAL", "RENEWAL"]

// ── Types ──────────────────────────────────────────────────────────────────────
type ContractRate = {
    id: string
    province: string | null
    city: string | null
    guardType: string
    exService: string | null
    rate: number
    extraHourRate: number | null
    isCurrentRate: boolean
    rateStartDate: string | null
    rateEndDate: string | null
}

type Contract = {
    id: string
    clientId: string
    branchId: string | null
    branch: { id: string; name: string } | null
    name: string
    type: string
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
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
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

const inputCls = "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"

// ── Add / Edit Contract Modal ──────────────────────────────────────────────────
function ContractFormModal({
    clientId, branches, isBranchless, existing, onClose, onSaved,
}: {
    clientId: string
    branches: Branch[]
    isBranchless: boolean
    existing?: Contract
    onClose: () => void
    onSaved: (c: Contract) => void
}) {
    const isEdit = !!existing
    const [form, setForm] = useState({
        name: existing?.name ?? "",
        type: existing?.type ?? "GENERAL",
        startDate: toInputDate(existing?.startDate),
        endDate: toInputDate(existing?.endDate),
        branchId: existing?.branchId ?? "",
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
                    ...(!isEdit && { branchId: form.branchId || null }),
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            onSaved(await res.json())
        } catch {
            setError("Failed to save contract.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal title={isEdit ? "Edit Contract" : "Add New Contract"} onClose={onClose}>
            <div className="space-y-4">
                {!isEdit && !isBranchless && (
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
                    <div />
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

// ── Add Rate Modal ─────────────────────────────────────────────────────────────
function AddRateModal({
    clientId, contractId, guardTypes, exServiceTypes, onClose, onCreated,
}: {
    clientId: string
    contractId: string
    guardTypes: string[]
    exServiceTypes: string[]
    onClose: () => void
    onCreated: (r: ContractRate) => void
}) {
    const [form, setForm] = useState({
        province: "", city: "", guardType: guardTypes[0] ?? "", exService: "",
        rate: "", extraHourRate: "", isCurrentRate: false,
        rateStartDate: "", rateEndDate: "",
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

    async function submit() {
        if (!form.guardType) { setError("Guard type is required."); return }
        if (!form.rate || isNaN(Number(form.rate))) { setError("A valid rate is required."); return }
        setLoading(true); setError("")
        try {
            const res = await fetch(`/api/clients/${clientId}/contracts/${contractId}/rates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    province: form.province || null,
                    city: form.city || null,
                    guardType: form.guardType,
                    exService: form.exService || null,
                    rate: Number(form.rate),
                    extraHourRate: form.extraHourRate ? Number(form.extraHourRate) : null,
                    isCurrentRate: form.isCurrentRate,
                    rateStartDate: form.rateStartDate || null,
                    rateEndDate: form.rateEndDate || null,
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            onCreated(await res.json())
        } catch {
            setError("Failed to add rate.")
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
                        <p className="text-xs text-[var(--text-muted)]">Deactivates previous current rate for this guard type</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => set("isCurrentRate", !form.isCurrentRate)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.isCurrentRate ? "bg-green-500" : "bg-gray-300"}`}
                    >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isCurrentRate ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Rate Start Date">
                        <input type="date" value={form.rateStartDate} onChange={(e) => set("rateStartDate", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Rate End Date">
                        <input type="date" value={form.rateEndDate} onChange={(e) => set("rateEndDate", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Province">
                        <select value={form.province} onChange={(e) => set("province", e.target.value)} className={inputCls}>
                            <option value="">— All Provinces —</option>
                            {PROVINCE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </Field>
                    <Field label="City">
                        <select value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls}>
                            <option value="">— All Cities —</option>
                            {CITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </Field>
                    <Field label="Guard Type *">
                        <select value={form.guardType} onChange={(e) => set("guardType", e.target.value)} className={inputCls}>
                            {guardTypes.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </Field>
                    <Field label="Ex-Service Type">
                        <select value={form.exService} onChange={(e) => set("exService", e.target.value)} className={inputCls}>
                            <option value="">— Any —</option>
                            {exServiceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
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

// ── Contract Card ──────────────────────────────────────────────────────────────
function ContractCard({
    contract, clientId, guardTypes, exServiceTypes, onContractUpdated, onRateAdded, onRatesUpdated,
}: {
    contract: Contract
    clientId: string
    guardTypes: string[]
    exServiceTypes: string[]
    onContractUpdated: (c: Contract) => void
    onRateAdded: (contractId: string, rate: ContractRate) => void
    onRatesUpdated: (contractId: string, rates: ContractRate[]) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const [showAddRate, setShowAddRate] = useState(false)
    const [showEditContract, setShowEditContract] = useState(false)
    const [markingCurrentId, setMarkingCurrentId] = useState<string | null>(null)

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
        <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-slate-50">
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex flex-1 items-center gap-3 text-left"
                >
                    <ChevronRight className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${expanded ? "rotate-90" : ""}`} />
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-semibold text-[var(--text)]">{contract.name}</span>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{contract.type}</span>
                            {contract.branch ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{contract.branch.name}</span>
                            ) : (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Client-Level</span>
                            )}
                            {!contract.isActive && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Inactive</span>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {fmt(contract.startDate)} → {fmt(contract.endDate)}
                            {" · "}{contract.rates.length} rate{contract.rates.length !== 1 ? "s" : ""}
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
                        onClick={() => { setExpanded(true); setShowAddRate(true) }}
                        className="ui-btn ui-btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                    >
                        <Plus className="h-3 w-3" /> Add Rate
                    </button>
                </div>
            </div>

            {/* Rates table */}
            {expanded && (
                <div className="overflow-x-auto">
                    {contract.rates.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                            No rates added yet. Click <strong>Add Rate</strong> to configure guard rates for this contract.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-slate-50">
                                    {["Province","City","Guard Type","Ex-Service","Rate (PKR)","Extra/Hr (PKR)","Rate Period","Current","Action"].map((h) => (
                                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {contract.rates.map((rate) => (
                                    <tr
                                        key={rate.id}
                                        className={`border-b border-[var(--border)] transition-colors ${rate.isCurrentRate ? "bg-green-50" : "hover:bg-slate-50"}`}
                                    >
                                        <td className="px-4 py-2.5 text-[var(--text)]">{rate.province || "—"}</td>
                                        <td className="px-4 py-2.5 text-[var(--text)]">{rate.city || "—"}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                <Tag className="h-3 w-3" />{rate.guardType}
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
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
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
                                                    className="rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
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
                    guardTypes={guardTypes}
                    exServiceTypes={exServiceTypes}
                    onClose={() => setShowAddRate(false)}
                    onCreated={(rate) => { onRateAdded(contract.id, rate); setShowAddRate(false) }}
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
        </div>
    )
}

// ── Main PricingManager ────────────────────────────────────────────────────────
export default function PricingManager({ clientId, clientName, branches, isBranchless }: Props) {
    const [contracts, setContracts] = useState<Contract[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddContract, setShowAddContract] = useState(false)
    const [filterBranchId, setFilterBranchId] = useState<string>("all")
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

    function onRateAdded(contractId: string, rate: ContractRate) {
        setContracts((prev) => prev.map((c) =>
            c.id === contractId ? { ...c, rates: [...c.rates, rate] } : c
        ))
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
                    {!isBranchless && (
                        <select
                            value={filterBranchId}
                            onChange={(e) => setFilterBranchId(e.target.value)}
                            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
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
                <div className="rounded-xl border border-[var(--border)] bg-white px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                    Loading contracts…
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-5 py-12 text-center">
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
                        />
                    ))}
                </div>
            )}

            {showAddContract && (
                <ContractFormModal
                    clientId={clientId}
                    branches={branches}
                    isBranchless={isBranchless}
                    onClose={() => setShowAddContract(false)}
                    onSaved={onContractCreated}
                />
            )}
        </div>
    )
}
