"use client"

import { MapPin, Calendar } from "lucide-react"

interface DeploymentHistoryTabProps {
    deployments: any[]
}

export default function DeploymentHistoryTab({ deployments }: DeploymentHistoryTabProps) {
    const formatDate = (date: string | null) => {
        if (!date) return "Present"
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return "bg-green-100 text-green-800"
            case "INACTIVE":
                return "bg-gray-100 text-gray-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    const calculateDuration = (startDate: string, endDate: string | null) => {
        const start = new Date(startDate)
        const end = endDate ? new Date(endDate) : new Date()
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        const months = Math.floor(diffDays / 30)
        const days = diffDays % 30
        return `${months} months, ${days} days`
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Deployment History</h2>
                <div className="text-sm text-gray-600">
                    Total Deployments: <span className="font-semibold">{deployments.length}</span>
                </div>
            </div>

            {deployments.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No deployment history found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {deployments.map((deployment) => (
                        <div key={deployment.id} className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold">{deployment.client}</h3>
                                    <p className="text-gray-600">{deployment.branch}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(deployment.status)}`}>
                                    {deployment.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Designation</p>
                                    <p className="font-medium">{deployment.designation}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Shift Type</p>
                                    <p className="font-medium">{deployment.shiftType}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Duration</p>
                                    <p className="font-medium">{calculateDuration(deployment.startDate, deployment.endDate)}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calendar className="h-4 w-4" />
                                    <span>Started: {formatDate(deployment.startDate)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calendar className="h-4 w-4" />
                                    <span>Ended: {formatDate(deployment.endDate)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
