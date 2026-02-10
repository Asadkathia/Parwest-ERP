"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type TrainingRow = {
    id: string
    trainingType: string
    completedAt: string
    instructor: string | null
    notes: string | null
    guard: {
        id: string
        name: string
        parwestId: string
        regionalOffice: { name: string } | null
    }
}

type ParsedNotes = {
    regionalOffice?: string
    client?: string
    branch?: string
    branchSupervisor?: string
    supervisorWithUniform?: string
    branchManager?: string
    armorer?: string
    conductedBy?: string
    dueDate?: string
    remarks?: string
}

function parseNotes(raw: string | null): ParsedNotes {
    if (!raw) return {}

    const parts = raw.split("|").map((p) => p.trim())
    const parsed: ParsedNotes = {}

    for (const part of parts) {
        const [left, ...rest] = part.split(":")
        const value = rest.join(":").trim()
        const key = left.trim().toLowerCase()

        if (!value) continue

        if (key === "regional office") parsed.regionalOffice = value
        else if (key === "client") parsed.client = value
        else if (key === "branch") parsed.branch = value
        else if (key === "branch supervisor") parsed.branchSupervisor = value
        else if (key === "supervisor with uniform") parsed.supervisorWithUniform = value
        else if (key === "branch manager") parsed.branchManager = value
        else if (key === "armorer") parsed.armorer = value
        else if (key === "conducted by") parsed.conductedBy = value
        else if (key === "due date") parsed.dueDate = value
        else if (key === "remarks") parsed.remarks = value
    }

    if (!parsed.conductedBy && raw) parsed.remarks = raw

    return parsed
}

export default function TrainingsManager() {
    const [rows, setRows] = useState<TrainingRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const [regionalOfficeFilter, setRegionalOfficeFilter] = useState("")
    const [clientFilter, setClientFilter] = useState("")
    const [branchFilter, setBranchFilter] = useState("")
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")

    const loadTrainings = async () => {
        try {
            setLoading(true)
            setError("")
            const response = await fetch("/api/trainings")
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch trainings")
            }
            const data = await response.json()
            setRows(data)
        } catch (err: any) {
            setError(err.message)
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadTrainings()
    }, [])

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            const notes = parseNotes(row.notes)
            const completed = new Date(row.completedAt)

            if (regionalOfficeFilter && !((notes.regionalOffice || row.guard.regionalOffice?.name || "").toLowerCase().includes(regionalOfficeFilter.toLowerCase()))) {
                return false
            }

            if (clientFilter && !(notes.client || "").toLowerCase().includes(clientFilter.toLowerCase())) {
                return false
            }

            if (branchFilter && !(notes.branch || "").toLowerCase().includes(branchFilter.toLowerCase())) {
                return false
            }

            if (fromDate && completed < new Date(fromDate)) {
                return false
            }

            if (toDate && completed > new Date(toDate)) {
                return false
            }

            return true
        })
    }, [rows, regionalOfficeFilter, clientFilter, branchFilter, fromDate, toDate])

    const clearFilters = () => {
        setRegionalOfficeFilter("")
        setClientFilter("")
        setBranchFilter("")
        setFromDate("")
        setToDate("")
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">OnJob Trainings</h1>
                    <p className="text-gray-600 mt-1">Track OJT sessions and completion status by guard</p>
                </div>
                <Link href="/guards/trainings/new" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Add New Training</Link>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Regional Office</label>
                        <input value={regionalOfficeFilter} onChange={(e) => setRegionalOfficeFilter(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Regional office" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Client</label>
                        <input value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Client" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Branch</label>
                        <input value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Branch" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">From Date</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">To Date</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button onClick={() => undefined} className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700">Filter</button>
                    <button onClick={clearFilters} className="border px-3 py-2 rounded-md text-sm hover:bg-gray-50">Clear</button>
                    <button className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">Export All OJT Report</button>
                    <button className="bg-yellow-500 text-white px-3 py-2 rounded-md text-sm hover:bg-yellow-600">Export Filtered OJT Report</button>
                    <button className="bg-indigo-600 text-white px-3 py-2 rounded-md text-sm hover:bg-indigo-700">Branch Training Report</button>
                    <button className="bg-red-600 text-white px-3 py-2 rounded-md text-sm hover:bg-red-700">Missing Training Report</button>
                </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full min-w-[1500px]">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Date</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Date of OJT</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Regional Office</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Client</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Branch</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Guards</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Branch Supervisor</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Supervisor Uniform</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Branch Manager</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Armorer</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Conducted By</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Due Date</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Remarks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={13} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : filteredRows.length === 0 ? (
                            <tr><td colSpan={13} className="px-6 py-8 text-center text-sm text-gray-500">No training records found.</td></tr>
                        ) : (
                            filteredRows.map((training) => {
                                const notes = parseNotes(training.notes)
                                const created = new Date(training.completedAt)
                                const due = new Date(created)
                                due.setMonth(due.getMonth() + 1)

                                return (
                                    <tr key={training.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm">{created.toLocaleDateString("en-US")}</td>
                                        <td className="px-6 py-4 text-sm">{created.toLocaleDateString("en-US")}</td>
                                        <td className="px-6 py-4 text-sm">{notes.regionalOffice || training.guard.regionalOffice?.name || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.client || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.branch || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{training.guard.name}</td>
                                        <td className="px-6 py-4 text-sm">{notes.branchSupervisor || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.supervisorWithUniform || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.branchManager || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.armorer || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.conductedBy || training.instructor || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.dueDate || due.toLocaleDateString("en-US")}</td>
                                        <td className="px-6 py-4 text-sm">{notes.remarks || "—"}</td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
