"use client"

import { Home } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type ResidenceRecord = {
    id: string
    address?: string
    status?: string
    supervisor?: string
    assignDate?: string
    assignedByName?: string | null
    vacateDate?: string | null
    vacatedByName?: string | null
    vacatedReason?: string | null
    city?: string | null
    state?: string | null
    notes?: string | null
}

interface ResidenceHistoryTabProps {
    residenceHistory: GuardLooseRow[]
}

function fmt(date?: string | null) {
    if (!date) return null
    return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function ResidenceHistoryTab({ residenceHistory }: ResidenceHistoryTabProps) {
    const records = residenceHistory as ResidenceRecord[]
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Residence History</h2>

            {records.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <Home className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No residence records found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {records.map((record) => (
                        <div key={record.id} className="bg-white rounded-lg border p-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
                                <h3 className="font-semibold text-base">{record.address}</h3>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium w-fit ${record.status === "CURRENT" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                                    {record.status === "CURRENT" ? "Current" : "Vacated"}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <p className="text-gray-500 text-xs">Supervisor</p>
                                    <p className="font-medium">{record.supervisor || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs">Location</p>
                                    <p className="font-medium">{[record.city, record.state].filter(Boolean).join(", ") || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs">Assigned Date</p>
                                    <p className="font-medium">{fmt(record.assignDate) || "—"}</p>
                                    {record.assignedByName && <p className="text-xs text-gray-400">by {record.assignedByName}</p>}
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs">Vacated Date</p>
                                    {record.vacateDate ? (
                                        <>
                                            <p className="font-medium">{fmt(record.vacateDate)}</p>
                                            {record.vacatedByName && <p className="text-xs text-gray-400">by {record.vacatedByName}</p>}
                                        </>
                                    ) : (
                                        <p className="font-medium text-green-600">Currently Assigned</p>
                                    )}
                                </div>
                            </div>
                            {(record.vacatedReason || record.notes) && (
                                <div className="mt-3 flex flex-col gap-1 text-sm text-gray-500">
                                    {record.vacatedReason && (
                                        <p><span className="font-medium text-gray-700">Vacate Reason:</span> {record.vacatedReason}</p>
                                    )}
                                    {record.notes && (
                                        <p><span className="font-medium text-gray-700">Notes:</span> {record.notes}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}