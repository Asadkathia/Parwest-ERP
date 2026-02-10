"use client"

import { useEffect, useState } from "react"

type InactiveGuard = {
    id: string
    parwestId: string
    name: string
    updatedAt: string
    status: string
}

export default function InactiveGuardsManager() {
    const [guards, setGuards] = useState<InactiveGuard[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

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
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Inactive Guards</h1>
                <p className="text-gray-600 mt-1">List of deactivated guards with reactivation controls</p>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="bg-white rounded-lg border overflow-x-auto">
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
                        ) : guards.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No inactive guards found.</td></tr>
                        ) : (
                            guards.map((guard) => (
                                <tr key={guard.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{guard.parwestId}</td>
                                    <td className="px-6 py-4 text-sm">{guard.name}</td>
                                    <td className="px-6 py-4 text-sm">{new Date(guard.updatedAt).toLocaleString("en-US")}</td>
                                    <td className="px-6 py-4 text-sm">{guard.status}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <button onClick={() => reactivateGuard(guard.id)} className="text-blue-600 hover:text-blue-800 font-medium">Reactivate</button>
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
