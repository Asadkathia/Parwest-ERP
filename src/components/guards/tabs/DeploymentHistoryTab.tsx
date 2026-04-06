"use client"

import { MapPin, Calendar, User, DollarSign } from "lucide-react"
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

const STATUS_COLORS: Record<string, string> = {
    ACTIVE:   "bg-green-100 text-green-800",
    INACTIVE: "bg-gray-100 text-gray-700",
}

export default function DeploymentHistoryTab({ deployments }: DeploymentHistoryTabProps) {
    const rows = deployments as DeploymentRecord[]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Deployment History</h2>
                <span className="text-sm text-gray-500">
                    Total: <strong>{rows.length}</strong>
                </span>
            </div>

            {rows.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No deployment history found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {rows.map((dep) => (
                        <div key={dep.id} className="bg-white rounded-lg border p-5 hover:shadow-sm transition-shadow">
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-base font-semibold leading-tight">
                                        {dep.clientName || "—"}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {[dep.branchName, dep.branchCity].filter(Boolean).join(", ") || "No branch"}
                                    </p>
                                    {dep.regionalOfficeName && (
                                        <p className="text-xs text-gray-400 mt-0.5">{dep.regionalOfficeName}</p>
                                    )}
                                </div>
                                <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[dep.status ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                                    {dep.status ?? "—"}
                                </span>
                            </div>

                            {/* Detail grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                                <div>
                                    <p className="text-xs text-gray-500">Designation</p>
                                    <p className="font-medium">{dep.designation || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Shift</p>
                                    <p className="font-medium">{dep.shiftType || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Type</p>
                                    <p className="font-medium">{dep.deploymentType || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Nature</p>
                                    <p className="font-medium">{dep.deploymentNature || "—"}</p>
                                </div>
                            </div>

                            {/* Dates + duration */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 border-t pt-3">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Started: <strong>{fmtDate(dep.deploymentDate) ?? "—"}</strong>
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Ended: <strong>{fmtDate(dep.endDate) ?? "Present"}</strong>
                                </span>
                                <span className="text-gray-400">
                                    Duration: <strong>{calcDuration(dep.deploymentDate, dep.endDate)}</strong>
                                </span>
                                {dep.salary != null && (
                                    <span className="flex items-center gap-1">
                                        <DollarSign className="h-3.5 w-3.5" />
                                        PKR {dep.salary.toLocaleString()}
                                    </span>
                                )}
                            </div>

                            {/* Who deployed / revoked */}
                            {(dep.deployedByName || dep.revokedByName || dep.endReason) && (
                                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2 pt-2 border-t">
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}