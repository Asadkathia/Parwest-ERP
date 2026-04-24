"use client"

import { useState, useEffect, useCallback } from "react"
import { GraduationCap, Plus, Trash2, X } from "lucide-react"

type Training = {
    id: string
    trainingType: string
    completedAt: string
    instructor: string | null
    notes: string | null
    createdAt: string
}

type RegionalOffice = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string; supervisorName: string | null; contactPerson: string | null }

interface OnJobTrainingsTabProps {
    guardId: string
    canCreate?: boolean
    canDelete?: boolean
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
    supervisorWithUniform: false,
}

export default function OnJobTrainingsTab({ guardId, canCreate = false, canDelete = false }: OnJobTrainingsTabProps) {
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

    const fetchTrainings = useCallback(async () => {
        try {
            const res = await fetch(`/api/guards/${guardId}/trainings`)
            if (res.ok) setTrainings(await res.json())
        } finally {
            setLoading(false)
        }
    }, [guardId])

    useEffect(() => { fetchTrainings() }, [fetchTrainings])

    // Load regional offices once on modal open
    useEffect(() => {
        if (!showModal || regionalOffices.length > 0) return
        fetch("/api/regional-offices")
            .then(r => r.ok ? r.json() : [])
            .then(setRegionalOffices)
            .catch(() => {})
    }, [showModal, regionalOffices.length])

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
            .catch(() => {})
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
            .catch(() => {})
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
    }

    const handleAdd = async () => {
        if (!form.completedAt) return
        setSaving(true)
        try {
            const notes = [
                `Regional Office: ${form.regionalOfficeName || "-"}`,
                `Client: ${form.clientName || "-"}`,
                `Branch: ${form.branchName || "-"}`,
                `Branch Supervisor: ${form.branchSupervisor || "-"}`,
                `Branch Manager: ${form.branchManager || "-"}`,
                `Armorer: ${form.armorer ? "Yes" : "No"}`,
                `Supervisor With Uniform: ${form.supervisorWithUniform ? "Yes" : "No"}`,
                `Conducted By: ${form.conductedBy || "-"}`,
                ...(form.remarks ? [`Remarks: ${form.remarks}`] : []),
            ].join(" | ")

            const res = await fetch(`/api/guards/${guardId}/trainings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    trainingType: "ON_JOB",
                    completedAt: form.completedAt,
                    instructor: form.conductedBy || null,
                    notes,
                }),
            })
            if (res.ok) {
                closeModal()
                fetchTrainings()
            }
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (trainingId: string) => {
        if (!confirm("Delete this training record?")) return
        await fetch(`/api/guards/${guardId}/trainings/${trainingId}`, { method: "DELETE" })
        fetchTrainings()
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
                                        <td className="px-4 py-3 text-sm">{n["armorer"] || "—"}</td>
                                        <td className="px-4 py-3 text-sm">{n["supervisor with uniform"] || "—"}</td>
                                        <td className="px-4 py-3">
                                            {canDelete ? (
                                                <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700">
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
                                <div className="border rounded-lg px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Armorer</span>
                                    <div className="flex gap-4 text-sm">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="radio" checked={form.armorer} onChange={() => setForm(f => ({ ...f, armorer: true }))} />
                                            Yes
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="radio" checked={!form.armorer} onChange={() => setForm(f => ({ ...f, armorer: false }))} />
                                            No
                                        </label>
                                    </div>
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
        </div>
    )
}
