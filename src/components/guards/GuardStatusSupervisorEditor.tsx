"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Pencil } from "lucide-react"
import SearchSelect, { type SearchSelectOption } from "@/components/ui/SearchSelect"

// Settable lifecycle choices only. PRESENT / DEFAULT are derived from deployment
// state server-side and ABSENT / BLACKLISTED are handled by other workflows.
const STATUS_OPTIONS: { value: string; label: string; description: string; color: string }[] = [
    { value: "PENDING",    label: "Pending",    description: "No deployment yet — awaiting verification",         color: "bg-orange-100 text-orange-800" },
    { value: "ACTIVE",     label: "Active",     description: "Verified and ready for deployment",                 color: "bg-green-100 text-green-800" },
    { value: "INACTIVE",   label: "Inactive",   description: "Resigned / left the company",                       color: "bg-gray-200 text-gray-700" },
    { value: "TERMINATED", label: "Terminated", description: "Employment terminated",                             color: "bg-red-100 text-red-800" },
]

// Display-only colors for the status badge (covers derived values too).
const DISPLAY_STATUS_COLORS: Record<string, string> = {
    PENDING:    "bg-orange-100 text-orange-800",
    ACTIVE:     "bg-green-100 text-green-800",
    PRESENT:    "bg-blue-100 text-blue-800",
    DEFAULT:    "bg-cyan-100 text-cyan-800",
    INACTIVE:   "bg-gray-200 text-gray-700",
    TERMINATED: "bg-red-100 text-red-800",
}

const DISPLAY_STATUS_LABELS: Record<string, string> = {
    PENDING:    "Pending",
    ACTIVE:     "Active",
    PRESENT:    "Present",
    DEFAULT:    "Default",
    INACTIVE:   "Inactive",
    TERMINATED: "Terminated",
}

const TERMINATION_REASON_OPTIONS: { value: string; label: string }[] = [
    { value: "RESIGNED",  label: "Resigned" },
    { value: "FIRED",     label: "Fired" },
    { value: "ABSCONDED", label: "Absconded" },
    { value: "DECEASED",  label: "Deceased" },
    { value: "OTHER",     label: "Other" },
]

function statusColor(status: string) {
    return DISPLAY_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"
}

type User = { id: string; name: string | null; email: string | null; role?: { name: string } | null }

interface Props {
    guardId: string
    currentStatus: string
    currentSupervisorName?: string | null
    isSuperAdmin?: boolean
    canUpdate?: boolean
    /** Guard's region/office — used to scope supervisor list. Server still enforces. */
    guardRegionId?: string | null
    guardRegionalOfficeId?: string | null
}

export default function GuardStatusSupervisorEditor({ guardId, currentStatus, currentSupervisorName, isSuperAdmin = false, canUpdate = false, guardRegionId = null, guardRegionalOfficeId = null }: Props) {
    const [status, setStatus] = useState(currentStatus)
    const [supervisorName, setSupervisorName] = useState(currentSupervisorName ?? null)

    // ── Status modal state ──
    const [statusOpen, setStatusOpen] = useState(false)
    const [newStatus, setNewStatus] = useState(currentStatus)
    const [statusReason, setStatusReason] = useState("")
    const [statusSaving, setStatusSaving] = useState(false)
    const [statusError, setStatusError] = useState("")
    const [absconded, setAbsconded] = useState(false)
    const [terminationReason, setTerminationReason] = useState<string>("")

    const isTerminal = newStatus === "TERMINATED"

    // ── Supervisor modal state ──
    const [supOpen, setSupOpen] = useState(false)
    const [users, setUsers] = useState<User[]>([])
    const [selectedSupId, setSelectedSupId] = useState("")
    const [supNotes, setSupNotes] = useState("")
    const [supSaving, setSupSaving] = useState(false)
    const [supError, setSupError] = useState("")
    const supFetched = useRef(false)

    const supervisorOptions = useMemo<SearchSelectOption[]>(
        () => users
            .filter((u) => u.role?.name?.toLowerCase().includes("supervisor"))
            .map((u) => ({ value: u.id, label: u.name || u.email || u.id })),
        [users]
    )

    const openSupervisorModal = async () => {
        setSupOpen(true)
        setSupError("")
        setSelectedSupId("")
        setSupNotes("")
        if (!supFetched.current) {
            supFetched.current = true
            try {
                const params = new URLSearchParams({ status: "ACTIVE" })
                if (guardRegionalOfficeId) params.set("regionalOfficeId", guardRegionalOfficeId)
                else if (guardRegionId) params.set("regionId", guardRegionId)
                const res = await fetch(`/api/users?${params.toString()}`)
                if (res.ok) setUsers(await res.json())
            } catch { /* ignore */ }
        }
    }

    const saveStatus = async () => {
        if (!newStatus || newStatus === status) { setStatusOpen(false); return }
        if (isTerminal && !terminationReason) {
            setStatusError("Termination reason is required.")
            return
        }
        if (isTerminal && absconded && !statusReason.trim()) {
            setStatusError("Reason is required when marking the guard as absconded.")
            return
        }
        if (isTerminal) {
            const label = STATUS_OPTIONS.find((s) => s.value === newStatus)?.label ?? newStatus
            const confirmMsg = absconded
                ? `Mark this guard as ${label} with ABSCONDED? Any assigned inventory will be written off as LOST. This cannot be undone.`
                : `Mark this guard as ${label}? If the guard still has assigned kit or held documents, the server will block this — run clearance first.`
            if (!window.confirm(confirmMsg)) return
        }
        setStatusSaving(true)
        setStatusError("")
        try {
            const body: Record<string, unknown> = { status: newStatus, reason: statusReason }
            if (isTerminal) {
                body.terminationReason = terminationReason
                if (absconded) body.absconded = true
            }
            const res = await fetch(`/api/guards/${guardId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                if (res.status === 409 && isTerminal && !absconded) {
                    setStatusError(`${d.message || "Guard still has outstanding items."} Tick \"Guard has absconded\" below to terminate anyway (kit will be written off as LOST).`)
                    return
                }
                throw new Error(d.message || "Failed to update status")
            }
            setStatus(newStatus)
            setStatusOpen(false)
            setStatusReason("")
            setAbsconded(false)
            setTerminationReason("")
        } catch (e: unknown) {
            setStatusError(e instanceof Error ? e.message : "Error updating status")
        } finally {
            setStatusSaving(false)
        }
    }

    const saveSupervisor = async () => {
        if (!selectedSupId) { setSupError("Please select a supervisor"); return }
        setSupSaving(true)
        setSupError("")
        try {
            const res = await fetch(`/api/guards/${guardId}/supervisor`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ supervisorId: selectedSupId, notes: supNotes }),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                throw new Error(d.message || "Failed to update supervisor")
            }
            const data = await res.json()
            setSupervisorName(data.supervisorName ?? supervisorOptions.find((o) => o.value === selectedSupId)?.label ?? null)
            setSupOpen(false)
        } catch (e: unknown) {
            setSupError(e instanceof Error ? e.message : "Error updating supervisor")
        } finally {
            setSupSaving(false)
        }
    }

    // Reset status choice when opening modal. Default to a settable value
    // (PENDING / ACTIVE / INACTIVE / TERMINATED) — the current displayed status
    // may be a derived value like PRESENT/DEFAULT which isn't a valid choice.
    useEffect(() => {
        if (statusOpen) {
            const settable = STATUS_OPTIONS.some((o) => o.value === status)
            setNewStatus(settable ? status : "ACTIVE")
            setStatusReason("")
            setStatusError("")
            setAbsconded(false)
            setTerminationReason("")
        }
    }, [statusOpen, status])

    return (
        <>
            {/* Status badge + edit */}
            <div className="flex items-center gap-1.5">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor(status)}`}>
                    {DISPLAY_STATUS_LABELS[status] ?? status}
                </span>
                {isSuperAdmin && canUpdate && (
                    <button
                        type="button"
                        title="Edit status"
                        onClick={() => setStatusOpen(true)}
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        <Pencil size={13} />
                    </button>
                )}
            </div>

            {/* Supervisor + edit */}
            <div className="flex items-center gap-1.5 mt-1">
                <span className="text-sm text-gray-600">
                    Supervisor: <span className="font-medium text-gray-800">{supervisorName || "—"}</span>
                </span>
                {canUpdate && (
                    <button
                        type="button"
                        title="Change supervisor"
                        onClick={openSupervisorModal}
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        <Pencil size={13} />
                    </button>
                )}
            </div>

            {/* ── Status Edit Modal ── */}
            {statusOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-semibold">Change Guard Status</h3>

                        <div className="space-y-2">
                            {STATUS_OPTIONS.map((opt) => (
                                <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${newStatus === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                                    <input
                                        type="radio"
                                        name="guard-status"
                                        value={opt.value}
                                        checked={newStatus === opt.value}
                                        onChange={() => setNewStatus(opt.value)}
                                        className="mt-0.5"
                                    />
                                    <div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>{opt.label}</span>
                                        <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {isTerminal && (
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                    Termination Reason <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={terminationReason}
                                    onChange={(e) => setTerminationReason(e.target.value)}
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                >
                                    <option value="">Select a reason...</option>
                                    {TERMINATION_REASON_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isTerminal && (
                            <label className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={absconded}
                                    onChange={(e) => setAbsconded(e.target.checked)}
                                    className="mt-0.5"
                                />
                                <div className="text-sm">
                                    <div className="font-medium text-red-800">Guard has absconded (forfeit kit as LOST)</div>
                                    <p className="text-xs text-red-700 mt-0.5">
                                        Normally, termination requires clearance first (return kit, release documents). Tick this only if the guard has run away and clearance cannot be completed — any assigned inventory will be written off as LOST.
                                    </p>
                                </div>
                            </label>
                        )}

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">
                                Reason / Notes {isTerminal && absconded ? <span className="text-red-500">*</span> : <span className="text-gray-400">(recommended)</span>}
                            </label>
                            <textarea
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                rows={2}
                                className="w-full border rounded-md px-3 py-2 text-sm resize-none"
                                placeholder={isTerminal && absconded ? "Required: describe the circumstances (e.g. guard stopped reporting on 12 Apr, phone unreachable)..." : "e.g. Guard is on medical leave, resigned, redeployed..."}
                            />
                        </div>

                        {statusError && <p className="text-sm text-red-600">{statusError}</p>}

                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setStatusOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50">Cancel</button>
                            <button
                                type="button"
                                onClick={saveStatus}
                                disabled={statusSaving || newStatus === status}
                                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {statusSaving ? "Saving..." : "Save Status"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Supervisor Change Modal ── */}
            {supOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-semibold">Change Supervisor</h3>
                        {currentSupervisorName && (
                            <p className="text-sm text-gray-500">Current: <span className="font-medium">{supervisorName}</span></p>
                        )}

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">New Supervisor <span className="text-red-500">*</span></label>
                            <SearchSelect
                                key="sup-select"
                                name="supervisorId"
                                options={supervisorOptions}
                                placeholder={users.length === 0 ? "Loading supervisors..." : "Search supervisor..."}
                                onChange={setSelectedSupId}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
                            <input
                                value={supNotes}
                                onChange={(e) => setSupNotes(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                                placeholder="Reason for supervisor change..."
                            />
                        </div>

                        {supError && <p className="text-sm text-red-600">{supError}</p>}

                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setSupOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50">Cancel</button>
                            <button
                                type="button"
                                onClick={saveSupervisor}
                                disabled={supSaving}
                                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {supSaving ? "Saving..." : "Save Supervisor"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
