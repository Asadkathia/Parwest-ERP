"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"

import {
    Card,
    CardContent,
} from "@/components/shadcn/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/shadcn/table"
import { GuardStatusBadge } from "@/components/shadcn/guard-status-badge"
import { TabStatusBadge } from "@/components/guards/tabs/status-badge"

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

const TYPE_LABELS: Record<string, string> = {
    MANUAL:     "Manual",
    SYSTEM:     "System",
    BLACKLIST:  "Blacklist",
    ENROLLMENT: "Enrollment",
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
        return (
            <Card>
                <CardContent className="p-12 text-center text-sm text-muted-foreground">
                    Loading status history...
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-20 font-bold">Status History</h2>
                    <p className="text-sm text-muted-foreground">All recorded lifecycle status changes.</p>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                    {records.length} record{records.length !== 1 ? "s" : ""}
                </span>
            </div>

            {records.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No status history found</p>
                        <p className="text-sm text-muted-foreground mt-1">Status changes are recorded automatically going forward.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>From</TableHead>
                                    <TableHead>To</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Changed By</TableHead>
                                    <TableHead>Region / Office</TableHead>
                                    <TableHead>Date &amp; Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.map((record) => {
                                    const typeKey = record.changedByType ?? ""
                                    const typeLabel = TYPE_LABELS[typeKey] ?? record.changedByType ?? "—"
                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell>
                                                {record.fromStatus
                                                    ? <GuardStatusBadge status={record.fromStatus} />
                                                    : <span className="text-muted-foreground text-xs italic">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                <GuardStatusBadge status={record.toStatus} />
                                            </TableCell>
                                            <TableCell>
                                                {record.changedByType ? (
                                                    <TabStatusBadge label={typeLabel} status={typeKey} />
                                                ) : (
                                                    <span className="text-muted-foreground text-xs italic">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-foreground max-w-xs">
                                                {record.reason || <span className="text-muted-foreground italic">—</span>}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {record.changedByName || <span className="text-muted-foreground italic">System</span>}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {[record.officeName, record.regionName].filter(Boolean).join(" · ") || "—"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                                                {fmtDate(record.createdAt)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
