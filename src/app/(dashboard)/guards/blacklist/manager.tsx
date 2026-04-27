"use client"

import { useEffect, useMemo, useState } from "react"
import { Trash2, X } from "lucide-react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type BlacklistedGuard = {
    id: string
    name: string
    cnic: string
    updatedAt: string
    reason?: string | null
    blacklistedBy?: string | null
}

type GuardOption = { id: string; name: string; cnic: string; parwestId: string }

type MatchingActiveGuard = {
    id: string
    parwestId: string
    name: string
    lifecycleStatus: string
}

const TERMINATION_REASON_OPTIONS = ["RESIGNED", "FIRED", "ABSCONDED", "DECEASED", "OTHER"] as const
type TerminationReasonOption = (typeof TERMINATION_REASON_OPTIONS)[number]

type Props = {
    regions?: { id: string; name: string }[]
    regionLocked?: boolean
}

export default function BlacklistManager({
    regions = [],
    regionLocked = false,
}: Props = {}) {
    // --- Search / select state ---
    const [cnicQuery, setCnicQuery] = useState("")
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [guardOptions, setGuardOptions] = useState<GuardOption[]>([])
    const [guardsFetching, setGuardsFetching] = useState(false)

    // --- Pending list (guards staged to be blacklisted) ---
    const [pendingList, setPendingList] = useState<GuardOption[]>([])

    // --- Reason + confirm ---
    const [reason, setReason] = useState("")
    const [absconded, setAbsconded] = useState(false)
    const [confirmBlacklist, setConfirmBlacklist] = useState(false)
    const [blacklisting, setBlacklisting] = useState(false)
    const [abscondedPromptVisible, setAbscondedPromptVisible] = useState(false)

    // --- Blacklisted records table ---
    const [rowCountSelect, setRowCountSelect] = useState("10 rows")
    const [tableSearch, setTableSearch] = useState("")
    const [selectDate, setSelectDate] = useState("")
    const [rows, setRows] = useState<BlacklistedGuard[]>([])
    const [loading, setLoading] = useState(false)
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const [directCnicInput, setDirectCnicInput] = useState("")
    const [directCnicError, setDirectCnicError] = useState("")

    // --- Post-blacklist termination prompt ---
    const [terminationCandidates, setTerminationCandidates] = useState<MatchingActiveGuard[]>([])
    const [terminationReason, setTerminationReason] = useState<TerminationReasonOption>("FIRED")
    const [terminating, setTerminating] = useState(false)

    // ── Fetch guard options once ────────────────────────────────────────────────
    const fetchGuardOptions = async () => {
        if (guardOptions.length > 0) return
        setGuardsFetching(true)
        try {
            const res = await fetch("/api/guards")
            if (res.ok) {
                const data = await res.json() as Array<{ id: string; name: string; cnic?: string; parwestId?: string }>
                setGuardOptions(data.map((g) => ({
                    id: g.id,
                    name: g.name,
                    cnic: g.cnic || "",
                    parwestId: g.parwestId || "",
                })))
            }
        } finally {
            setGuardsFetching(false)
        }
    }

    const filteredGuards = useMemo(() => {
        const q = cnicQuery.trim().toLowerCase()
        const pendingIds = new Set(pendingList.map((p) => p.id))
        const available = guardOptions.filter((g) => !pendingIds.has(g.id))
        if (!q) return available.slice(0, 8)
        return available.filter(
            (g) => g.cnic.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
        ).slice(0, 10)
    }, [cnicQuery, guardOptions, pendingList])

    // ── Add guard to pending list ────────────────────────────────────────────────
    const addToPending = (guard: GuardOption) => {
        setPendingList((prev) => {
            if (prev.find((p) => p.id === guard.id)) return prev
            return [...prev, guard]
        })
        setCnicQuery("")
        setDropdownOpen(false)
    }

    const removeFromPending = (id: string) => {
        setPendingList((prev) => prev.filter((p) => p.id !== id))
    }

    const addDirectCnic = () => {
        const trimmed = directCnicInput.trim()
        if (!/^\d{5}-\d{7}-\d$/.test(trimmed)) {
            setDirectCnicError("Invalid CNIC format. Use XXXXX-XXXXXXX-X")
            return
        }
        if (pendingList.some((p) => p.cnic === trimmed)) {
            setDirectCnicError("This CNIC is already in the list")
            return
        }
        setPendingList((prev) => [
            ...prev,
            { id: `direct-${trimmed}`, name: "(No enrolled guard)", cnic: trimmed, parwestId: "" },
        ])
        setDirectCnicInput("")
        setDirectCnicError("")
    }

    // ── Load blacklisted records ─────────────────────────────────────────────────
    const loadBlacklisted = async () => {
        try {
            setLoading(true)
            setError("")
            const response = await fetch("/api/guards/blacklist")
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch blacklisted CNIC records")
            }
            setRows(await response.json())
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadBlacklisted() }, [])

    // ── Blacklist all pending guards ─────────────────────────────────────────────
    const blacklistAll = async () => {
        if (pendingList.length === 0) { setError("No guards selected to blacklist."); return }
        if (absconded && !reason.trim()) {
            setError("A reason is required when marking a guard as absconded.")
            return
        }
        setError("")
        setAbscondedPromptVisible(false)
        setBlacklisting(true)
        const failures: string[] = []
        let sawConflict = false
        const aggregatedMatches: MatchingActiveGuard[] = []
        const seenGuardIds = new Set<string>()

        for (const guard of pendingList) {
            const body: { cnic: string; reason: string | null; absconded?: boolean } = {
                cnic: guard.cnic,
                reason: reason.trim() || null,
            }
            if (absconded) body.absconded = true
            const res = await fetch("/api/guards/blacklist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({} as Record<string, unknown>))
            if (!res.ok) {
                if (res.status === 409) sawConflict = true
                const msg = (data as { message?: string }).message || "failed"
                failures.push(`${guard.name} (${guard.cnic}): ${msg}`)
            } else {
                const matches = (data as { matchingActiveGuards?: MatchingActiveGuard[] }).matchingActiveGuards
                if (Array.isArray(matches)) {
                    for (const m of matches) {
                        if (!seenGuardIds.has(m.id)) {
                            seenGuardIds.add(m.id)
                            aggregatedMatches.push(m)
                        }
                    }
                }
            }
        }

        await loadBlacklisted()
        if (failures.length > 0) {
            setError(`Some CNICs failed:\n${failures.join("\n")}`)
            if (sawConflict && !absconded) setAbscondedPromptVisible(true)
        } else {
            setNotice(`${pendingList.length} CNIC${pendingList.length > 1 ? "s" : ""} blacklisted successfully.`)
            setPendingList([])
            setReason("")
            setAbsconded(false)
        }
        // Only prompt to terminate when ALL blacklist writes succeeded AND
        // there are currently-active guards tied to those CNICs.
        if (failures.length === 0 && aggregatedMatches.length > 0) {
            setTerminationReason("FIRED")
            setTerminationCandidates(aggregatedMatches)
        }
        setBlacklisting(false)
    }

    const terminateMatchingGuards = async () => {
        if (terminationCandidates.length === 0) return
        setTerminating(true)
        const failures: string[] = []
        for (const g of terminationCandidates) {
            const res = await fetch(`/api/guards/${g.id}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: "TERMINATED",
                    terminationReason,
                    reason: "Blacklist consequence",
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({} as Record<string, unknown>))
                const msg = (data as { message?: string }).message || "failed"
                failures.push(`${g.name} (${g.parwestId}): ${msg}`)
            }
        }
        setTerminating(false)
        setTerminationCandidates([])
        if (failures.length > 0) {
            setError(`Some guards could not be terminated:\n${failures.join("\n")}`)
        } else {
            setNotice("Matching guards terminated.")
        }
    }

    // ── Remove from blacklist ────────────────────────────────────────────────────
    const removeFromBlacklist = async (id: string) => {
        setError("")
        const response = await fetch("/api/guards/blacklist", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        })
        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setError(data.message || "Failed to remove from blacklist")
            return
        }
        await loadBlacklisted()
        setNotice("CNIC removed from blacklist.")
    }

    // ── Table filtering ──────────────────────────────────────────────────────────
    const visibleRows = rows
        .filter((row) => {
            if (!tableSearch.trim()) return true
            const q = tableSearch.toLowerCase()
            return row.cnic.toLowerCase().includes(q) || row.name.toLowerCase().includes(q)
        })
        .filter((row) => {
            if (!selectDate) return true
            return new Date(row.updatedAt).toISOString().slice(0, 10) === selectDate
        })
        .slice(0, Number.parseInt(rowCountSelect, 10) || 10)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Black Listed CNICs</h1>
                <p className="text-gray-600 mt-1">Blacklist CNIC identities to block future guard enrollment</p>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-4">
                {/* Step 1 – Search & Add */}
                <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        Step 1 — Search and select guards to blacklist
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2 relative">
                            <label className="block text-sm text-gray-600 mb-1">Search by Name or CNIC</label>
                            <input
                                value={cnicQuery}
                                onChange={(e) => setCnicQuery(e.target.value)}
                                onFocus={() => { setDropdownOpen(true); fetchGuardOptions() }}
                                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                                className="w-full border rounded-md px-3 py-2"
                                placeholder="Type name or CNIC..."
                                autoComplete="off"
                            />
                            {/* Dropdown */}
                            {dropdownOpen && (
                                <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                                    {guardsFetching && (
                                        <p className="px-3 py-2 text-sm text-gray-400">Loading guards...</p>
                                    )}
                                    {!guardsFetching && filteredGuards.length === 0 && (
                                        <p className="px-3 py-2 text-sm text-gray-400">
                                            {cnicQuery ? "No matching guards found" : "No guards available"}
                                        </p>
                                    )}
                                    {filteredGuards.map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                                            onMouseDown={() => addToPending(g)}
                                        >
                                            <span className="font-medium text-gray-800">{g.name}</span>
                                            <span className="text-xs text-gray-400 shrink-0">{g.cnic}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                className="w-full rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                                disabled={!cnicQuery.trim() || filteredGuards.length === 0}
                                onClick={() => filteredGuards.length > 0 && addToPending(filteredGuards[0])}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
                {/* Direct CNIC input */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">— or blacklist a CNIC directly (without enrolling a guard) —</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-600 mb-1">CNIC (format: XXXXX-XXXXXXX-X)</label>
                      <input
                        value={directCnicInput}
                        onChange={(e) => { setDirectCnicInput(e.target.value); setDirectCnicError("") }}
                        onKeyDown={(e) => e.key === "Enter" && addDirectCnic()}
                        className="w-full border rounded-md px-3 py-2"
                        placeholder="e.g. 35202-7833617-5"
                        autoComplete="off"
                      />
                      {directCnicError && <p className="mt-1 text-xs text-red-600">{directCnicError}</p>}
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-40"
                        disabled={!directCnicInput.trim()}
                        onClick={addDirectCnic}
                      >
                        Add CNIC
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pending list */}
                {pendingList.length > 0 && (
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                            Selected guards to blacklist ({pendingList.length})
                        </p>
                        <div className="rounded-md border border-orange-200 bg-orange-50 divide-y divide-orange-100">
                            {pendingList.map((g) => (
                                <div key={g.id} className="flex items-center justify-between px-3 py-2">
                                    <div>
                                        <span className="text-sm font-medium text-gray-800">{g.name}</span>
                                        <span className="ml-2 text-xs text-gray-500">{g.cnic}</span>
                                        {g.parwestId && <span className="ml-2 text-xs text-gray-400">{g.parwestId}</span>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFromPending(g.id)}
                                        className="text-red-500 hover:text-red-700 p-1"
                                        title="Remove"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2 – Reason + Blacklist */}
                <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        Step 2 — Add a reason and confirm blacklist
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-600 mb-1">Reason (Optional)</label>
                            <input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full border rounded-md px-3 py-2"
                                placeholder="Reason for blacklisting"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                disabled={pendingList.length === 0}
                                onClick={() => {
                                    if (pendingList.length === 0) { setError("No guards selected."); return }
                                    setError("")
                                    setConfirmBlacklist(true)
                                }}
                                className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Blacklist {pendingList.length > 0 ? `(${pendingList.length})` : ""}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error ? <InlineAlert type="error" message={error} /> : null}
            {abscondedPromptVisible ? (
                <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                    Tick the Absconded box to forfeit kit and continue.
                </p>
            ) : null}
            {notice ? <InlineAlert type="success" message={notice} /> : null}

            {/* Blacklisted records table */}
            <div className="bg-white rounded-lg border overflow-x-auto">
                <div className="border-b bg-gray-50 px-4 py-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <RegionUrlPicker
                            regions={regions}
                            locked={regionLocked}
                            includeGlobalOption={!regionLocked}
                        />
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Show</label>
                            <select
                                value={rowCountSelect}
                                onChange={(e) => setRowCountSelect(e.target.value)}
                                className="rounded-md border px-2 py-1 text-sm w-full"
                            >
                                {["10 rows", "25 rows", "50 rows", "100 rows"].map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Search:</label>
                            <input
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                className="rounded-md border px-2 py-1 text-sm w-full"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Select Date</label>
                            <input
                                type="date"
                                value={selectDate}
                                onChange={(e) => setSelectDate(e.target.value)}
                                className="rounded-md border px-2 py-1 text-sm w-full"
                            />
                        </div>
                    </div>
                </div>
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Cnic #</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Name</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Blacklisted By</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Reason</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Blacklisted On</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : visibleRows.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No blacklisted CNIC records found.</td></tr>
                        ) : (
                            visibleRows.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{row.cnic}</td>
                                    <td className="px-6 py-4 text-sm">{row.name}</td>
                                    <td className="px-6 py-4 text-sm">{row.blacklistedBy || "System"}</td>
                                    <td className="px-6 py-4 text-sm">{row.reason || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{new Date(row.updatedAt).toLocaleString("en-US")}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <button
                                            onClick={() => setConfirmRemoveId(row.id)}
                                            className="text-red-600 hover:text-red-800 font-medium"
                                        >
                                            Unblock
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Confirm blacklist all pending */}
            {confirmBlacklist ? (
                <ConfirmDialog
                    title={`Blacklist ${pendingList.length} Guard${pendingList.length > 1 ? "s" : ""}?`}
                    processing={blacklisting}
                    message={
                        <div className="space-y-1">
                            <p>The following CNICs will be permanently blocked from future enrollment:</p>
                            <ul className="mt-2 space-y-1">
                                {pendingList.map((g) => (
                                    <li key={g.id} className="flex items-center justify-between text-sm rounded bg-gray-50 px-2 py-1">
                                        <span className="font-medium">{g.name}</span>
                                        <span className="text-gray-500 text-xs">{g.cnic}</span>
                                    </li>
                                ))}
                            </ul>
                            {reason && <p className="mt-2 text-xs text-gray-500">Reason: {reason}</p>}
                            <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2">
                                <label className="flex items-start gap-2 text-sm text-orange-900">
                                    <input
                                        type="checkbox"
                                        checked={absconded}
                                        onChange={(e) => setAbsconded(e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <span>Guard has absconded (forfeit kit, end deployments)</span>
                                </label>
                                {absconded && !reason.trim() && (
                                    <p className="mt-1 text-xs text-red-600">A reason is required when marking as absconded.</p>
                                )}
                            </div>
                        </div>
                    }
                    onNo={() => setConfirmBlacklist(false)}
                    onYes={async () => {
                        if (absconded && !reason.trim()) return
                        setConfirmBlacklist(false)
                        await blacklistAll()
                    }}
                />
            ) : null}

            {/* Offer to terminate matching active guards after blacklist */}
            {terminationCandidates.length > 0 ? (
                <ConfirmDialog
                    title={`Terminate ${terminationCandidates.length} matching guard${terminationCandidates.length > 1 ? "s" : ""}?`}
                    processing={terminating}
                    message={
                        <div className="space-y-2">
                            <p>
                                The following currently-active guard{terminationCandidates.length > 1 ? "s share" : " shares"} a
                                blacklisted CNIC. Blacklisting the CNIC does <b>not</b> automatically terminate them.
                                Do you want to terminate them now?
                            </p>
                            <ul className="mt-2 space-y-1">
                                {terminationCandidates.map((g) => (
                                    <li key={g.id} className="flex items-center justify-between text-sm rounded bg-gray-50 px-2 py-1">
                                        <span className="font-medium">{g.name}</span>
                                        <span className="text-gray-500 text-xs">{g.parwestId} · {g.lifecycleStatus}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-3">
                                <label className="block text-xs text-gray-600 mb-1">Termination reason</label>
                                <select
                                    value={terminationReason}
                                    onChange={(e) => setTerminationReason(e.target.value as TerminationReasonOption)}
                                    className="w-full rounded-md border px-2 py-1 text-sm"
                                    disabled={terminating}
                                >
                                    {TERMINATION_REASON_OPTIONS.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    }
                    onNo={() => setTerminationCandidates([])}
                    onYes={terminateMatchingGuards}
                />
            ) : null}

            {/* Confirm unblock */}
            {confirmRemoveId ? (
                <ConfirmDialog
                    title="Remove CNIC from Blacklist"
                    message="Are you sure you want to unblock this CNIC for future enrollment?"
                    onNo={() => setConfirmRemoveId(null)}
                    onYes={async () => {
                        await removeFromBlacklist(confirmRemoveId)
                        setConfirmRemoveId(null)
                    }}
                />
            ) : null}
        </div>
    )
}

function ConfirmDialog({
    title,
    message,
    onYes,
    onNo,
    processing = false,
}: {
    title: string
    message: React.ReactNode
    onYes: () => void | Promise<void>
    onNo: () => void
    processing?: boolean
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
                <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
                <div className="mt-2 text-sm text-[var(--text-muted)]">{message}</div>

                {processing && (
                    <div className="mt-4 flex items-center gap-3 rounded-md bg-orange-50 border border-orange-200 px-4 py-3">
                        <svg className="h-5 w-5 animate-spin text-orange-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        <span className="text-sm font-medium text-orange-700">Processing blacklist request, please wait...</span>
                    </div>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <ActionButton variant="secondary" onClick={onNo} disabled={processing}>
                        <X className="h-4 w-4 mr-1 inline" />
                        Cancel
                    </ActionButton>
                    <ActionButton onClick={onYes} disabled={processing}>
                        {processing ? "Processing..." : "Yes, Blacklist"}
                    </ActionButton>
                </div>
            </div>
        </div>
    )
}
