"use client"

import { useState, useEffect, useCallback } from "react"
import { GraduationCap, Plus, Trash2, X, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import { Button } from "@/components/shadcn/button"

type TrainingCheck = {
    id: string
    categoryId: string
    completed: boolean
    completedAt: string | null
    notes: string | null
    category?: { id: string; name: string; sortOrder: number }
}

type Training = {
    id: string
    trainingType: string
    completedAt: string
    instructor: string | null
    notes: string | null
    createdAt: string
    ojtChecks?: TrainingCheck[]
}

type TrainingCategory = {
    id: string
    name: string
    description: string | null
    isActive: boolean
    sortOrder: number
}

type CheckDraft = {
    completed: boolean
    notes: string
    showNotes: boolean
}

type RegionalOffice = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string; supervisorName: string | null; contactPerson: string | null }

interface OnJobTrainingsTabProps {
    guardId: string
    canCreate?: boolean
    canDelete?: boolean
    /** Region/office of the guard — used to filter modal client/RO dropdowns. Server still enforces. */
    guardRegionId?: string | null
    guardRegionalOfficeId?: string | null
}

function parseNotes(raw: string | null): Record<string, string> {
    if (!raw) return {}
    const result: Record<string, string> = {}
    for (const part of raw.split("|")) {
        const idx = part.indexOf(":")
        if (idx === -1) continue
        const key = part.slice(0, idx).trim().toLowerCase()
        const val = part.slice(idx + 1).trim()
        if (val && val !== "-") result[key] = val
    }
    return result
}

const EMPTY_FORM = {
    completedAt: "",
    regionalOfficeId: "",
    regionalOfficeName: "",
    clientId: "",
    clientName: "",
    branchId: "",
    branchName: "",
    branchSupervisor: "",
    branchManager: "",
    conductedBy: "",
    remarks: "",
    armorer: false,
    armorerName: "",
    supervisorWithUniform: false,
}

export default function OnJobTrainingsTab({ guardId, canCreate = false, canDelete = false, guardRegionId = null, guardRegionalOfficeId = null }: OnJobTrainingsTabProps) {
    const [trainings, setTrainings] = useState<Training[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)

    const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [loadingClients, setLoadingClients] = useState(false)
    const [loadingBranches, setLoadingBranches] = useState(false)

    // Training categories (admin-managed lookup) + per-category draft state for the form.
    const [categories, setCategories] = useState<TrainingCategory[]>([])
    const [categoryChecks, setCategoryChecks] = useState<Record<string, CheckDraft>>({})

    const fetchTrainings = useCallback(async () => {
        try {
            const res = await fetch(`/api/guards/${guardId}/trainings`)
            if (res.ok) setTrainings(await res.json())
        } finally {
            setLoading(false)
        }
    }, [guardId])

    useEffect(() => { fetchTrainings() }, [fetchTrainings])

    // Load training categories once on modal open and reset per-category drafts.
    useEffect(() => {
        if (!showModal) return
        fetch("/api/training-categories")
            .then((r) => r.ok ? r.json() : { data: [] })
            .then((payload) => {
                const list: TrainingCategory[] = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.data) ? payload.data : []
                setCategories(list)
                setCategoryChecks((prev) => {
                    const next: Record<string, CheckDraft> = {}
                    for (const cat of list) {
                        next[cat.id] = prev[cat.id] ?? { completed: false, notes: "", showNotes: false }
                    }
                    return next
                })
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : undefined
                toast.error("Failed to load training categories", { description: message })
                console.warn(err)
            })
    }, [showModal])

    // Load regional offices once on modal open. When the guard is region-scoped,
    // pass ?regionId= so REGIONAL users only see offices under the guard's region.
    useEffect(() => {
        if (!showModal || regionalOffices.length > 0) return
        const url = guardRegionId
            ? `/api/regional-offices?regionId=${guardRegionId}`
            : "/api/regional-offices"
        fetch(url)
            .then(r => r.ok ? r.json() : [])
            .then((data: RegionalOffice[]) => {
                setRegionalOffices(data)
                // Pre-select the guard's regional office (locked) so the user
                // doesn't have to pick it themselves.
                if (guardRegionalOfficeId) {
                    const office = data.find(o => o.id === guardRegionalOfficeId)
                    if (office) {
                        setForm(f => ({ ...f, regionalOfficeId: office.id, regionalOfficeName: office.name }))
                    }
                }
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : undefined
                toast.error("Failed to load regional offices", { description: message })
                console.warn(err)
            })
    }, [showModal, regionalOffices.length, guardRegionId, guardRegionalOfficeId])

    // Load clients when regional office changes
    useEffect(() => {
        setClients([])
        setBranches([])
        setForm(f => ({ ...f, clientId: "", clientName: "", branchId: "", branchName: "", branchSupervisor: "" }))
        if (!form.regionalOfficeId) return
        setLoadingClients(true)
        fetch(`/api/clients?regionalOfficeId=${form.regionalOfficeId}&status=ACTIVE`)
            .then(r => r.ok ? r.json() : [])
            .then(setClients)
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : undefined
                toast.error("Failed to load clients", { description: message })
                console.warn(err)
            })
            .finally(() => setLoadingClients(false))
    }, [form.regionalOfficeId])

    // Load branches when client changes
    useEffect(() => {
        setBranches([])
        setForm(f => ({ ...f, branchId: "", branchName: "", branchSupervisor: "" }))
        if (!form.clientId) return
        setLoadingBranches(true)
        fetch(`/api/clients/${form.clientId}/branches`)
            .then(r => r.ok ? r.json() : [])
            .then(setBranches)
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : undefined
                toast.error("Failed to load branches", { description: message })
                console.warn(err)
            })
            .finally(() => setLoadingBranches(false))
    }, [form.clientId])

    const handleRegionalOfficeChange = (id: string) => {
        const office = regionalOffices.find(o => o.id === id)
        setForm(f => ({ ...f, regionalOfficeId: id, regionalOfficeName: office?.name ?? "" }))
    }

    const handleClientChange = (id: string) => {
        const client = clients.find(c => c.id === id)
        setForm(f => ({ ...f, clientId: id, clientName: client?.name ?? "" }))
    }

    const handleBranchChange = (id: string) => {
        const branch = branches.find(b => b.id === id)
        setForm(f => ({
            ...f,
            branchId: id,
            branchName: branch?.name ?? "",
            branchSupervisor: branch?.supervisorName ?? f.branchSupervisor,
        }))
    }

    const closeModal = () => {
        setShowModal(false)
        setForm(EMPTY_FORM)
        setClients([])
        setBranches([])
        setCategoryChecks((prev) => {
            const reset: Record<string, CheckDraft> = {}
            for (const id of Object.keys(prev)) reset[id] = { completed: false, notes: "", showNotes: false }
            return reset
        })
    }

    const toggleCheck = (categoryId: string) => {
        setCategoryChecks((prev) => ({
            ...prev,
            [categoryId]: { ...(prev[categoryId] ?? { completed: false, notes: "", showNotes: false }), completed: !(prev[categoryId]?.completed ?? false) },
        }))
    }

    const toggleNotes = (categoryId: string) => {
        setCategoryChecks((prev) => ({
            ...prev,
            [categoryId]: { ...(prev[categoryId] ?? { completed: false, notes: "", showNotes: false }), showNotes: !(prev[categoryId]?.showNotes ?? false) },
        }))
    }

    const updateCheckNotes = (categoryId: string, value: string) => {
        setCategoryChecks((prev) => ({
            ...prev,
            [categoryId]: { ...(prev[categoryId] ?? { completed: false, notes: "", showNotes: true }), notes: value },
        }))
    }

    const handleAdd = async () => {
        // Inline validation — equivalent to RHF onInvalid: surface the first
        // missing-field error as a toast rather than failing silently.
        if (!form.completedAt) {
            toast.error("Date is required", { description: "Pick the date the training was completed." })
            return
        }
        setSaving(true)
        const completedCount = Object.values(categoryChecks).filter((c) => c?.completed).length
        try {
            const notes = [
                `Regional Office: ${form.regionalOfficeName || "-"}`,
                `Client: ${form.clientName || "-"}`,
                `Branch: ${form.branchName || "-"}`,
                `Branch Supervisor: ${form.branchSupervisor || "-"}`,
                `Branch Manager: ${form.branchManager || "-"}`,
                `Armorer: ${form.armorer ? "Yes" : "No"}`,
                ...(form.armorer && form.armorerName.trim() ? [`Armorer Name: ${form.armorerName.trim()}`] : []),
                `Supervisor With Uniform: ${form.supervisorWithUniform ? "Yes" : "No"}`,
                `Conducted By: ${form.conductedBy || "-"}`,
                ...(form.remarks ? [`Remarks: ${form.remarks}`] : []),
            ].join(" | ")

            // TODO(2026-04-29): The two existing booleans (Armorer, SupervisorWithUniform)
            // are still serialized into `notes` for backwards compatibility. They should
            // eventually be migrated to TrainingCategory entries by the user — do NOT
            // auto-migrate (preserves admin control over the canonical category list).
            const trainingChecks = categories
                .map((cat) => {
                    const draft = categoryChecks[cat.id]
                    if (!draft) return null
                    return {
                        categoryId: cat.id,
                        completed: !!draft.completed,
                        notes: draft.notes.trim() || null,
                    }
                })
                .filter(Boolean) as Array<{ categoryId: string; completed: boolean; notes: string | null }>

            const res = await fetch(`/api/guards/${guardId}/trainings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    trainingType: "ON_JOB",
                    completedAt: form.completedAt,
                    instructor: form.conductedBy || null,
                    notes,
                    trainingChecks,
                }),
            })
            // API envelope is `{ success, message, code }` — read `data.message`,
            // not `data.error` (see CLAUDE.md API envelope gotcha).
            const data = await res.json().catch(() => ({} as { message?: string }))
            if (res.ok) {
                toast.success("Training session saved", {
                    description: `${completedCount} training check${completedCount === 1 ? "" : "s"} marked complete`,
                })
                closeModal()
                fetchTrainings()
            } else {
                const msg = (data && typeof data.message === "string" && data.message) || "Failed to save training session"
                toast.error(msg)
            }
        } catch (err: unknown) {
            const description = err instanceof Error ? err.message : undefined
            toast.error("Network error. Please try again.", { description })
            console.warn(err)
        } finally {
            setSaving(false)
        }
    }

    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    const handleConfirmDelete = async () => {
        if (!pendingDeleteId) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/guards/${guardId}/trainings/${pendingDeleteId}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({} as { message?: string }))
            if (res.ok) {
                toast.success("Training session deleted")
                setPendingDeleteId(null)
                fetchTrainings()
            } else {
                const msg = (data && typeof data.message === "string" && data.message) || "Failed to delete training session"
                toast.error(msg)
            }
        } catch (err: unknown) {
            const description = err instanceof Error ? err.message : undefined
            toast.error("Network error. Please try again.", { description })
            console.warn(err)
        } finally {
            setDeleting(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">OnJob Trainings</h2>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Sessions: <span className="font-semibold">{trainings.length}</span></span>
                    {canCreate && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4" /> Add Training
                        </button>
                    )}
                </div>
            </div>

            {trainings.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No training sessions found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Regional Office</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conducted By</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Armorer</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sup. Uniform</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Checks</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {trainings.map((t) => {
                                const n = parseNotes(t.notes)
                                return (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                            {new Date(t.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{n["regional office"] || "—"}</td>
                                        <td className="px-4 py-3 text-sm">{n["client"] || "—"}</td>
                                        <td className="px-4 py-3 text-sm">{n["branch"] || "—"}</td>
                                        <td className="px-4 py-3 text-sm">{n["conducted by"] || t.instructor || "—"}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {n["armorer"] === "Yes"
                                                ? (n["armorer name"] ? `Yes (${n["armorer name"]})` : "Yes")
                                                : (n["armorer"] || "—")}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{n["supervisor with uniform"] || "—"}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {(() => {
                                                const total = t.ojtChecks?.length ?? 0
                                                if (total === 0) return <span className="text-gray-400">—</span>
                                                const done = t.ojtChecks?.filter((c) => c.completed).length ?? 0
                                                return (
                                                    <span title={t.ojtChecks?.map((c) => `${c.category?.name ?? c.categoryId}: ${c.completed ? "Yes" : "No"}`).join("\n")}>
                                                        {done}/{total}
                                                    </span>
                                                )
                                            })()}
                                        </td>
                                        <td className="px-4 py-3">
                                            {canDelete ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setPendingDeleteId(t.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    aria-label="Delete training session"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b sticky top-0 bg-white z-10">
                            <h3 className="text-lg font-semibold">Add OJT Session</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                        </div>

                        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Date */}
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.completedAt}
                                    onChange={e => setForm(f => ({ ...f, completedAt: e.target.value }))}
                                />
                            </div>

                            {/* Regional Office */}
                            {guardRegionalOfficeId ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Regional Office</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={
                                            regionalOffices.find(o => o.id === guardRegionalOfficeId)?.name
                                            || form.regionalOfficeName
                                            || "Locked to guard's office"
                                        }
                                        className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Locked to this guard&apos;s regional office.</p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Regional Office</label>
                                    <select
                                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={form.regionalOfficeId}
                                        onChange={e => handleRegionalOfficeChange(e.target.value)}
                                    >
                                        <option value="">— Select Regional Office —</option>
                                        {regionalOffices.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Client */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                                    value={form.clientId}
                                    onChange={e => handleClientChange(e.target.value)}
                                    disabled={!form.regionalOfficeId || loadingClients}
                                >
                                    <option value="">
                                        {loadingClients ? "Loading..." : form.regionalOfficeId ? "— Select Client —" : "— Select office first —"}
                                    </option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Branch */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                                    value={form.branchId}
                                    onChange={e => handleBranchChange(e.target.value)}
                                    disabled={!form.clientId || loadingBranches}
                                >
                                    <option value="">
                                        {loadingBranches ? "Loading..." : form.clientId ? "— Select Branch —" : "— Select client first —"}
                                    </option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Branch Supervisor — auto-filled from branch */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Branch Supervisor
                                    {form.branchId && form.branchSupervisor && (
                                        <span className="ml-2 text-xs text-green-600 font-normal">auto-filled</span>
                                    )}
                                </label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.branchSupervisor}
                                    onChange={e => setForm(f => ({ ...f, branchSupervisor: e.target.value }))}
                                    placeholder="Branch supervisor"
                                />
                            </div>

                            {/* Branch Manager */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Manager</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.branchManager}
                                    onChange={e => setForm(f => ({ ...f, branchManager: e.target.value }))}
                                    placeholder="Branch manager"
                                />
                            </div>

                            {/* Conducted By */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Conducted By</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.conductedBy}
                                    onChange={e => setForm(f => ({ ...f, conductedBy: e.target.value }))}
                                    placeholder="Instructor / trainer name"
                                />
                            </div>

                            {/* Armorer & Supervisor Uniform */}
                            <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                                <div className="border rounded-lg px-4 py-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700">Armorer</span>
                                        <div className="flex gap-4 text-sm">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="radio" checked={form.armorer} onChange={() => setForm(f => ({ ...f, armorer: true }))} />
                                                Yes
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={!form.armorer}
                                                    onChange={() => setForm(f => ({ ...f, armorer: false, armorerName: "" }))}
                                                />
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    {form.armorer && (
                                        <input
                                            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={form.armorerName}
                                            onChange={e => setForm(f => ({ ...f, armorerName: e.target.value }))}
                                            placeholder="Armorer name"
                                            maxLength={200}
                                        />
                                    )}
                                </div>
                                <div className="border rounded-lg px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Supervisor Uniform</span>
                                    <div className="flex gap-4 text-sm">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="radio" checked={form.supervisorWithUniform} onChange={() => setForm(f => ({ ...f, supervisorWithUniform: true }))} />
                                            Yes
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="radio" checked={!form.supervisorWithUniform} onChange={() => setForm(f => ({ ...f, supervisorWithUniform: false }))} />
                                            No
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Training Checks (admin-managed categories) */}
                            <div className="sm:col-span-2">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Training Checks</label>
                                    {categories.length > 0 && (
                                        <span className="text-xs text-gray-500">
                                            {Object.values(categoryChecks).filter((c) => c?.completed).length}/{categories.length} completed
                                        </span>
                                    )}
                                </div>
                                {categories.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic border rounded-lg px-3 py-2">
                                        No training categories configured. Ask an admin to set them up under Settings → Training Categories.
                                    </p>
                                ) : (
                                    <div className="border rounded-lg divide-y">
                                        {categories.map((cat) => {
                                            const draft = categoryChecks[cat.id] ?? { completed: false, notes: "", showNotes: false }
                                            return (
                                                <div key={cat.id} className="px-3 py-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={draft.completed}
                                                                onChange={() => toggleCheck(cat.id)}
                                                                className="h-4 w-4 rounded border-gray-300"
                                                            />
                                                            <span className="text-sm text-gray-800 truncate">{cat.name}</span>
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleNotes(cat.id)}
                                                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                                            aria-label={draft.showNotes ? "Hide notes" : "Add notes"}
                                                        >
                                                            {draft.showNotes ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                            Notes
                                                        </button>
                                                    </div>
                                                    {draft.showNotes && (
                                                        <textarea
                                                            className="mt-2 w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            rows={2}
                                                            value={draft.notes}
                                                            onChange={(e) => updateCheckNotes(cat.id, e.target.value)}
                                                            placeholder={`Notes for ${cat.name}...`}
                                                        />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Remarks */}
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                                <textarea
                                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={2}
                                    value={form.remarks}
                                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                                    placeholder="Any additional remarks..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 px-6 pb-6 pt-2 border-t">
                            <button onClick={closeModal} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                            <button
                                onClick={handleAdd}
                                disabled={saving || !form.completedAt}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save Training"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog
                open={!!pendingDeleteId}
                onOpenChange={(o) => { if (!o) setPendingDeleteId(null) }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this training record?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the training session and any associated checks.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button
                                variant="destructive"
                                disabled={deleting}
                                onClick={(e) => {
                                    // Prevent default close-on-click so we can await
                                    // the API call and surface errors via toast.
                                    e.preventDefault()
                                    void handleConfirmDelete()
                                }}
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
