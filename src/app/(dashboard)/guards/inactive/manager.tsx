"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type InactiveGuard = {
    id: string
    parwestId: string
    name: string
    updatedAt: string
    status: string
    regionalOfficeId?: string | null
    regionalOffice?: { id: string; name: string; region?: { name: string } } | null
}

type RegionalOffice = { id: string; name: string; region: { id: string; name: string } }

type Props = {
    /** Region currently in scope (URL `?regionId=` for SuperAdmin or session region for REGIONAL). */
    effectiveRegionId?: string | null
    /** When the user is locked to a single office, hide the office picker. */
    lockedOfficeId?: string | null
    regions?: { id: string; name: string }[]
    regionLocked?: boolean
}

export default function InactiveGuardsManager({
    effectiveRegionId = null,
    lockedOfficeId = null,
    regions = [],
    regionLocked = false,
}: Props = {}) {
    const [guards, setGuards] = useState<InactiveGuard[]>([])
    const [entries, setEntries] = useState("10")
    const [search, setSearch] = useState("")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [regionalOfficeId, setRegionalOfficeId] = useState(lockedOfficeId ?? "")
    const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const [confirmReactivateId, setConfirmReactivateId] = useState<string | null>(null)
    const [reactivateReason, setReactivateReason] = useState("")

    const loadInactiveGuards = useCallback(async () => {
        try {
            setLoading(true)
            setError("")
            const params = new URLSearchParams()
            if (effectiveRegionId) params.set("regionId", effectiveRegionId)
            const response = await fetch(`/api/guards/inactive?${params.toString()}`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch inactive guards")
            }
            setGuards(await response.json())
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setGuards([])
        } finally {
            setLoading(false)
        }
    }, [effectiveRegionId])

    // Keep selected office in sync if the lock changes (rare).
    useEffect(() => {
        if (lockedOfficeId) setRegionalOfficeId(lockedOfficeId)
    }, [lockedOfficeId])

    useEffect(() => {
        void loadInactiveGuards()
        const params = new URLSearchParams()
        if (effectiveRegionId) params.set("regionId", effectiveRegionId)
        fetch(`/api/regional-offices?${params.toString()}`)
            .then((r) => r.ok ? r.json() : [])
            .then((data: RegionalOffice[]) => setRegionalOffices(data))
            .catch(() => {})
    }, [effectiveRegionId, loadInactiveGuards])

    const reactivateGuard = async (guardId: string, reason: string) => {
        setError("")
        if (!reason.trim()) { setError("Reactivation reason is required."); return }

        const response = await fetch(`/api/guards/${guardId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ACTIVE", reason }),
        })

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setError(data.message || "Failed to reactivate guard")
            return
        }

        await loadInactiveGuards()
        setNotice("Guard reactivated.")
        setReactivateReason("")
    }

    const filtered = guards
        .filter((g) => {
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return g.name.toLowerCase().includes(q) || g.parwestId.toLowerCase().includes(q)
        })
        .filter((g) => {
            if (!regionalOfficeId) return true
            return g.regionalOfficeId === regionalOfficeId
        })
        .filter((g) => {
            const d = new Date(g.updatedAt).toISOString().slice(0, 10)
            if (dateFrom && d < dateFrom) return false
            if (dateTo && d > dateTo) return false
            return true
        })
        .slice(0, Number.parseInt(entries, 10) || 10)

    const clearFilters = () => {
        setSearch("")
        setDateFrom("")
        setDateTo("")
        setRegionalOfficeId("")
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Inactive Guards</h1>
                <p className="text-gray-600 mt-1">List of deactivated guards with reactivation controls</p>
            </div>

            {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
            {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}

            <div className="bg-white rounded-lg border overflow-x-auto">
                {/* Filter bar */}
                <div className="border-b bg-gray-50 px-4 py-3 space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                        {/* Region */}
                        <div className="w-52">
                            <RegionUrlPicker
                                regions={regions}
                                locked={regionLocked}
                                includeGlobalOption={!regionLocked}
                            />
                        </div>
                        {/* Show entries */}
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Show entries</label>
                            <select
                                value={entries}
                                onChange={(e) => setEntries(e.target.value)}
                                className="rounded-md border px-2 py-1.5 text-sm"
                            >
                                {["10", "25", "50", "100", "200"].map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>

                        {/* Search */}
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Search</label>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Name or Parwest ID..."
                                className="rounded-md border px-2 py-1.5 text-sm w-48"
                            />
                        </div>

                        {/* Regional Office */}
                        {!lockedOfficeId && (
                            <div>
                                <label className="mb-1 block text-xs text-gray-600">Regional Office</label>
                                <select
                                    value={regionalOfficeId}
                                    onChange={(e) => setRegionalOfficeId(e.target.value)}
                                    className="rounded-md border px-2 py-1.5 text-sm w-52"
                                >
                                    <option value="">-- All Offices --</option>
                                    {regionalOffices.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.name}{o.region ? ` (${o.region.name})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Date From */}
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Date From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="rounded-md border px-2 py-1.5 text-sm"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Date To</label>
                            <input
                                type="date"
                                value={dateTo}
                                min={dateFrom || undefined}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="rounded-md border px-2 py-1.5 text-sm"
                            />
                        </div>

                        {/* Clear */}
                        {(search || dateFrom || dateTo || regionalOfficeId) ? (
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {/* Active filter summary */}
                    {(dateFrom || dateTo) && (
                        <p className="text-xs text-gray-500">
                            Showing records updated
                            {dateFrom ? ` from ${dateFrom}` : ""}
                            {dateTo ? ` to ${dateTo}` : ""}
                        </p>
                    )}
                </div>

                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Parwest ID</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Name</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Regional Office</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Last Updated</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Status</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No inactive guards found.</td></tr>
                        ) : (
                            filtered.map((guard) => (
                                <tr key={guard.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{guard.parwestId}</td>
                                    <td className="px-6 py-4 text-sm">{guard.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {guard.regionalOffice
                                            ? `${guard.regionalOffice.name}${guard.regionalOffice.region ? ` (${guard.regionalOffice.region.name})` : ""}`
                                            : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-sm">{new Date(guard.updatedAt).toLocaleString("en-US")}</td>
                                    <td className="px-6 py-4 text-sm">{guard.status}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <Button variant="secondary" onClick={() => setConfirmReactivateId(guard.id)}>
                                            Activate
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {confirmReactivateId ? (
                <ConfirmDialog
                    title="Activate Guard"
                    message="Are you sure you want to activate this inactive guard?"
                    reason={reactivateReason}
                    onReasonChange={setReactivateReason}
                    onNo={() => { setConfirmReactivateId(null); setReactivateReason("") }}
                    onYes={async () => {
                        await reactivateGuard(confirmReactivateId, reactivateReason)
                        setConfirmReactivateId(null)
                    }}
                />
            ) : null}
        </div>
    )
}

function ConfirmDialog({
    title,
    message,
    reason,
    onReasonChange,
    onYes,
    onNo,
}: {
    title: string
    message: string
    reason: string
    onReasonChange: (value: string) => void
    onYes: () => void | Promise<void>
    onNo: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
                <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>
                <div className="mt-3">
                    <label className="mb-1 block text-sm font-medium text-[var(--text)]">
                        Reactivation Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => onReasonChange(e.target.value)}
                        rows={3}
                        className="ui-textarea"
                        placeholder="Enter reason for reactivation"
                    />
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onNo}>No</Button>
                    <Button onClick={onYes}>Yes</Button>
                </div>
            </div>
        </div>
    )
}
