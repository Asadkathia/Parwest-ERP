"use client"

import { useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type BlacklistedGuard = {
    id: string
    name: string
    cnic: string
    updatedAt: string
}

type ActiveGuard = {
    id: string
    parwestId: string
    name: string
    cnic: string
}

export default function BlacklistManager() {
    const [cnicQuery, setCnicQuery] = useState("")
    const [rowCountSelect, setRowCountSelect] = useState("10 rows")
    const [tableSearch, setTableSearch] = useState("")
    const [selectDate, setSelectDate] = useState("")
    const [rows, setRows] = useState<BlacklistedGuard[]>([])
    const [activeGuards, setActiveGuards] = useState<ActiveGuard[]>([])
    const [selectedGuardId, setSelectedGuardId] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

    const loadBlacklisted = async () => {
        try {
            setLoading(true)
            setError("")
            const params = new URLSearchParams()
            if (cnicQuery.trim()) params.set("cnic", cnicQuery.trim())

            const response = await fetch(`/api/guards/blacklist?${params.toString()}`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch blacklisted guards")
            }
            const data = await response.json()
            setRows(data)
        } catch (err: any) {
            setError(err.message)
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    const loadActiveGuards = async () => {
        try {
            const response = await fetch("/api/guards?status=ACTIVE")
            if (!response.ok) return
            const data = await response.json()
            setActiveGuards(data)
        } catch {
            setActiveGuards([])
        }
    }

    useEffect(() => {
        loadBlacklisted()
        loadActiveGuards()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const visibleRows = rows
        .filter((row) => {
            if (!tableSearch.trim()) return true
            const q = tableSearch.toLowerCase()
            return row.cnic.toLowerCase().includes(q) || row.name.toLowerCase().includes(q)
        })
        .filter((row) => {
            if (!selectDate) return true
            const d = new Date(row.updatedAt).toISOString().slice(0, 10)
            return d === selectDate
        })
        .slice(0, Number.parseInt(rowCountSelect, 10) || 10)

    const blacklistGuard = async () => {
        if (!selectedGuardId) return
        setError("")

        const response = await fetch("/api/guards/blacklist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guardId: selectedGuardId }),
        })

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setError(data.message || "Failed to blacklist guard")
            return
        }

        setSelectedGuardId("")
        await Promise.all([loadBlacklisted(), loadActiveGuards()])
        setNotice("Guard blacklisted.")
    }

    const removeFromBlacklist = async (guardId: string) => {
        setError("")
        const response = await fetch(`/api/guards/${guardId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ACTIVE" }),
        })

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setError(data.message || "Failed to remove from blacklist")
            return
        }

        await Promise.all([loadBlacklisted(), loadActiveGuards()])
        setNotice("Guard removed from blacklist.")
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Black Listed Guards</h1>
                <p className="text-gray-600 mt-1">Track and manage blacklisted guard records</p>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">Search by CNIC number...</label>
                        <input name="Cnic #" value={cnicQuery} onChange={(e) => setCnicQuery(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Cnic #" />
                    </div>
                    <div className="flex items-end">
                        <ActionButton onClick={loadBlacklisted} className="w-full">Search</ActionButton>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">Add Active Guard to Blacklist</label>
                        <select name="selected_guard_id" value={selectedGuardId} onChange={(e) => setSelectedGuardId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="">--Select Guard--</option>
                            {activeGuards.map((guard) => (
                                <option key={guard.id} value={guard.id}>{guard.parwestId} - {guard.name} ({guard.cnic})</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <ActionButton onClick={blacklistGuard} className="w-full">Submit</ActionButton>
                    </div>
                </div>
            </div>

            {error ? <InlineAlert type="error" message={error} /> : null}
            {notice ? <InlineAlert type="success" message={notice} /> : null}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-gray-50 px-4 py-3">
                    <div>
                        <label className="mb-1 block text-xs text-gray-600">Show</label>
                        <select name="rowCountSelect" value={rowCountSelect} onChange={(e) => setRowCountSelect(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                            {["10 rows", "25 rows", "50 rows", "100 rows"].map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Search:</label>
                            <input name="Search:" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="rounded-md border px-2 py-1 text-sm" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Select Date</label>
                            <input name="Select Date" type="date" value={selectDate} onChange={(e) => setSelectDate(e.target.value)} className="rounded-md border px-2 py-1 text-sm" />
                        </div>
                    </div>
                </div>
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Cnic #</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Name</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Blacklisted On</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : visibleRows.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No blacklisted guards found.</td></tr>
                        ) : (
                            visibleRows.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{row.cnic}</td>
                                    <td className="px-6 py-4 text-sm">{row.name}</td>
                                    <td className="px-6 py-4 text-sm">{new Date(row.updatedAt).toLocaleString("en-US")}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <button onClick={() => setConfirmRemoveId(row.id)} className="text-red-600 hover:text-red-800 font-medium">Remove</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {confirmRemoveId ? (
                <ConfirmDialog
                    title="Remove Blacklisted Guard"
                    message="Are you sure you want to remove this guard from blacklist?"
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
}: {
    title: string
    message: string
    onYes: () => void | Promise<void>
    onNo: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
                <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>
                <div className="mt-5 flex justify-end gap-2">
                    <ActionButton variant="secondary" onClick={onNo}>No</ActionButton>
                    <ActionButton onClick={onYes}>Yes</ActionButton>
                </div>
            </div>
        </div>
    )
}
