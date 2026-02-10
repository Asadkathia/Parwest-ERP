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
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-lg border p-6">
            {/* Warning Banner */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
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
            <div className="bg-gray-50 rounded-md p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Deployment Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-600">Guard</p>
                        <p className="font-medium">{deployment.guard.name} ({deployment.guard.parwestId})</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Client</p>
                        <p className="font-medium">{deployment.client.name}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Branch</p>
                        <p className="font-medium">{deployment.branch?.name || "—"}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Designation</p>
                        <p className="font-medium">{deployment.designation || "—"}</p>
                    </div>
                    <div>
                        <p className="text-gray-600">Deployment Date</p>
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
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                        The date when this deployment ended (cannot be in the future)
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reason for Ending
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        placeholder="Optional: Provide a reason for ending this deployment..."
                        className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed"
                    >
                        {loading ? "Ending Deployment..." : "End Deployment"}
                    </button>
                    <Link
                        href={`/deployments/${deployment.id}`}
                        className="px-6 py-2 border rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    )
}
