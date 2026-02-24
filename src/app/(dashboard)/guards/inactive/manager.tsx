"use client"

import { useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type InactiveGuard = {
    id: string
    parwestId: string
    name: string
    updatedAt: string
    status: string
}

export default function InactiveGuardsManager() {
    const [guards, setGuards] = useState<InactiveGuard[]>([])
    const [entries, setEntries] = useState("10")
    const [search, setSearch] = useState("")
    const [selectDate, setSelectDate] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const [confirmReactivateId, setConfirmReactivateId] = useState<string | null>(null)

    const loadInactiveGuards = async () => {
        try {
            setLoading(true)
            setError("")
            const response = await fetch("/api/guards/inactive")
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch inactive guards")
            }

            const data = await response.json()
            setGuards(data)
        } catch (err: any) {
            setError(err.message)
            setGuards([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadInactiveGuards()
    }, [])

    const reactivateGuard = async (guardId: string) => {
        setError("")
        const response = await fetch(`/api/guards/${guardId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ACTIVE" }),
        })

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setError(data.message || "Failed to reactivate guard")
            return
        }

        await loadInactiveGuards()
        setNotice("Guard reactivated.")
    }

    const filtered = guards
        .filter((guard) => {
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return guard.name.toLowerCase().includes(q) || guard.parwestId.toLowerCase().includes(q)
        })
        .filter((guard) => {
            if (!selectDate) return true
            return new Date(guard.updatedAt).toISOString().slice(0, 10) === selectDate
        })
        .slice(0, Number.parseInt(entries, 10) || 10)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Inactive Guards</h1>
                <p className="text-gray-600 mt-1">List of deactivated guards with reactivation controls</p>
            </div>

            {error ? <InlineAlert type="error" message={error} /> : null}
            {notice ? <InlineAlert type="success" message={notice} /> : null}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-gray-50 px-4 py-3">
                    <div>
                        <label className="mb-1 block text-xs text-gray-600">Show 102550100200 entries</label>
                        <select name="Show 102550100200 entries" value={entries} onChange={(e) => setEntries(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                            {["10", "25", "50", "100", "200"].map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs text-gray-600">Search:</label>
                            <input name="Search:" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-md border px-2 py-1 text-sm" />
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
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Parwest ID</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Name</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Last Updated</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Status</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No inactive guards found.</td></tr>
                        ) : (
                            filtered.map((guard) => (
                                <tr key={guard.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{guard.parwestId}</td>
                                    <td className="px-6 py-4 text-sm">{guard.name}</td>
                                    <td className="px-6 py-4 text-sm">{new Date(guard.updatedAt).toLocaleString("en-US")}</td>
                                    <td className="px-6 py-4 text-sm">{guard.status}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <ActionButton variant="secondary" onClick={() => setConfirmReactivateId(guard.id)}>Activate</ActionButton>
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
                    onNo={() => setConfirmReactivateId(null)}
                    onYes={async () => {
                        await reactivateGuard(confirmReactivateId)
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
