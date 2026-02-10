"use client"

import { useEffect, useState } from "react"

type Region = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string }

type DeploymentRate = {
    id: string
    region: { id: string; name: string } | null
    client: { id: string; name: string } | null
    branch: { id: string; name: string } | null
    deployAs: string | null
    guardType: string | null
    shiftType: string | null
    salary: number | null
    overtime: number | null
    extraHours: number | null
    postAllowance: number | null
    createdAt: string
}

export default function DeploymentRatesForm() {
    const [regions, setRegions] = useState<Region[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [branches, setBranches] = useState<Branch[]>([])

    const [regionId, setRegionId] = useState("")
    const [clientId, setClientId] = useState("")
    const [branchId, setBranchId] = useState("")
    const [deployAs, setDeployAs] = useState("Security Guard")
    const [guardType, setGuardType] = useState("Guard")
    const [shiftType, setShiftType] = useState("DAY")

    const [salary, setSalary] = useState("")
    const [overtime, setOvertime] = useState("")
    const [extraHours, setExtraHours] = useState("")
    const [postAllowance, setPostAllowance] = useState("")

    const [recentRates, setRecentRates] = useState<DeploymentRate[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    const loadMasterData = async () => {
        try {
            const [regionsRes, clientsRes] = await Promise.all([
                fetch("/api/regions"),
                fetch("/api/clients?status=ACTIVE"),
            ])

            if (regionsRes.ok) {
                const regionsData = await regionsRes.json()
                setRegions(regionsData)
            }

            if (clientsRes.ok) {
                const clientsData = await clientsRes.json()
                setClients(clientsData)
            }
        } catch {
            setRegions([])
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

    const loadRecentRates = async () => {
        try {
            const response = await fetch("/api/deployment-rates")
            if (!response.ok) {
                setRecentRates([])
                return
            }
            const data = await response.json()
            setRecentRates(data)
        } catch {
            setRecentRates([])
        }
    }

    useEffect(() => {
        loadMasterData()
        loadRecentRates()
    }, [])

    useEffect(() => {
        loadBranches(clientId)
        setBranchId("")
    }, [clientId])

    const getPreviousRates = async () => {
        try {
            setError("")
            setSuccess("")

            const params = new URLSearchParams()
            if (regionId) params.set("regionId", regionId)
            if (clientId) params.set("clientId", clientId)
            if (branchId) params.set("branchId", branchId)
            if (deployAs) params.set("deployAs", deployAs)
            if (guardType) params.set("guardType", guardType)
            if (shiftType) params.set("shiftType", shiftType)
            params.set("latest", "true")

            const response = await fetch(`/api/deployment-rates?${params.toString()}`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch previous rates")
            }

            const latest = await response.json()
            if (!latest) {
                setError("No previous rate found for selected filters")
                return
            }

            setSalary(latest.salary?.toString() || "")
            setOvertime(latest.overtime?.toString() || "")
            setExtraHours(latest.extraHours?.toString() || "")
            setPostAllowance(latest.postAllowance?.toString() || "")
            setSuccess("Previous rates loaded")
        } catch (err: any) {
            setError(err.message)
        }
    }

    const saveRate = async () => {
        try {
            setLoading(true)
            setError("")
            setSuccess("")

            const response = await fetch("/api/deployment-rates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    regionId: regionId || null,
                    clientId: clientId || null,
                    branchId: branchId || null,
                    deployAs,
                    guardType,
                    shiftType,
                    salary,
                    overtime,
                    extraHours,
                    postAllowance,
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to save rate")
            }

            setSuccess("Deployment rate saved")
            await loadRecentRates()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-6xl">
            <div>
                <h1 className="text-3xl font-bold">Deployment Rates</h1>
                <p className="text-gray-600 mt-1">Configure salary, overtime, extra hours and post allowance rates</p>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            {success && <div className="text-sm text-green-600">{success}</div>}

            <div className="bg-white rounded-lg border p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Region</label>
                        <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="">--Select Region--</option>
                            {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Client</label>
                        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="">--Select Client--</option>
                            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Branch</label>
                        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border rounded-md px-3 py-2" disabled={!clientId}>
                            <option value="">--Select Branch--</option>
                            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Deploy As</label>
                        <select value={deployAs} onChange={(e) => setDeployAs(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="Security Guard">Security Guard</option>
                            <option value="Supervisor">Supervisor</option>
                            <option value="CPO">CPO</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Guard Type</label>
                        <select value={guardType} onChange={(e) => setGuardType(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="Guard">Guard</option>
                            <option value="Ex-Service">Ex-Service</option>
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-sm text-gray-600 mb-1">Shift</label>
                        <div className="flex gap-4 text-sm mt-2">
                            {[
                                ["DAY", "Day"],
                                ["NIGHT", "Night"],
                                ["BOTH", "Both"],
                            ].map(([value, label]) => (
                                <label key={value} className="inline-flex items-center gap-2">
                                    <input type="radio" checked={shiftType === value} onChange={() => setShiftType(value)} />
                                    <span>{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label className="block text-sm text-gray-600 mb-1">Salary</label><input value={salary} onChange={(e) => setSalary(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Guards salary" type="number" /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Overtime</label><input value={overtime} onChange={(e) => setOvertime(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Guards overtime pay" type="number" /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Extra Hours</label><input value={extraHours} onChange={(e) => setExtraHours(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Extra hours salary" type="number" /></div>
                    <div><label className="block text-sm text-gray-600 mb-1">Post Allowance</label><input value={postAllowance} onChange={(e) => setPostAllowance(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Guards post allowance" type="number" /></div>
                </div>

                <div className="flex gap-3">
                    <button onClick={getPreviousRates} className="border px-4 py-2 rounded-md hover:bg-gray-50">Get Previous Rates</button>
                    <button onClick={saveRate} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60">{loading ? "Saving..." : "Save"}</button>
                </div>
            </div>

            <div className="bg-white rounded-lg border overflow-x-auto">
                <div className="p-4 border-b">
                    <h2 className="font-semibold">Recent Rates</h2>
                </div>
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Region</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Client</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Branch</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Deploy As</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Guard Type</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Shift</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Salary</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {recentRates.length === 0 ? (
                            <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No saved rates yet.</td></tr>
                        ) : (
                            recentRates.map((rate) => (
                                <tr key={rate.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{rate.region?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{rate.client?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{rate.branch?.name || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{rate.deployAs || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{rate.guardType || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{rate.shiftType || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{rate.salary ?? "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
