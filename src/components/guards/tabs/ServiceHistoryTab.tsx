"use client"

import { useEffect, useState } from "react"
import { History } from "lucide-react"

type ServiceHistoryRecord = {
    id: string
    event: string
    fromStatus: string | null
    toStatus: string | null
    description: string | null
    changedByName: string | null
    guardName: string | null
    parwestId: string | null
    regionName: string | null
    officeName: string | null
    createdAt: string
}

interface ServiceHistoryTabProps {
    guardId: string
}

const EVENT_LABELS: Record<string, string> = {
    ENROLLED: "Enrolled",
    STATUS_CHANGED: "Status Changed",
    BLACKLISTED: "Blacklisted",
    UNBLACKLISTED: "Removed from Blacklist",
    REACTIVATED: "Reactivated",
}

const EVENT_COLORS: Record<string, string> = {
    ENROLLED: "bg-green-100 text-green-800",
    STATUS_CHANGED: "bg-blue-100 text-blue-800",
    BLACKLISTED: "bg-red-100 text-red-800",
    UNBLACKLISTED: "bg-yellow-100 text-yellow-800",
    REACTIVATED: "bg-emerald-100 text-emerald-800",
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export default function ServiceHistoryTab({ guardId }: ServiceHistoryTabProps) {
    const [records, setRecords] = useState<ServiceHistoryRecord[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!guardId) return
        setLoading(true)
        fetch(`/api/guards/${guardId}/service-history`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setRecords(Array.isArray(data) ? data : []))
            .catch(() => setRecords([]))
            .finally(() => setLoading(false))
    }, [guardId])

    if (loading) {
        return (
            <div className="p-12 text-center text-sm text-gray-500">Loading service history...</div>
        )
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Service History</h2>
            <p className="text-sm text-gray-500">
                Full lifecycle history tracked by CNIC — includes all enrollments across regions and offices.
            </p>

            {records.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No service history found</p>
                    <p className="text-sm text-gray-400 mt-1">
                        History is recorded automatically from enrollment onwards.
                    </p>
                </div>
            ) : (
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />

                    <div className="space-y-4">
                        {records.map((record) => (
                            <div key={record.id} className="relative flex gap-4">
                                {/* Dot */}
                                <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                                    <History className="h-4 w-4 text-gray-400" />
                                </div>

                                <div className="flex-1 bg-white rounded-lg border p-4 pb-5">
                                    <div className="flex flex-wrap items-start gap-2 mb-2">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${EVENT_COLORS[record.event] ?? "bg-gray-100 text-gray-700"}`}>
                                            {EVENT_LABELS[record.event] ?? record.event}
                                        </span>
                                        {record.fromStatus && record.toStatus && (
                                            <span className="text-xs text-gray-500">
                                                {record.fromStatus} → {record.toStatus}
                                            </span>
                                        )}
                                        {!record.fromStatus && record.toStatus && (
                                            <span className="text-xs text-gray-500">{record.toStatus}</span>
                                        )}
                                    </div>

                                    {record.description && (
                                        <p className="text-sm text-gray-700 mb-2">{record.description}</p>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                                        {record.parwestId && (
                                            <div>
                                                <span className="font-medium text-gray-600">Parwest ID: </span>
                                                {record.parwestId}
                                            </div>
                                        )}
                                        {record.guardName && (
                                            <div>
                                                <span className="font-medium text-gray-600">Guard: </span>
                                                {record.guardName}
                                            </div>
                                        )}
                                        {record.officeName && (
                                            <div>
                                                <span className="font-medium text-gray-600">Office: </span>
                                                {record.officeName}
                                            </div>
                                        )}
                                        {record.regionName && (
                                            <div>
                                                <span className="font-medium text-gray-600">Region: </span>
                                                {record.regionName}
                                            </div>
                                        )}
                                        {record.changedByName && (
                                            <div>
                                                <span className="font-medium text-gray-600">By: </span>
                                                {record.changedByName}
                                            </div>
                                        )}
                                        <div className="col-span-2 md:col-span-1 ml-auto text-right">
                                            {fmtDate(record.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}