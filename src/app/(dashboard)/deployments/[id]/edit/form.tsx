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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to update deployment")
            setLoading(false)
        }
    }

    // Format date for input field
    const formatDateForInput = (date: Date) => {
        return new Date(date).toISOString().split('T')[0]
    }

    return (
        <form onSubmit={handleSubmit} className="ui-card p-6">
            {error && (
                <div className="mb-6 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="space-y-8">
                {/* Deployment Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Deployment Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Guard <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="guardId"
                                required
                                defaultValue={deployment.guardId}
                                className="ui-select"
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
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Client <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="clientId"
                                required
                                value={selectedClientId}
                                onChange={(e) => handleClientChange(e.target.value)}
                                className="ui-input"
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
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Branch <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="branchId"
                                required
                                disabled={!selectedClientId}
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                className="ui-select disabled:opacity-60 disabled:cursor-not-allowed"
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
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Deployment Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                name="deploymentDate"
                                required
                                defaultValue={formatDateForInput(deployment.deploymentDate)}
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Regional Office <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="regionalOfficeId"
                                required
                                defaultValue={deployment.regionalOfficeId}
                                className="ui-select"
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
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Shift Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="shiftType"
                                required
                                defaultValue={deployment.shiftType}
                                className="ui-select"
                            >
                                <option value="DAY">Day Shift</option>
                                <option value="NIGHT">Night Shift</option>
                                <option value="BOTH">Both (Day & Night)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Rate (Monthly)
                            </label>
                            <input
                                type="number"
                                name="rate"
                                min="0"
                                step="100"
                                defaultValue={deployment.rate || ""}
                                placeholder="e.g., 25000"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Designation
                            </label>
                            <input
                                type="text"
                                name="designation"
                                defaultValue={deployment.designation || ""}
                                placeholder="e.g., Security Guard, Supervisor"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Guard Type
                            </label>
                            <select
                                name="guardType"
                                defaultValue={deployment.guardType || ""}
                                className="ui-select"
                            >
                                <option value="">Select guard type</option>
                                <option value="Security Guard">Security Guard</option>
                                <option value="Supervisor">Supervisor</option>
                                <option value="Team Leader">Team Leader</option>
                                <option value="Armed Guard">Armed Guard</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Status
                            </label>
                            <select
                                name="status"
                                defaultValue={deployment.status}
                                className="ui-select"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Financial Details */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Financial Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Salary (Monthly)
                            </label>
                            <input
                                type="number"
                                name="salary"
                                min="0"
                                step="100"
                                defaultValue={deployment.salary || ""}
                                placeholder="25000"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Overtime (Per Hour)
                            </label>
                            <input
                                type="number"
                                name="overtime"
                                min="0"
                                step="10"
                                defaultValue={deployment.overtime || ""}
                                placeholder="100"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Extra Hours
                            </label>
                            <input
                                type="number"
                                name="extraHours"
                                min="0"
                                step="0.5"
                                defaultValue={deployment.extraHours || ""}
                                placeholder="0"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Post Allowance
                            </label>
                            <input
                                type="number"
                                name="postAllowance"
                                min="0"
                                step="100"
                                defaultValue={deployment.postAllowance || ""}
                                placeholder="0"
                                className="ui-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Shift Details */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Shift Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Day Shift Start
                            </label>
                            <input
                                type="time"
                                name="dayShiftStart"
                                defaultValue={deployment.dayShiftStart || ""}
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Day Shift End
                            </label>
                            <input
                                type="time"
                                name="dayShiftEnd"
                                defaultValue={deployment.dayShiftEnd || ""}
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Night Shift Start
                            </label>
                            <input
                                type="time"
                                name="nightShiftStart"
                                defaultValue={deployment.nightShiftStart || ""}
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Night Shift End
                            </label>
                            <input
                                type="time"
                                name="nightShiftEnd"
                                defaultValue={deployment.nightShiftEnd || ""}
                                className="ui-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Options */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Additional Options</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Deployment Type
                            </label>
                            <select
                                name="deploymentType"
                                defaultValue={deployment.deploymentType || "REGULAR"}
                                className="ui-select"
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
                                className="h-4 w-4 accent-[var(--brand)]"
                            />
                            <label htmlFor="isExtraGuard" className="ml-2 block text-sm text-[var(--text)]">
                                Extra Guard
                            </label>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Comment
                            </label>
                            <textarea
                                name="comment"
                                rows={3}
                                defaultValue={deployment.comment || ""}
                                placeholder="Additional comments..."
                                className="ui-textarea"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Notes
                            </label>
                            <textarea
                                name="notes"
                                rows={4}
                                defaultValue={deployment.notes || ""}
                                placeholder="Any additional notes about this deployment..."
                                className="ui-textarea"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link
                    href={`/deployments/${deployment.id}`}
                    className="ui-btn ui-btn-secondary inline-flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="ui-btn ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "Saving..." : "Save Changes"}
                </button>
            </div>
        </form>
    )
}
