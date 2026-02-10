"use client"

import { useEffect, useState } from "react"

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
    const [rows, setRows] = useState<BlacklistedGuard[]>([])
    const [activeGuards, setActiveGuards] = useState<ActiveGuard[]>([])
    const [selectedGuardId, setSelectedGuardId] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

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
                        <label className="block text-sm text-gray-600 mb-1">Search by CNIC</label>
                        <input value={cnicQuery} onChange={(e) => setCnicQuery(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="42101-xxxxxxx-x" />
                    </div>
                    <div className="flex items-end">
                        <button onClick={loadBlacklisted} className="w-full border px-4 py-2 rounded-md hover:bg-gray-50">Search</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">Add Active Guard to Blacklist</label>
                        <select value={selectedGuardId} onChange={(e) => setSelectedGuardId(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="">--Select Guard--</option>
                            {activeGuards.map((guard) => (
                                <option key={guard.id} value={guard.id}>{guard.parwestId} - {guard.name} ({guard.cnic})</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button onClick={blacklistGuard} className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Blacklist</button>
                    </div>
                </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">CNIC</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Name</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Blacklisted On</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No blacklisted guards found.</td></tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{row.cnic}</td>
                                    <td className="px-6 py-4 text-sm">{row.name}</td>
                                    <td className="px-6 py-4 text-sm">{new Date(row.updatedAt).toLocaleString("en-US")}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <button onClick={() => removeFromBlacklist(row.id)} className="text-red-600 hover:text-red-800 font-medium">Remove</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
