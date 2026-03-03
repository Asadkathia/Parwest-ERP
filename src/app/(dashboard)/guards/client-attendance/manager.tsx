"use client"

import { useCallback, useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type RegionalOffice = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string }

type ClientAttendanceRow = {
    deploymentId: string
    date: string | null
    status: string
    shiftType: string | null
    guard: { id: string; parwestId: string; name: string } | null
    client: { id: string; name: string } | null
    branch: { id: string; name: string } | null
    regionalOffice: { id: string; name: string } | null
}

const LEGACY_REGIONAL_OFFICES: RegionalOffice[] = [
    { id: "legacy-head-office-lahore", name: "head office lahore" },
    { id: "legacy-islamabad", name: "islamabad" },
    { id: "legacy-quetta", name: "quetta" },
    { id: "legacy-peshawar", name: "peshawar" },
    { id: "legacy-karachi", name: "karachi" },
    { id: "legacy-multan", name: "multan" },
    { id: "legacy-sahiwal", name: "sahiwal" },
    { id: "legacy-gujranwala", name: "gujranwala" },
    { id: "legacy-faisalabad", name: "faisalabad" },
    { id: "legacy-sub-kasur", name: "sub office kasur" },
    { id: "legacy-sub-sheikhupura", name: "sub office sheikhupura" },
    { id: "legacy-test-office", name: "test office" },
    { id: "legacy-hyderabad", name: "hyderabad" },
    { id: "legacy-sukkur", name: "sukkur" },
    { id: "legacy-qadir-pur-ghotki", name: "qadir pur ghotki" },
    { id: "legacy-jand", name: "jand" },
]

const LEGACY_CLIENTS: Client[] = [
    { id: "legacy-client-nbp", name: "National Bank of Pakistan" },
    { id: "legacy-client-scb", name: "Standard Chartered Bank Limited Pakistan" },
    { id: "legacy-client-ubl", name: "United Bank Limited" },
    { id: "legacy-client-mcb", name: "MCB Bank Ltd" },
]

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
    const [entries, setEntries] = useState("10")
    const [tableSearch, setTableSearch] = useState("")

    const loadMasterData = useCallback(async () => {
        try {
            const [officesRes, clientsRes] = await Promise.all([
                fetch("/api/regional-offices"),
                fetch("/api/clients?status=ACTIVE"),
            ])

            if (officesRes.ok) {
                const officesData = await officesRes.json()
                setRegionalOffices(Array.isArray(officesData) && officesData.length > 0 ? officesData : LEGACY_REGIONAL_OFFICES)
            }

            if (clientsRes.ok) {
                const clientsData = await clientsRes.json()
                setClients(Array.isArray(clientsData) && clientsData.length > 0 ? clientsData : LEGACY_CLIENTS)
            }
        } catch {
            setRegionalOffices(LEGACY_REGIONAL_OFFICES)
            setClients(LEGACY_CLIENTS)
        }
    }, [])

    const loadBranches = useCallback(async (selectedClientId: string) => {
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
    }, [])

    const loadClientAttendance = useCallback(async () => {
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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [branchId, clientId, endDate, regionalOfficeId, startDate])

    useEffect(() => {
        void loadMasterData()
        void loadClientAttendance()
    }, [loadClientAttendance, loadMasterData])

    useEffect(() => {
        void loadBranches(clientId)
        setBranchId("")
    }, [clientId, loadBranches])

    return (
        <div className="space-y-6 max-w-7xl">
            <div>
                <h1 className="text-3xl font-bold">Client Attendance</h1>
                <p className="text-gray-600 mt-1">Filters</p>
            </div>

            <div className="bg-white rounded-lg border p-6">
                <h2 className="font-semibold mb-4">Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Regional Offices</label>
                        <select name="edit_regional_office" value={regionalOfficeId} onChange={(e) => setRegionalOfficeId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="">--Select Regional Office--</option>
                            {regionalOffices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Client</label>
                        <select name="selected_client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="">--Select Client--</option>
                            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Branch</label>
                        <select name="client_branches" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border rounded-md px-3 py-2" disabled={!clientId}>
                            <option value="">--Select Branch--</option>
                            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                        </select>
                    </div>
                    <div><label className="block text-sm text-gray-600 mb-1">Start Date*</label><input name="Start Date*" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">End Date*</label><input name="End Date*" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                    <div className="flex items-end"><ActionButton onClick={loadClientAttendance} className="w-full">Submit</ActionButton></div>
                </div>
            </div>

            {error ? <InlineAlert type="error" message={error} /> : null}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-gray-50 px-4 py-3">
                    <div>
                        <label className="mb-1 block text-xs text-gray-600">Show</label>
                        <select name="Show 102550100 entries" value={entries} onChange={(e) => setEntries(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                            {["10", "25", "50", "100"].map((value) => (
                                <option key={value} value={value}>{value}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-gray-600">Search:</label>
                        <input name="Search:" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="rounded-md border px-2 py-1 text-sm" />
                    </div>
                </div>
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
                            rows
                                .filter((row) => {
                                    if (!tableSearch.trim()) return true
                                    const q = tableSearch.toLowerCase()
                                    return (
                                        (row.guard?.parwestId || "").toLowerCase().includes(q) ||
                                        (row.guard?.name || "").toLowerCase().includes(q) ||
                                        (row.client?.name || "").toLowerCase().includes(q) ||
                                        (row.branch?.name || "").toLowerCase().includes(q)
                                    )
                                })
                                .slice(0, Number.parseInt(entries, 10) || 10)
                                .map((row, index) => (
                                <tr key={`${row.deploymentId}-${row.guard?.id || "unknown-guard"}-${row.date || index}`} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{row.date ? new Date(row.date).toLocaleDateString("en-US") : "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.regionalOffice?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.client?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.branch?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.guard?.parwestId || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.guard?.name || "—"}</td>
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
