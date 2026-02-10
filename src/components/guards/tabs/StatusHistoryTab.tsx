"use client"

import { Activity } from "lucide-react"

interface StatusHistoryTabProps {
    statusHistory: any[]
}

export default function StatusHistoryTab({ statusHistory }: StatusHistoryTabProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Status History</h2>

            {statusHistory.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No status history found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changed By</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {statusHistory.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{record.previousStatus || "—"}</td>
                                    <td className="px-6 py-4 text-sm font-medium">{record.newStatus || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{record.changedBy || "—"}</td>
                                    <td className="px-6 py-4 text-sm">
                                        {record.changedDate
                                            ? new Date(record.changedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{record.reason || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

