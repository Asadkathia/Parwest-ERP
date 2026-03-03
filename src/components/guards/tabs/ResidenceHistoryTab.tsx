"use client"

import { Home } from "lucide-react"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type ResidenceRecord = {
    id: string
    address?: string
    status?: string
    supervisor?: string
    assignDate?: string
    vacateDate?: string
}

interface ResidenceHistoryTabProps {
    residenceHistory: GuardLooseRow[]
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
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <h3 className="font-semibold">{record.address}</h3>
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${record.status === "CURRENT" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                                    {record.status}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
                                <div>
                                    <p className="text-gray-600">Supervisor</p>
                                    <p className="font-medium">{record.supervisor || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Assigned Date</p>
                                    <p className="font-medium">
                                        {record.assignDate
                                            ? new Date(record.assignDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-600">Vacate Date</p>
                                    <p className="font-medium">
                                        {record.vacateDate
                                            ? new Date(record.vacateDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                            : "Current Residence"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
