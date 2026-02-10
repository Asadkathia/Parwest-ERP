"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

type Guard = {
    id: string
    parwestId: string
    name: string
    cnic: string
}

type Branch = {
    id: string
    name: string
    address: string | null
}

type Client = {
    id: string
    name: string
    branches: Branch[]
}

type RegionalOffice = {
    id: string
    name: string
    seriesCode: string
}

type Deployment = {
    id: string
    guardId: string
    clientId: string
    branchId: string | null
    regionalOfficeId: string
    deploymentDate: Date
    designation: string | null
    shiftType: string
    rate: number | null
    status: string
    notes: string | null
    // Extended fields
    guardType: string | null
    salary: number | null
    overtime: number | null
    extraHours: number | null
    postAllowance: number | null
    dayShiftStart: string | null
    dayShiftEnd: string | null
    nightShiftStart: string | null
    nightShiftEnd: string | null
    deploymentType: string | null
    isExtraGuard: boolean
    comment: string | null
    guard: {
        id: string
        name: string
        parwestId: string
    }
    client: {
        id: string
        name: string
        branches: Branch[]
    }
    branch: {
        id: string
        name: string
    } | null
    regionalOffice: {
        id: string
        name: string
    }
}

type Props = {
    deployment: Deployment
    guards: Guard[]
    clients: Client[]
    regionalOffices: RegionalOffice[]
}

export default function DeploymentEditForm({ deployment, guards, clients, regionalOffices }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [selectedClientId, setSelectedClientId] = useState(deployment.clientId)
    const [selectedBranchId, setSelectedBranchId] = useState(deployment.branchId || "")
    const [availableBranches, setAvailableBranches] = useState<Branch[]>(deployment.client.branches)

    useEffect(() => {
        // Initialize branches for the current client
        const client = clients.find((c) => c.id === deployment.clientId)
        setAvailableBranches(client?.branches || [])
    }, [deployment.clientId, clients])

    const handleClientChange = (clientId: string) => {
        setSelectedClientId(clientId)
        const client = clients.find((c) => c.id === clientId)
        setAvailableBranches(client?.branches || [])
        setSelectedBranchId("") // Reset branch when client changes
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = Object.fromEntries(formData.entries())

        try {
            const response = await fetch(`/api/deployments/${deployment.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Failed to update deployment")
            }

            router.push(`/deployments/${deployment.id}`)
            router.refresh()
        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    // Format date for input field
    const formatDateForInput = (date: Date) => {
        return new Date(date).toISOString().split('T')[0]
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6">
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
                    {error}
                </div>
            )}

            <div className="space-y-8">
                {/* Deployment Information */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Deployment Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Guard <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="guardId"
                                required
                                defaultValue={deployment.guardId}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select guard</option>
                                {guards.map((guard) => (
                                    <option key={guard.id} value={guard.id}>
                                        {guard.parwestId} - {guard.name} ({guard.cnic})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Client <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="clientId"
                                required
                                value={selectedClientId}
                                onChange={(e) => handleClientChange(e.target.value)}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select client</option>
                                {clients.map((client) => (
                                    <option key={client.id} value={client.id}>
                                        {client.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Branch <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="branchId"
                                required
                                disabled={!selectedClientId}
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                <option value="">Select branch</option>
                                {availableBranches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name} {branch.address && `- ${branch.address}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Deployment Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                name="deploymentDate"
                                required
                                defaultValue={formatDateForInput(deployment.deploymentDate)}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Regional Office <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="regionalOfficeId"
                                required
                                defaultValue={deployment.regionalOfficeId}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select regional office</option>
                                {regionalOffices.map((office) => (
                                    <option key={office.id} value={office.id}>
                                        {office.name} ({office.seriesCode})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Shift Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="shiftType"
                                required
                                defaultValue={deployment.shiftType}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="DAY">Day Shift</option>
                                <option value="NIGHT">Night Shift</option>
                                <option value="BOTH">Both (Day & Night)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Rate (Monthly)
                            </label>
                            <input
                                type="number"
                                name="rate"
                                min="0"
                                step="100"
                                defaultValue={deployment.rate || ""}
                                placeholder="e.g., 25000"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Designation
                            </label>
                            <input
                                type="text"
                                name="designation"
                                defaultValue={deployment.designation || ""}
                                placeholder="e.g., Security Guard, Supervisor"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Guard Type
                            </label>
                            <select
                                name="guardType"
                                defaultValue={deployment.guardType || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select guard type</option>
                                <option value="Security Guard">Security Guard</option>
                                <option value="Supervisor">Supervisor</option>
                                <option value="Team Leader">Team Leader</option>
                                <option value="Armed Guard">Armed Guard</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                name="status"
                                defaultValue={deployment.status}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Financial Details */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Financial Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Salary (Monthly)
                            </label>
                            <input
                                type="number"
                                name="salary"
                                min="0"
                                step="100"
                                defaultValue={deployment.salary || ""}
                                placeholder="25000"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Overtime (Per Hour)
                            </label>
                            <input
                                type="number"
                                name="overtime"
                                min="0"
                                step="10"
                                defaultValue={deployment.overtime || ""}
                                placeholder="100"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Extra Hours
                            </label>
                            <input
                                type="number"
                                name="extraHours"
                                min="0"
                                step="0.5"
                                defaultValue={deployment.extraHours || ""}
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
                                name="postAllowance"
                                min="0"
                                step="100"
                                defaultValue={deployment.postAllowance || ""}
                                placeholder="0"
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Shift Details */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Shift Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Day Shift Start
                            </label>
                            <input
                                type="time"
                                name="dayShiftStart"
                                defaultValue={deployment.dayShiftStart || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Day Shift End
                            </label>
                            <input
                                type="time"
                                name="dayShiftEnd"
                                defaultValue={deployment.dayShiftEnd || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Night Shift Start
                            </label>
                            <input
                                type="time"
                                name="nightShiftStart"
                                defaultValue={deployment.nightShiftStart || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Night Shift End
                            </label>
                            <input
                                type="time"
                                name="nightShiftEnd"
                                defaultValue={deployment.nightShiftEnd || ""}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Options */}
                <div>
                    <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Additional Options</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Deployment Type
                            </label>
                            <select
                                name="deploymentType"
                                defaultValue={deployment.deploymentType || "REGULAR"}
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="REGULAR">Regular</option>
                                <option value="OVERTIME">Overtime</option>
                            </select>
                        </div>

                        <div className="flex items-center pt-8">
                            <input
                                type="checkbox"
                                name="isExtraGuard"
                                id="isExtraGuard"
                                defaultChecked={deployment.isExtraGuard}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="isExtraGuard" className="ml-2 block text-sm text-gray-700">
                                Extra Guard
                            </label>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Comment
                            </label>
                            <textarea
                                name="comment"
                                rows={3}
                                defaultValue={deployment.comment || ""}
                                placeholder="Additional comments..."
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Notes
                            </label>
                            <textarea
                                name="notes"
                                rows={4}
                                defaultValue={deployment.notes || ""}
                                placeholder="Any additional notes about this deployment..."
                                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link
                    href={`/deployments/${deployment.id}`}
                    className="flex items-center gap-2 px-6 py-2 border rounded-md hover:bg-gray-50"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "Saving..." : "Save Changes"}
                </button>
            </div>
        </form>
    )
}
