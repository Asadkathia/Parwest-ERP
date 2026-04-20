"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"

type StatusHistoryRecord = {
    id: string
    fromStatus: string | null
    toStatus: string
    reason: string | null
    changedByName: string | null
    changedByType: string | null
    parwestId: string | null
    regionName: string | null
    officeName: string | null
    createdAt: string
}

interface StatusHistoryTabProps {
    guardId: string
}

const STATUS_COLORS: Record<string, string> = {
    ACTIVE:      "bg-green-100 text-green-800",
    PRESENT:     "bg-blue-100 text-blue-800",
    DEFAULT:     "bg-cyan-100 text-cyan-800",
    ABSENT:      "bg-yellow-100 text-yellow-800",
    INACTIVE:    "bg-gray-200 text-gray-700",
    PENDING:     "bg-orange-100 text-orange-800",
    BLACKLISTED: "bg-red-100 text-red-800",
    TERMINATED:  "bg-red-50 text-red-700",
}

const TYPE_LABELS: Record<string, string> = {
    MANUAL:     "Manual",
    SYSTEM:     "System",
    BLACKLIST:  "Blacklist",
    ENROLLMENT: "Enrollment",
}

const TYPE_COLORS: Record<string, string> = {
    MANUAL:     "bg-blue-50 text-blue-700",
    SYSTEM:     "bg-purple-50 text-purple-700",
    BLACKLIST:  "bg-red-50 text-red-700",
    ENROLLMENT: "bg-green-50 text-green-700",
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

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
            {status}
        </span>
    )
}

export default function StatusHistoryTab({ guardId }: StatusHistoryTabProps) {
    const [records, setRecords] = useState<StatusHistoryRecord[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!guardId) return
        // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch driven by guardId
        setLoading(true)
        fetch(`/api/guards/${guardId}/status-history`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setRecords(Array.isArray(data) ? data : []))
            .catch(() => setRecords([]))
            .finally(() => setLoading(false))
    }, [guardId])

    if (loading) {
        return <div className="p-12 text-center text-sm text-gray-500">Loading status history...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Status History</h2>
                <span className="text-sm text-gray-500">{records.length} record{records.length !== 1 ? "s" : ""}</span>
            </div>

            {records.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No status history found</p>
                    <p className="text-sm text-gray-400 mt-1">Status changes are recorded automatically going forward.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">From</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">To</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Changed By</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Region / Office</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {records.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        {record.fromStatus
                                            ? <StatusBadge status={record.fromStatus} />
                                            : <span className="text-gray-400 text-xs italic">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={record.toStatus} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[record.changedByType ?? ""] ?? "bg-gray-50 text-gray-600"}`}>
                                            {TYPE_LABELS[record.changedByType ?? ""] ?? record.changedByType ?? "—"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 max-w-xs">
                                        {record.reason || <span className="text-gray-400 italic">—</span>}
                                    </td>
                                    <td className="px-4 py-3 font-medium">
                                        {record.changedByName || <span className="text-gray-400 italic">System</span>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {[record.officeName, record.regionName].filter(Boolean).join(" · ") || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                        {fmtDate(record.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}