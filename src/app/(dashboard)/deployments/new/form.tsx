"use client"

import { useState } from "react"
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

type Props = {
    guards: Guard[]
    clients: Client[]
    regionalOffices: RegionalOffice[]
}

export default function DeploymentForm({ guards, clients, regionalOffices }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [selectedClientId, setSelectedClientId] = useState("")
    const [availableBranches, setAvailableBranches] = useState<Branch[]>([])

    const handleClientChange = (clientId: string) => {
        setSelectedClientId(clientId)
        const client = clients.find((c) => c.id === clientId)
        setAvailableBranches(client?.branches || [])
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = Object.fromEntries(formData.entries())

        try {
            const response = await fetch("/api/deployments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Failed to create deployment")
            }

            router.push("/deployments")
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to create deployment")
            setLoading(false)
        }
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
                                defaultValue="DAY"
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
                                placeholder="e.g., Security Guard, Supervisor"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Status
                            </label>
                            <select
                                name="status"
                                defaultValue="ACTIVE"
                                className="ui-select"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Additional Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Additional Information</h2>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Notes
                            </label>
                            <textarea
                                name="notes"
                                rows={4}
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
                    href="/deployments"
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
                    {loading ? "Creating..." : "Create Deployment"}
                </button>
            </div>
        </form>
    )
}
