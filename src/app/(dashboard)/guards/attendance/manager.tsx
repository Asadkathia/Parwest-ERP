"use client"

import { useEffect, useState } from "react"

type AttendanceRecord = {
    id: string
    date: string
    status: string
    shiftType: string | null
    notes: string | null
    guard: {
        id: string
        parwestId: string
        name: string
        cnic: string
    }
}

type GuardOption = {
    id: string
    parwestId: string
    name: string
}

export default function GuardAttendanceManager() {
    const [parwestId, setParwestId] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const [activeGuards, setActiveGuards] = useState<GuardOption[]>([])
    const [markGuardId, setMarkGuardId] = useState("")
    const [markDate, setMarkDate] = useState("")
    const [markStatus, setMarkStatus] = useState("PRESENT")
    const [markShift, setMarkShift] = useState("DAY")
    const [markNotes, setMarkNotes] = useState("")

    const loadAttendance = async () => {
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
        } catch (err: any) {
            setError(err.message)
            setRecords([])
        } finally {
            setLoading(false)
        }
    }

    const loadActiveGuards = async () => {
        try {
            const response = await fetch("/api/guards?status=ACTIVE")
            if (!response.ok) return
            const data = await response.json()
            setActiveGuards(data)
        } catch {
            setActiveGuards([])
        }
    }

    useEffect(() => {
        loadAttendance()
        loadActiveGuards()
    }, [])

    const markAttendance = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

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
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Guard Attendance</h1>
                <p className="text-gray-600 mt-1">Filter attendance by Parwest ID and date range, and mark attendance</p>
            </div>

            <div className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className="block text-sm text-gray-600 mb-1">Parwest ID</label><input value={parwestId} onChange={(e) => setParwestId(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="PW-00001" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                <div><label className="block text-sm text-gray-600 mb-1">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                <div className="flex items-end"><button onClick={loadAttendance} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Search</button></div>
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
                    <button className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Mark</button>
                </div>
                <div className="md:col-span-6">
                    <label className="block text-sm text-gray-600 mb-1">Notes</label>
                    <input value={markNotes} onChange={(e) => setMarkNotes(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Optional notes" />
                </div>
            </form>

            {error && <div className="text-sm text-red-600">{error}</div>}

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
                                    <td className="px-6 py-4 text-sm">{row.guard.parwestId}</td>
                                    <td className="px-6 py-4 text-sm">{row.guard.name}</td>
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
