"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import SearchSelect, { type SearchSelectOption } from "@/components/ui/SearchSelect"

type Guard = {
    id: string
    parwestId: string
    name: string
    cnic: string
    designation?: string | null
}

type Residence = {
    id: string
    address: string
    supervisor: string | null
    occupied: number | null
    capacity: number | null
    city: string | null
    state: string | null
}

type User = {
    id: string
    name: string | null
    email: string | null
    role?: { id: string; name: string } | null
}

type Assignment = {
    id: string
    status: string
    assignedAt: string
    assignedByName: string | null
    vacatedAt: string | null
    vacatedByName: string | null
    vacatedReason: string | null
    notes: string | null
    guard: { id: string; parwestId: string; name: string; cnic: string }
    residence: { id: string; address: string; supervisor: string | null; city: string | null; state: string | null } | null
}

function fmt(date?: string | null) {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

type AssignResidenceFormProps = {
    lockedRegionId?: string | null
}

export default function AssignResidenceForm({ lockedRegionId = null }: AssignResidenceFormProps = {}) {
    const [guards, setGuards] = useState<Guard[]>([])
    const [residences, setResidences] = useState<Residence[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])

    const [supervisorName, setSupervisorName] = useState("")
    const [residenceId, setResidenceId] = useState("")
    const [guardId, setGuardId] = useState("")
    const [assignDate, setAssignDate] = useState("")
    const [comment, setComment] = useState("")

    const [loading, setLoading] = useState(false)
    const [listLoading, setListLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    // Vacate modal state
    const [vacateTarget, setVacateTarget] = useState<Assignment | null>(null)
    const [vacateReason, setVacateReason] = useState("")
    const [vacating, setVacating] = useState(false)
    const [vacateError, setVacateError] = useState("")

    const loadAssignments = useCallback(async () => {
        setListLoading(true)
        try {
            const res = await fetch("/api/residence-assignments")
            if (res.ok) setAssignments(await res.json())
        } catch { /* ignore */ } finally {
            setListLoading(false)
        }
    }, [])

    useEffect(() => {
        const loadStatic = async () => {
            try {
                const guardsUrl = lockedRegionId ? `/api/guards?regionId=${lockedRegionId}` : "/api/guards"
                const usersUrl = lockedRegionId
                    ? `/api/users?status=ACTIVE&regionId=${lockedRegionId}`
                    : "/api/users?status=ACTIVE"
                const [guardsRes, residencesRes, usersRes] = await Promise.all([
                    fetch(guardsUrl),
                    fetch("/api/residences"),
                    fetch(usersUrl),
                ])
                if (guardsRes.ok) setGuards(await guardsRes.json())
                if (residencesRes.ok) setResidences(await residencesRes.json())
                if (usersRes.ok) setUsers(await usersRes.json())
            } catch { /* ignore */ }
        }
        void loadStatic()
        void loadAssignments()
    }, [loadAssignments, lockedRegionId])

    const supervisorOptions = useMemo<SearchSelectOption[]>(
        () => users
            .filter((u) => u.role?.name?.toLowerCase().includes("supervisor"))
            .map((u) => ({ value: u.name || u.email || u.id, label: u.name || u.email || u.id })),
        [users]
    )

    // Filter residences by selected supervisor
    const filteredResidences = useMemo(
        () => supervisorName
            ? residences.filter((r) => r.supervisor === supervisorName)
            : residences,
        [residences, supervisorName]
    )

    const residenceOptions = useMemo<SearchSelectOption[]>(
        () => filteredResidences.map((r) => ({
            value: r.id,
            label: r.address + (r.city ? ` — ${r.city}` : ""),
        })),
        [filteredResidences]
    )

    const guardOptions = useMemo<SearchSelectOption[]>(
        () => guards.map((g) => ({
            value: g.id,
            label: `${g.parwestId} — ${g.name}`,
        })),
        [guards]
    )

    const selectedGuard = useMemo(() => guards.find((g) => g.id === guardId), [guards, guardId])
    const selectedResidence = useMemo(() => residences.find((r) => r.id === residenceId), [residences, residenceId])

    // When supervisor changes, clear residence selection
    const handleSupervisorChange = (val: string) => {
        setSupervisorName(val)
        setResidenceId("")
    }

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        if (!guardId || !residenceId) {
            setError("Guard and residence are required")
            return
        }

        try {
            setLoading(true)
            const response = await fetch("/api/residence-assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guardId,
                    residenceId,
                    assignedAt: assignDate || undefined,
                    notes: comment || undefined,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to assign residence")
            }

            setSuccess("Residence assigned successfully")
            setSupervisorName("")
            setResidenceId("")
            setGuardId("")
            setAssignDate("")
            setComment("")
            void loadAssignments()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to assign residence")
        } finally {
            setLoading(false)
        }
    }

    const handleVacate = async () => {
        if (!vacateTarget) return
        setVacating(true)
        setVacateError("")
        try {
            const res = await fetch(`/api/residence-assignments/${vacateTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: vacateReason }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || "Failed to vacate assignment")
            }
            setVacateTarget(null)
            setVacateReason("")
            void loadAssignments()
        } catch (err: unknown) {
            setVacateError(err instanceof Error ? err.message : "Failed to vacate")
        } finally {
            setVacating(false)
        }
    }

    const activeAssignments = assignments.filter((a) => a.status === "ACTIVE")
    const vacatedAssignments = assignments.filter((a) => a.status === "VACATED")

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Assign Residence</h1>
                <p className="text-gray-600 mt-1">Assign a guard to a residence under a supervisor</p>
            </div>

            {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
            {success ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert> : null}

            <form onSubmit={onSubmit} className="bg-white rounded-lg border p-6 space-y-5">
                <h2 className="font-semibold text-gray-700">New Assignment</h2>

                {/* Row 1: Supervisor → Residence → Guard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Supervisor</label>
                        <SearchSelect
                            key={"sup-" + supervisorName}
                            name="supervisor"
                            options={supervisorOptions}
                            placeholder="Search supervisor..."
                            defaultValue={supervisorName}
                            onChange={handleSupervisorChange}
                        />
                        <p className="text-xs text-gray-400 mt-1">Filters residences below</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Residence <span className="text-red-500">*</span></label>
                        <SearchSelect
                            key={"res-" + supervisorName + "-" + residenceId}
                            name="residenceId"
                            options={residenceOptions}
                            placeholder={supervisorName ? "Select residence..." : "Select supervisor first"}
                            defaultValue={residenceId}
                            onChange={setResidenceId}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Guard <span className="text-red-500">*</span></label>
                        <SearchSelect
                            key={"guard-" + guardId}
                            name="guardId"
                            options={guardOptions}
                            placeholder="Search guard..."
                            defaultValue={guardId}
                            onChange={setGuardId}
                        />
                    </div>
                </div>

                {/* Row 2: Auto-filled info + dates */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm text-gray-500 mb-1">Guard&apos;s Name</label>
                        <input className="w-full border rounded-md px-3 py-2 bg-gray-50 text-sm" value={selectedGuard?.name || ""} placeholder="Auto-filled" readOnly />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-500 mb-1">Guard&apos;s Type</label>
                        <input className="w-full border rounded-md px-3 py-2 bg-gray-50 text-sm" value={selectedGuard?.designation || ""} placeholder="Designation" readOnly />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-500 mb-1">Capacity</label>
                        <input className="w-full border rounded-md px-3 py-2 bg-gray-50 text-sm" value={selectedResidence ? `${selectedResidence.occupied ?? 0} / ${selectedResidence.capacity ?? 0}` : ""} placeholder="Occupied / Total" readOnly />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-500 mb-1">Assign Date</label>
                        <input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-gray-500 mb-1">Notes / Comment</label>
                    <input value={comment} onChange={(e) => setComment(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Optional notes..." />
                </div>

                <div>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save Assignment"}
                    </Button>
                </div>
            </form>

            {/* Active Assignments List */}
            <div className="bg-white rounded-lg border">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                    <h2 className="font-semibold">Active Assignments ({activeAssignments.length})</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Guard</th>
                                <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Residence</th>
                                <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Supervisor</th>
                                <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Location</th>
                                <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Assigned</th>
                                <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Assigned By</th>
                                <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Notes</th>
                                <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {listLoading ? (
                                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
                            ) : activeAssignments.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">No active assignments found.</td></tr>
                            ) : activeAssignments.map((a) => (
                                <tr key={a.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{a.guard.name}</div>
                                        <div className="text-xs text-gray-400">{a.guard.parwestId}</div>
                                    </td>
                                    <td className="px-4 py-3">{a.residence?.address || "—"}</td>
                                    <td className="px-4 py-3">{a.residence?.supervisor || "—"}</td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {[a.residence?.city, a.residence?.state].filter(Boolean).join(", ") || "—"}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">{fmt(a.assignedAt)}</td>
                                    <td className="px-4 py-3">{a.assignedByName || "—"}</td>
                                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{a.notes || "—"}</td>
                                    <td className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => { setVacateTarget(a); setVacateReason(""); setVacateError("") }}
                                            className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            Vacate
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Vacated History */}
            {vacatedAssignments.length > 0 && (
                <div className="bg-white rounded-lg border">
                    <div className="px-5 py-4 border-b">
                        <h2 className="font-semibold text-gray-500">Vacated History ({vacatedAssignments.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Guard</th>
                                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Residence</th>
                                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Supervisor</th>
                                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Assigned</th>
                                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Assigned By</th>
                                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Vacated</th>
                                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Vacated By</th>
                                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {vacatedAssignments.map((a) => (
                                    <tr key={a.id} className="hover:bg-gray-50 text-gray-500">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-700">{a.guard.name}</div>
                                            <div className="text-xs text-gray-400">{a.guard.parwestId}</div>
                                        </td>
                                        <td className="px-4 py-3">{a.residence?.address || "—"}</td>
                                        <td className="px-4 py-3">{a.residence?.supervisor || "—"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{fmt(a.assignedAt)}</td>
                                        <td className="px-4 py-3">{a.assignedByName || "—"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{fmt(a.vacatedAt)}</td>
                                        <td className="px-4 py-3">{a.vacatedByName || "—"}</td>
                                        <td className="px-4 py-3">{a.vacatedReason || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Vacate Confirm Modal */}
            {vacateTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-semibold">Vacate Residence Assignment</h3>
                        <p className="text-sm text-gray-600">
                            Vacate <span className="font-medium">{vacateTarget.guard.name}</span> from{" "}
                            <span className="font-medium">{vacateTarget.residence?.address || "this residence"}</span>?
                        </p>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
                            <input
                                value={vacateReason}
                                onChange={(e) => setVacateReason(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                                placeholder="e.g. Guard transferred, contract ended..."
                            />
                        </div>
                        {vacateError && <p className="text-sm text-red-600">{vacateError}</p>}
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setVacateTarget(null)}
                                className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleVacate}
                                disabled={vacating}
                                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {vacating ? "Vacating..." : "Confirm Vacate"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}