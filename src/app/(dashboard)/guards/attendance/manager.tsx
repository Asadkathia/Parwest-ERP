"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type AttendanceRecord = {
    id: string
    date: string
    status: string
    shiftType: string | null
    notes: string | null
    guard?: {
        id: string
        parwestId?: string
        name?: string
        cnic: string
    }
}

type GuardOption = {
    id: string
    parwestId: string
    name: string
}

type Props = {
    regions?: { id: string; name: string }[]
    regionLocked?: boolean
}

export default function GuardAttendanceManager({
    regions = [],
    regionLocked = false,
}: Props = {}) {
    const [parwestId, setParwestId] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")

    const [activeGuards, setActiveGuards] = useState<GuardOption[]>([])
    const [markGuardId, setMarkGuardId] = useState("")
    const [markDate, setMarkDate] = useState("")
    const [markStatus, setMarkStatus] = useState("PRESENT")
    const [markShift, setMarkShift] = useState("DAY")
    const [markNotes, setMarkNotes] = useState("")
    const [bulkGuardIds, setBulkGuardIds] = useState<string[]>([])
    const [bulkDate, setBulkDate] = useState("")
    const [bulkStatus, setBulkStatus] = useState("PRESENT")
    const [bulkShift, setBulkShift] = useState("DAY")
    const [bulkNotes, setBulkNotes] = useState("")
    const [bulkFile, setBulkFile] = useState<File | null>(null)
    const [bulkLoading, setBulkLoading] = useState(false)

    const loadAttendance = useCallback(async () => {
        try {
            setLoading(true)
            setError("")

            const params = new URLSearchParams()
            if (parwestId.trim()) params.set("parwestId", parwestId.trim())
            if (startDate) params.set("startDate", startDate)
            if (endDate) params.set("endDate", endDate)

            const response = await fetch(`/api/attendance?${params.toString()}`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch attendance")
            }

            const data = await response.json()
            setRecords(data)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setRecords([])
        } finally {
            setLoading(false)
        }
    }, [endDate, parwestId, startDate])

    const loadActiveGuards = useCallback(async () => {
        try {
            const response = await fetch("/api/guards?status=ACTIVE")
            if (!response.ok) return
            const data = await response.json()
            setActiveGuards(data)
        } catch {
            setActiveGuards([])
        }
    }, [])

    useEffect(() => {
        void loadAttendance()
        void loadActiveGuards()
    }, [loadActiveGuards, loadAttendance])

    const markAttendance = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setNotice("")

        const response = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                guardId: markGuardId,
                date: markDate,
                status: markStatus,
                shiftType: markShift,
                notes: markNotes,
            }),
        })

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setError(data.message || "Failed to mark attendance")
            return
        }

        setMarkNotes("")
        await loadAttendance()
        setNotice("Attendance marked successfully.")
    }

    const toggleBulkGuard = (guardId: string) => {
        setBulkGuardIds((prev) =>
            prev.includes(guardId) ? prev.filter((id) => id !== guardId) : [...prev, guardId]
        )
    }

    const bulkMarkAttendance = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!bulkDate || bulkGuardIds.length === 0) {
            setError("Select at least one guard and a date for bulk mark.")
            return
        }
        setBulkLoading(true)
        setError("")
        setNotice("")
        try {
            const results = await Promise.all(
                bulkGuardIds.map((guardId) =>
                    fetch("/api/attendance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            guardId,
                            date: bulkDate,
                            status: bulkStatus,
                            shiftType: bulkShift,
                            notes: bulkNotes || null,
                        }),
                    })
                )
            )
            const failed = results.filter((r) => !r.ok).length
            if (failed > 0) {
                setError(`Bulk mark completed with ${failed} failed row(s).`)
            } else {
                setNotice(`Bulk attendance marked for ${bulkGuardIds.length} guard(s).`)
            }
            await loadAttendance()
        } finally {
            setBulkLoading(false)
        }
    }

    const bulkUploadAttendance = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!bulkFile) {
            setError("Please select a CSV file for bulk upload.")
            return
        }
        setBulkLoading(true)
        setError("")
        setNotice("")
        try {
            const text = await bulkFile.text()
            const lines = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
            if (lines.length < 2) {
                setError("CSV must contain header and at least one data row.")
                return
            }

            const [header, ...rows] = lines
            const headers = header.split(",").map((h) => h.trim().toLowerCase())
            const guardIdIndex = headers.indexOf("guardid")
            const dateIndex = headers.indexOf("date")
            const statusIndex = headers.indexOf("status")
            const shiftIndex = headers.indexOf("shift")
            const notesIndex = headers.indexOf("notes")

            if (guardIdIndex === -1 || dateIndex === -1 || statusIndex === -1) {
                setError("CSV header must include: guardId,date,status (optional: shift,notes).")
                return
            }

            const uploadResults = await Promise.all(
                rows.map(async (row) => {
                    const parts = row.split(",").map((p) => p.trim())
                    const guardId = parts[guardIdIndex]
                    const date = parts[dateIndex]
                    const status = parts[statusIndex] || "PRESENT"
                    const shift = shiftIndex >= 0 ? parts[shiftIndex] || "DAY" : "DAY"
                    const notes = notesIndex >= 0 ? parts[notesIndex] || null : null
                    if (!guardId || !date || !status) return { ok: false }
                    const response = await fetch("/api/attendance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ guardId, date, status, shiftType: shift, notes }),
                    })
                    return { ok: response.ok }
                })
            )

            const successCount = uploadResults.filter((r) => r.ok).length
            const failedCount = uploadResults.length - successCount
            if (failedCount > 0) {
                setError(`Bulk upload processed ${successCount} row(s), ${failedCount} failed.`)
            } else {
                setNotice(`Bulk upload completed for ${successCount} row(s).`)
            }
            await loadAttendance()
            setBulkFile(null)
        } finally {
            setBulkLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Attendance</h1>
                <p className="text-gray-600 mt-1">Filter attendance by Secure Ops ID and date range</p>
            </div>

            <div className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
                <RegionUrlPicker
                    regions={regions}
                    locked={regionLocked}
                    includeGlobalOption={!regionLocked}
                />
                <div><label className="block text-sm text-gray-600 mb-1">Secure Ops ID*</label><input name="Secure Ops ID*" value={parwestId} onChange={(e) => setParwestId(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Secure Ops ID" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">Strat Date*</label><input name="Strat Date*" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">End Date*</label><input name="End Date*" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                <div className="flex items-end"><Button onClick={loadAttendance} className="w-full">Submit</Button></div>
            </div>

            <form onSubmit={markAttendance} className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Guard</label>
                    <select value={markGuardId} onChange={(e) => setMarkGuardId(e.target.value)} className="w-full border rounded-md px-3 py-2" required>
                        <option value="">--Select Guard--</option>
                        {activeGuards.map((guard) => <option key={guard.id} value={guard.id}>{guard.parwestId} - {guard.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Date</label>
                    <input type="date" value={markDate} onChange={(e) => setMarkDate(e.target.value)} className="w-full border rounded-md px-3 py-2" required />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Status</label>
                    <select value={markStatus} onChange={(e) => setMarkStatus(e.target.value)} className="w-full border rounded-md px-3 py-2">
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LEAVE">Leave</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Shift</label>
                    <select value={markShift} onChange={(e) => setMarkShift(e.target.value)} className="w-full border rounded-md px-3 py-2">
                        <option value="DAY">Day</option>
                        <option value="NIGHT">Night</option>
                        <option value="BOTH">Both</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <Button type="submit" className="w-full">Mark</Button>
                </div>
                <div className="md:col-span-6">
                    <label className="block text-sm text-gray-600 mb-1">Notes</label>
                    <input value={markNotes} onChange={(e) => setMarkNotes(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Optional notes" />
                </div>
            </form>

            <form onSubmit={bulkMarkAttendance} className="bg-white rounded-lg border p-4 space-y-3">
                <h2 className="text-lg font-semibold">Bulk Mark Attendance</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Date*</label>
                        <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Status</label>
                        <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                            <option value="LEAVE">Leave</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Shift</label>
                        <select value={bulkShift} onChange={(e) => setBulkShift(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="DAY">Day</option>
                            <option value="NIGHT">Night</option>
                            <option value="BOTH">Both</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" className="w-full" disabled={bulkLoading}>
                            {bulkLoading ? "Processing..." : "Mark Selected"}
                        </Button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Notes</label>
                    <input value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Optional notes for all selected guards" />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Select Guards</label>
                        <button
                            type="button"
                            onClick={() => setBulkGuardIds(activeGuards.map((guard) => guard.id))}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            Select All
                        </button>
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-md border p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {activeGuards.map((guard) => (
                            <label key={guard.id} className="inline-flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={bulkGuardIds.includes(guard.id)}
                                    onChange={() => toggleBulkGuard(guard.id)}
                                    className="h-4 w-4"
                                />
                                <span>{guard.parwestId} - {guard.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </form>

            <form onSubmit={bulkUploadAttendance} className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-3">
                    <label className="block text-sm text-gray-600 mb-1">Bulk Attendance Upload (CSV)</label>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                        className="w-full border rounded-md px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Format: guardId,date,status,shift,notes</p>
                </div>
                <div className="flex items-end">
                    <Button type="submit" className="w-full" disabled={bulkLoading}>
                        {bulkLoading ? "Uploading..." : "Upload CSV"}
                    </Button>
                </div>
            </form>

            {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
            {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Date</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Parwest ID</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Guard</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Status</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Shift</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Notes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No attendance records found.</td></tr>
                        ) : (
                            records.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{new Date(row.date).toLocaleDateString("en-US")}</td>
                                    <td className="px-6 py-4 text-sm">{row.guard?.parwestId || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.guard?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.status}</td>
                                    <td className="px-6 py-4 text-sm">{row.shiftType || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.notes || "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
