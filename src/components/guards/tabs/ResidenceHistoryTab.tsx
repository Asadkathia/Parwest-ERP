"use client"

import { Home } from "lucide-react"

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/card"
import { TabStatusBadge } from "@/components/guards/tabs/status-badge"
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
            <div>
                <h2 className="text-20 font-bold">Residence History</h2>
                <p className="text-sm text-muted-foreground">Past and current residence assignments.</p>
            </div>

            {records.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No residence records found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {records.map((record) => {
                        const isCurrent = record.status === "CURRENT"
                        return (
                            <Card key={record.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                        <CardTitle className="text-base">{record.address}</CardTitle>
                                        <TabStatusBadge
                                            label={isCurrent ? "Current" : "Vacated"}
                                            variant={isCurrent ? "success" : "muted"}
                                            className="w-fit"
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div>
                                            <p className="text-muted-foreground text-xs">Supervisor</p>
                                            <p className="font-medium">{record.supervisor || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Location</p>
                                            <p className="font-medium">{[record.city, record.state].filter(Boolean).join(", ") || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Assigned Date</p>
                                            <p className="font-medium tabular-nums">{fmt(record.assignDate) || "—"}</p>
                                            {record.assignedByName && (
                                                <p className="text-xs text-muted-foreground">by {record.assignedByName}</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">Vacated Date</p>
                                            {record.vacateDate ? (
                                                <>
                                                    <p className="font-medium tabular-nums">{fmt(record.vacateDate)}</p>
                                                    {record.vacatedByName && (
                                                        <p className="text-xs text-muted-foreground">by {record.vacatedByName}</p>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="font-medium text-emerald-600 dark:text-emerald-400">Currently Assigned</p>
                                            )}
                                        </div>
                                    </div>
                                    {(record.vacatedReason || record.notes) && (
                                        <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                                            {record.vacatedReason && (
                                                <p><span className="font-medium text-foreground">Vacate Reason:</span> {record.vacatedReason}</p>
                                            )}
                                            {record.notes && (
                                                <p><span className="font-medium text-foreground">Notes:</span> {record.notes}</p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
