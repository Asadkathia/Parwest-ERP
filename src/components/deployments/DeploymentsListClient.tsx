"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Plus, MapPin, Activity, PauseCircle, Clock, RefreshCw, ShieldOff, Lock } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import StatCard from "@/components/ui/stat-card"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type RegionOption = { id: string; name: string }
type OfficeOption = { id: string; name: string; regionId: string | null }

type DeploymentRow = {
    id: string
    status: string
    shiftType: string
    designation: string
    deploymentDate: string
    endDate: string | null
    guard: { id: string; parwestId: string; name: string; phone: string | null; photoUrl: string | null }
    client: { id: string; name: string }
    branch: { id: string; name: string; city: string | null } | null
    regionalOffice: { id: string; name: string }
}

type Props = {
    regions: RegionOption[]
    offices: OfficeOption[]
    scopedRegionId: string | null
    scopedOfficeId: string | null
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
}

export default function DeploymentsListClient({
    regions,
    offices,
    scopedRegionId,
    scopedOfficeId,
    canCreate,
    canUpdate,
    canDelete,
}: Props) {
    const isRegionLocked = Boolean(scopedRegionId)
    const isOfficeLocked = Boolean(scopedOfficeId)

    const searchParams = useSearchParams()
    const urlRegionId = searchParams.get("regionId") ?? ""
    const regionId = scopedRegionId ?? urlRegionId
    const [officeId, setOfficeId] = useState<string>(scopedOfficeId ?? "")

    // Reset office whenever region changes (and a fresh region is picked).
    useEffect(() => {
        if (!isOfficeLocked) setOfficeId("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regionId])
    const [rows, setRows] = useState<DeploymentRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fetched, setFetched] = useState(false)

    const officesInRegion = useMemo(() => {
        if (!regionId) return offices
        return offices.filter((o) => !o.regionId || o.regionId === regionId)
    }, [offices, regionId])

    // Fetch whenever a region is selected (or when office changes within it).
    useEffect(() => {
        if (!regionId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset list when the region-gate is cleared
            setRows([])
            setFetched(false)
            return
        }

        const params = new URLSearchParams()
        if (officeId) params.set("regionalOfficeId", officeId)
        else params.set("regionId", regionId)

        const controller = new AbortController()
        setLoading(true)
        setError(null)

        fetch(`/api/deployments?${params.toString()}`, {
            signal: controller.signal,
            cache: "no-store",
        })
            .then(async (res) => {
                const body = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(body?.message || "Failed to load deployments.")
                setRows(Array.isArray(body) ? body : [])
                setFetched(true)
            })
            .catch((err: Error) => {
                if (err.name === "AbortError") return
                setError(err.message)
                setRows([])
            })
            .finally(() => setLoading(false))

        return () => controller.abort()
    }, [regionId, officeId])

    const stats = useMemo(() => {
        const total = rows.length
        const active = rows.filter((r) => r.status === "ACTIVE").length
        const inactive = rows.filter((r) => r.status === "INACTIVE").length
        return { total, active, inactive }
    }, [rows])

    return (
        <div className="space-y-6">
            <SectionTitle
                title="Deployments"
                subtitle="Manage guard deployments to client locations"
                action={
                    canCreate ? (
                        <Link href="/guards/deploy" className="ui-btn ui-btn-primary inline-flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Deploy Guard
                        </Link>
                    ) : null
                }
            />

            {/* Scope picker */}
            <section className="ui-card p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Suspense>
                        <RegionUrlPicker regions={regions} locked={isRegionLocked} includeGlobalOption={false} />
                    </Suspense>
                    <div>
                        <label className="mb-1 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                            Regional Office {isOfficeLocked && <Lock className="h-3.5 w-3.5" />}
                        </label>
                        <select
                            className="ui-select"
                            value={officeId}
                            disabled={isOfficeLocked || !regionId}
                            onChange={(e) => setOfficeId(e.target.value)}
                        >
                            <option value="">{regionId ? "All offices in region" : "Select a region first"}</option>
                            {officesInRegion.map((o) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                        {isOfficeLocked && (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">Locked to your assigned office.</p>
                        )}
                    </div>
                </div>
            </section>

            {error && <InlineAlert type="error" message={error} />}

            {!regionId ? (
                <div className="ui-card p-10 text-center">
                    <MapPin className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" />
                    <p className="text-base font-medium text-[var(--text)]">Select a region to view deployments.</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Deployments are region-scoped. Choose a region above to load its deployments.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <StatCard label="Loaded Deployments" value={stats.total} icon={<MapPin className="h-5 w-5" />} tone="brand" />
                        <StatCard label="Active" value={stats.active} icon={<Activity className="h-5 w-5" />} tone="success" />
                        <StatCard label="Inactive" value={stats.inactive} icon={<PauseCircle className="h-5 w-5" />} tone="warning" />
                    </div>

                    <section className="ui-card overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                                <tr>
                                    {["Guard", "Client · Branch", "Shift", "Designation", "Start Date", "End Date", "Status", "Actions"].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">Loading…</td>
                                    </tr>
                                ) : rows.length === 0 && fetched ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                            <p className="text-base font-medium text-[var(--text)]">No deployments found for this region.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((dep) => (
                                        <tr key={dep.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    {dep.guard.photoUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={dep.guard.photoUrl} alt={dep.guard.name}
                                                            className="h-8 w-8 rounded-full object-cover border border-[var(--border)] shrink-0" />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded-full bg-[var(--brand)]/10 border border-[var(--border)] flex items-center justify-center shrink-0">
                                                            <span className="text-xs font-bold text-[var(--brand)]">{dep.guard.name.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-[var(--text)] truncate">{dep.guard.name}</p>
                                                        <p className="text-xs text-[var(--text-muted)]">{dep.guard.parwestId}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-[var(--text)]">{dep.client.name}</p>
                                                {dep.branch ? (
                                                    <p className="text-xs text-[var(--text-muted)]">
                                                        {dep.branch.name}{dep.branch.city ? `, ${dep.branch.city}` : ""}
                                                    </p>
                                                ) : <p className="text-xs text-[var(--text-muted)]">—</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                                    dep.shiftType === "DAY"
                                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                                        : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                }`}>
                                                    <Clock className="h-3 w-3" />
                                                    {dep.shiftType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{dep.designation || "—"}</td>
                                            <td className="px-4 py-3 text-sm text-[var(--text)] whitespace-nowrap">
                                                {new Date(dep.deploymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">
                                                {dep.endDate
                                                    ? new Date(dep.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusChip
                                                    label={dep.status}
                                                    variant={dep.status === "ACTIVE" ? "success" : dep.status === "PENDING" ? "warning" : "neutral"}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/deployments/${dep.id}`} className="text-xs text-[var(--brand)] hover:underline font-medium">View</Link>
                                                    {dep.status === "ACTIVE" ? (
                                                        <>
                                                            {canUpdate && (
                                                                <>
                                                                    <span className="text-[var(--border)]">·</span>
                                                                    <Link href={`/deployments/${dep.id}/edit`}
                                                                        className="text-xs text-[var(--text-muted)] hover:text-[var(--brand)] font-medium inline-flex items-center gap-1">
                                                                        <RefreshCw className="h-3 w-3" /> Change
                                                                    </Link>
                                                                </>
                                                            )}
                                                            {canDelete && (
                                                                <>
                                                                    <span className="text-[var(--border)]">·</span>
                                                                    <Link href={`/deployments/${dep.id}/end`}
                                                                        className="text-xs text-red-500 hover:text-red-700 font-medium inline-flex items-center gap-1">
                                                                        <ShieldOff className="h-3 w-3" /> Revoke
                                                                    </Link>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>
                </>
            )}
        </div>
    )
}
