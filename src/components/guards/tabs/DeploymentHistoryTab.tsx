"use client"

import { MapPin, Calendar, User } from "lucide-react"

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/shadcn/card"
import { TabStatusBadge } from "@/components/guards/tabs/status-badge"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import type { GuardLooseRow } from "@/components/guards/tabs/types"

type DeploymentRecord = {
    id: string
    status?: string
    designation?: string
    shiftType?: string
    deploymentDate?: string | Date | null
    endDate?: string | Date | null
    endReason?: string | null
    deploymentType?: string | null
    deploymentNature?: string | null
    deployedByName?: string | null
    revokedByName?: string | null
    salary?: number | null
    // flat name fields
    clientName?: string | null
    branchName?: string | null
    branchCity?: string | null
    regionalOfficeName?: string | null
}

interface DeploymentHistoryTabProps {
    deployments: GuardLooseRow[]
}

function fmtDate(value?: string | Date | null) {
    if (!value) return null
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function calcDuration(start?: string | Date | null, end?: string | Date | null) {
    if (!start) return "—"
    const s = start instanceof Date ? start : new Date(start)
    const e = end ? (end instanceof Date ? end : new Date(end)) : new Date()
    if (Number.isNaN(s.getTime())) return "—"
    const days = Math.floor(Math.abs(e.getTime() - s.getTime()) / 86_400_000)
    const months = Math.floor(days / 30)
    const rem = days % 30
    if (months === 0) return `${rem}d`
    return `${months}mo ${rem}d`
}

export default function DeploymentHistoryTab({ deployments }: DeploymentHistoryTabProps) {
    const rows = deployments as DeploymentRecord[]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-20 font-bold">Deployment History</h2>
                    <p className="text-sm text-muted-foreground">All client deployments for this guard.</p>
                </div>
                <span className="text-sm text-muted-foreground">
                    Total: <strong className="tabular-nums">{rows.length}</strong>
                </span>
            </div>

            {rows.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No deployment history found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {rows.map((dep) => (
                        <Card key={dep.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base leading-tight">
                                            {dep.clientName || "—"}
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            {[dep.branchName, dep.branchCity].filter(Boolean).join(", ") || "No branch"}
                                        </p>
                                        {dep.regionalOfficeName && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{dep.regionalOfficeName}</p>
                                        )}
                                    </div>
                                    <TabStatusBadge
                                        label={dep.status ?? "—"}
                                        status={dep.status}
                                        className="flex-shrink-0"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Detail grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Designation</p>
                                        <p className="font-medium">{dep.designation || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Shift</p>
                                        <p className="font-medium">{dep.shiftType || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Type</p>
                                        <p className="font-medium">{dep.deploymentType || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Nature</p>
                                        <p className="font-medium">{dep.deploymentNature || "—"}</p>
                                    </div>
                                </div>

                                {/* Dates + duration */}
                                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        Started: <strong className="tabular-nums">{fmtDate(dep.deploymentDate) ?? "—"}</strong>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        Ended: <strong className="tabular-nums">{fmtDate(dep.endDate) ?? "Present"}</strong>
                                    </span>
                                    <span>
                                        Duration: <strong className="tabular-nums">{calcDuration(dep.deploymentDate, dep.endDate)}</strong>
                                    </span>
                                    {dep.salary != null && (
                                        <span>
                                            Salary: <ParwestCurrency value={dep.salary} compact={false} className="text-xs" />
                                        </span>
                                    )}
                                </div>

                                {/* Who deployed / revoked */}
                                {(dep.deployedByName || dep.revokedByName || dep.endReason) && (
                                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2 pt-2 border-t">
                                        {dep.deployedByName && (
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                Deployed by: <strong>{dep.deployedByName}</strong>
                                            </span>
                                        )}
                                        {dep.revokedByName && (
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                Revoked by: <strong>{dep.revokedByName}</strong>
                                            </span>
                                        )}
                                        {dep.endReason && (
                                            <span>End reason: <strong>{dep.endReason}</strong></span>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
