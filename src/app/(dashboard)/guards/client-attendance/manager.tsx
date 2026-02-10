"use client"

import { useEffect, useState } from "react"

type Region = { id: string; name: string }
type RegionalOffice = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string }

type ClientAttendanceRow = {
    deploymentId: string
    date: string | null
    status: string
    shiftType: string | null
    guard: { id: string; parwestId: string; name: string }
    client: { id: string; name: string }
    branch: { id: string; name: string } | null
    regionalOffice: { id: string; name: string }
}

export default function ClientAttendanceManager() {
    const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [branches, setBranches] = useState<Branch[]>([])

    const [regionalOfficeId, setRegionalOfficeId] = useState("")
    const [clientId, setClientId] = useState("")
    const [branchId, setBranchId] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    const [rows, setRows] = useState<ClientAttendanceRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const loadMasterData = async () => {
        try {
            const [officesRes, clientsRes] = await Promise.all([
                fetch("/api/regional-offices"),
                fetch("/api/clients?status=ACTIVE"),
            ])

            if (officesRes.ok) {
                const officesData = await officesRes.json()
                setRegionalOffices(officesData)
            }

            if (clientsRes.ok) {
                const clientsData = await clientsRes.json()
                setClients(clientsData)
            }
        } catch {
            setRegionalOffices([])
            setClients([])
        }
    }

    const loadBranches = async (selectedClientId: string) => {
        if (!selectedClientId) {
            setBranches([])
            return
        }

        try {
            const response = await fetch(`/api/clients/${selectedClientId}/branches`)
            if (!response.ok) {
                setBranches([])
                return
            }
            const data = await response.json()
            setBranches(data)
        } catch {
            setBranches([])
        }
    }

    const loadClientAttendance = async () => {
        try {
            setLoading(true)
            setError("")

            const params = new URLSearchParams()
            if (regionalOfficeId) params.set("regionalOfficeId", regionalOfficeId)
            if (clientId) params.set("clientId", clientId)
            if (branchId) params.set("branchId", branchId)
            if (startDate) params.set("startDate", startDate)
            if (endDate) params.set("endDate", endDate)

            const response = await fetch(`/api/attendance/client?${params.toString()}`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch client attendance")
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
        loadMasterData()
        loadClientAttendance()
    }, [])

    useEffect(() => {
        loadBranches(clientId)
        setBranchId("")
    }, [clientId])

    return (
        <div className="space-y-6 max-w-7xl">
            <div>
                <h1 className="text-3xl font-bold">Client Attendance</h1>
                <p className="text-gray-600 mt-1">Client attendance report filtered by regional office, client and branch</p>
            </div>

            <div className="bg-white rounded-lg border p-6">
                <h2 className="font-semibold mb-4">Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Regional Office</label>
                        <select value={regionalOfficeId} onChange={(e) => setRegionalOfficeId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="">--Select Regional Office--</option>
                            {regionalOffices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Client</label>
                        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="">--Select Client--</option>
                            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Branch</label>
                        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border rounded-md px-3 py-2" disabled={!clientId}>
                            <option value="">--Select Branch--</option>
                            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                        </select>
                    </div>
                    <div><label className="block text-sm text-gray-600 mb-1">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                    <div className="flex items-end"><button onClick={loadClientAttendance} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Submit</button></div>
                </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Date</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Regional Office</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Client</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Branch</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Parwest ID</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Guard</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Status</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Shift</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">No records found.</td></tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={`${row.deploymentId}-${row.guard.id}-${row.date || index}`} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{row.date ? new Date(row.date).toLocaleDateString("en-US") : "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.regionalOffice.name}</td>
                                    <td className="px-6 py-4 text-sm">{row.client.name}</td>
                                    <td className="px-6 py-4 text-sm">{row.branch?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.guard.parwestId}</td>
                                    <td className="px-6 py-4 text-sm">{row.guard.name}</td>
                                    <td className="px-6 py-4 text-sm">{row.status}</td>
                                    <td className="px-6 py-4 text-sm">{row.shiftType || "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
