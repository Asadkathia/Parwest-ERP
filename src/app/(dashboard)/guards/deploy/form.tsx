"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Building2, Users, MapPin, Briefcase, Calendar, Clock, DollarSign, FileText } from "lucide-react"

type Region = {
    id: string
    name: string
}

type Client = {
    id: string
    name: string
    type: string
}

type Branch = {
    id: string
    name: string
    code: string
    city: string
}

type Guard = {
    id: string
    name: string
    cnic: string
    phone: string
    regionalOfficeId: string
}

type RegionalOffice = {
    id: string
    name: string
    seriesCode: string
    regionId: string
}

export default function DeployGuardForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Data states
    const [regions, setRegions] = useState<Region[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [guards, setGuards] = useState<Guard[]>([])
    const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])

    // Form states
    const [selectedRegion, setSelectedRegion] = useState("")
    const [selectedClient, setSelectedClient] = useState("")
    const [selectedBranch, setSelectedBranch] = useState("")
    const [selectedGuard, setSelectedGuard] = useState("")
    const [selectedRegionalOffice, setSelectedRegionalOffice] = useState("")

    // Deployment details
    const [designation, setDesignation] = useState("")
    const [guardType, setGuardType] = useState("Security Guard")
    const [salary, setSalary] = useState("")
    const [overtime, setOvertime] = useState("")
    const [extraHours, setExtraHours] = useState("")
    const [postAllowance, setPostAllowance] = useState("")
    const [shiftType, setShiftType] = useState("DAY")
    const [dayShiftStart, setDayShiftStart] = useState("08:00")
    const [dayShiftEnd, setDayShiftEnd] = useState("20:00")
    const [nightShiftStart, setNightShiftStart] = useState("20:00")
    const [nightShiftEnd, setNightShiftEnd] = useState("08:00")
    const [deploymentDate, setDeploymentDate] = useState(new Date().toISOString().split("T")[0])
    const [deploymentType, setDeploymentType] = useState("REGULAR")
    const [isExtraGuard, setIsExtraGuard] = useState(false)
    const [comment, setComment] = useState("")

    // Load initial data
    useEffect(() => {
        loadRegions()
        loadClients()
        loadRegionalOffices()
    }, [])

    // Load guards when region is selected
    useEffect(() => {
        if (selectedRegion) {
            loadGuards(selectedRegion)
        }
    }, [selectedRegion])

    // Load branches when client is selected
    useEffect(() => {
        if (selectedClient) {
            loadBranches(selectedClient)
        }
    }, [selectedClient])

    const loadRegions = async () => {
        try {
            const res = await fetch("/api/regions")
            const data = await res.json()
            setRegions(data)
        } catch (err) {
            console.error("Failed to load regions:", err)
        }
    }

    const loadClients = async () => {
        try {
            const res = await fetch("/api/clients")
            const data = await res.json()
            setClients(data)
        } catch (err) {
            console.error("Failed to load clients:", err)
        }
    }

    const loadBranches = async (clientId: string) => {
        try {
            const res = await fetch(`/api/clients/${clientId}/branches`)
            const data = await res.json()
            setBranches(data)
        } catch (err) {
            console.error("Failed to load branches:", err)
            setBranches([])
        }
    }

    const loadGuards = async (regionId: string) => {
        try {
            // Filter guards by regional office that belongs to selected region
            const res = await fetch(`/api/guards?regionId=${regionId}&status=ACTIVE`)
            const data = await res.json()
            setGuards(data)
        } catch (err) {
            console.error("Failed to load guards:", err)
            setGuards([])
        }
    }

    const loadRegionalOffices = async () => {
        try {
            const res = await fetch("/api/regional-offices")
            const data = await res.json()
            setRegionalOffices(data)
        } catch (err) {
            console.error("Failed to load regional offices:", err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const res = await fetch("/api/deployments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guardId: selectedGuard,
                    clientId: selectedClient,
                    branchId: selectedBranch || null,
                    regionalOfficeId: selectedRegionalOffice,
                    designation,
                    guardType,
                    deploymentDate,
                    shiftType,
                    salary: salary ? parseFloat(salary) : null,
                    overtime: overtime ? parseFloat(overtime) : null,
                    extraHours: extraHours ? parseFloat(extraHours) : null,
                    postAllowance: postAllowance ? parseFloat(postAllowance) : null,
                    dayShiftStart: shiftType === "DAY" || shiftType === "BOTH" ? dayShiftStart : null,
                    dayShiftEnd: shiftType === "DAY" || shiftType === "BOTH" ? dayShiftEnd : null,
                    nightShiftStart: shiftType === "NIGHT" || shiftType === "BOTH" ? nightShiftStart : null,
                    nightShiftEnd: shiftType === "NIGHT" || shiftType === "BOTH" ? nightShiftEnd : null,
                    deploymentType,
                    isExtraGuard,
                    comment: isExtraGuard ? comment : null,
                    status: "ACTIVE",
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to deploy guard")
            }

            const deployment = await res.json()
            router.push(`/deployments/${deployment.id}`)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const selectedGuardData = guards.find(g => g.id === selectedGuard)

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Deploy Guard</h1>
                <p className="text-gray-600 mt-1">Assign a guard to a client site</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Selection Section */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Location & Assignment
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Region <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                                required
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">--Select Region--</option>
                                {regions.map((region) => (
                                    <option key={region.id} value={region.id}>
                                        {region.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Regional Office <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedRegionalOffice}
                                onChange={(e) => setSelectedRegionalOffice(e.target.value)}
                                required
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">--Select Regional Office--</option>
                                {regionalOffices
                                    .filter(ro => !selectedRegion || ro.regionId === selectedRegion)
                                    .map((office) => (
                                        <option key={office.id} value={office.id}>
                                            {office.name} ({office.seriesCode})
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Client <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedClient}
                                onChange={(e) => setSelectedClient(e.target.value)}
                                required
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">--Select Client--</option>
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.name} ({client.type})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Branch
                            </label>
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                disabled={!selectedClient}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            >
                                <option value="">--Select Branch--</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name} - {branch.city}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Deploy As (Designation) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={designation}
                                onChange={(e) => setDesignation(e.target.value)}
                                required
                                placeholder="e.g., Security Guard, Supervisor"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Guard Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={guardType}
                                onChange={(e) => setGuardType(e.target.value)}
                                required
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="Security Guard">Security Guard</option>
                                <option value="Supervisor">Supervisor</option>
                                <option value="CPO">CPO</option>
                                <option value="Ex-Service">Ex-Service</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Guard Selection */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Select Guard
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Guard <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedGuard}
                            onChange={(e) => setSelectedGuard(e.target.value)}
                            required
                            disabled={!selectedRegion}
                            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        >
                            <option value="">--Select Guard--</option>
                            {guards.map((guard) => (
                                <option key={guard.id} value={guard.id}>
                                    {guard.name} - {guard.cnic} - {guard.phone}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedGuardData && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-md">
                            <h3 className="font-medium mb-2">Selected Guard Details:</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><span className="font-medium">Name:</span> {selectedGuardData.name}</div>
                                <div><span className="font-medium">CNIC:</span> {selectedGuardData.cnic}</div>
                                <div><span className="font-medium">Phone:</span> {selectedGuardData.phone}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Financial Details */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Financial Details
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Salary (Monthly)
                            </label>
                            <input
                                type="number"
                                value={salary}
                                onChange={(e) => setSalary(e.target.value)}
                                placeholder="25000"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Overtime
                            </label>
                            <input
                                type="number"
                                value={overtime}
                                onChange={(e) => setOvertime(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Extra Hours
                            </label>
                            <input
                                type="number"
                                value={extraHours}
                                onChange={(e) => setExtraHours(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Post Allowance
                            </label>
                            <input
                                type="number"
                                value={postAllowance}
                                onChange={(e) => setPostAllowance(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Shift Details */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Shift Details
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Shift Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={shiftType}
                                onChange={(e) => setShiftType(e.target.value)}
                                required
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="DAY">Day Shift</option>
                                <option value="NIGHT">Night Shift</option>
                                <option value="BOTH">Both Shifts</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Deployment Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={deploymentDate}
                                onChange={(e) => setDeploymentDate(e.target.value)}
                                required
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {(shiftType === "DAY" || shiftType === "BOTH") && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Day Shift Start
                                    </label>
                                    <input
                                        type="time"
                                        value={dayShiftStart}
                                        onChange={(e) => setDayShiftStart(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Day Shift End
                                    </label>
                                    <input
                                        type="time"
                                        value={dayShiftEnd}
                                        onChange={(e) => setDayShiftEnd(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </>
                        )}

                        {(shiftType === "NIGHT" || shiftType === "BOTH") && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Night Shift Start
                                    </label>
                                    <input
                                        type="time"
                                        value={nightShiftStart}
                                        onChange={(e) => setNightShiftStart(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Night Shift End
                                    </label>
                                    <input
                                        type="time"
                                        value={nightShiftEnd}
                                        onChange={(e) => setNightShiftEnd(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Additional Options */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Additional Options
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Deployment Type
                            </label>
                            <select
                                value={deploymentType}
                                onChange={(e) => setDeploymentType(e.target.value)}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="REGULAR">Regular</option>
                                <option value="OVERTIME">Overtime</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isExtraGuard"
                                checked={isExtraGuard}
                                onChange={(e) => setIsExtraGuard(e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="isExtraGuard" className="text-sm font-medium text-gray-700">
                                Extra Guard (Comment Required)
                            </label>
                        </div>

                        {isExtraGuard && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Comment <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    required={isExtraGuard}
                                    rows={3}
                                    placeholder="Explain why this is an extra guard..."
                                    className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading ? "Deploying..." : "SAVE"}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}
