"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

type Deployment = {
    id: string
    guard: {
        name: string
        parwestId: string
    }
    client: {
        name: string
    }
    branch: {
        name: string
    } | null
    deploymentDate: Date
    designation: string | null
}

type Props = {
    deployment: Deployment
}

export default function EndDeploymentForm({ deployment }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])
    const [reason, setReason] = useState("")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const response = await fetch(`/api/deployments/${deployment.id}/end`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    endDate,
                    reason,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to end deployment")
            }

            router.push(`/deployments/${deployment.id}`)
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to end deployment")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="ui-card p-6">
            {/* Warning Banner */}
            <div className="mb-6 rounded-[var(--radius-md)] border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-yellow-900">Warning: This action will end the deployment</h3>
                        <p className="text-sm text-yellow-700 mt-1">
                            Ending this deployment will mark it as INACTIVE and free up the guard for new assignments.
                            This action cannot be undone.
                        </p>
                    </div>
                </div>
            </div>

            {/* Deployment Summary */}
            <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <h3 className="mb-3 font-medium text-[var(--text)]">Deployment Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-[var(--text-muted)]">Guard</p>
                        <p className="font-medium">{deployment.guard.name} ({deployment.guard.parwestId})</p>
                    </div>
                    <div>
                        <p className="text-[var(--text-muted)]">Client</p>
                        <p className="font-medium">{deployment.client.name}</p>
                    </div>
                    <div>
                        <p className="text-[var(--text-muted)]">Branch</p>
                        <p className="font-medium">{deployment.branch?.name || "—"}</p>
                    </div>
                    <div>
                        <p className="text-[var(--text-muted)]">Designation</p>
                        <p className="font-medium">{deployment.designation || "—"}</p>
                    </div>
                    <div>
                        <p className="text-[var(--text-muted)]">Deployment Date</p>
                        <p className="font-medium">
                            {new Date(deployment.deploymentDate).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>
                    </div>
                </div>
            </div>

            {/* End Deployment Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">
                        End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        className="ui-textarea"
                    />
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        The date when this deployment ended (cannot be in the future)
                    </p>
                </div>

                <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-1">
                        Reason for Ending
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        placeholder="Optional: Provide a reason for ending this deployment..."
                        className="ui-input"
                    />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                    <button
                        type="submit"
                        disabled={loading}
                        className="ui-btn ui-btn-danger disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? "Ending Deployment..." : "End Deployment"}
                    </button>
                    <Link
                        href={`/deployments/${deployment.id}`}
                        className="ui-btn ui-btn-secondary"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    )
}
