"use client"

import { useEffect, useState } from "react"

type Residence = {
    id: string
    address: string
    ownerName: string | null
    ownerPhone: string | null
    supervisor: string | null
    capacity: number | null
    occupied: number | null
    status: string
    _count?: { assignments: number }
}

const defaultForm = {
    id: "",
    address: "",
    ownerName: "",
    ownerPhone: "",
    supervisor: "",
    capacity: "",
    occupied: "",
    status: "ACTIVE",
}

export default function ResidencesManager() {
    const [query, setQuery] = useState("")
    const [rows, setRows] = useState<Residence[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [form, setForm] = useState(defaultForm)

    const loadResidences = async () => {
        try {
            setLoading(true)
            setError("")

            const params = new URLSearchParams()
            if (query.trim()) params.set("q", query.trim())

            const response = await fetch(`/api/residences?${params.toString()}`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch residences")
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

    useEffect(() => {
        loadResidences()
    }, [])

    const saveResidence = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        const payload = {
            address: form.address,
            ownerName: form.ownerName,
            ownerPhone: form.ownerPhone,
            supervisor: form.supervisor,
            capacity: form.capacity,
            occupied: form.occupied,
            status: form.status,
        }

        const response = await fetch(form.id ? `/api/residences/${form.id}` : "/api/residences", {
            method: form.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setError(data.message || "Failed to save residence")
            return
        }

        setSuccess(form.id ? "Residence updated" : "Residence created")
        setForm(defaultForm)
        await loadResidences()
    }

    const editResidence = (row: Residence) => {
        setForm({
            id: row.id,
            address: row.address || "",
            ownerName: row.ownerName || "",
            ownerPhone: row.ownerPhone || "",
            supervisor: row.supervisor || "",
            capacity: row.capacity?.toString() || "",
            occupied: row.occupied?.toString() || "",
            status: row.status || "ACTIVE",
        })
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Residences</h1>
                <p className="text-gray-600 mt-1">Manage residence master records and assignments</p>
            </div>

            <form onSubmit={saveResidence} className="bg-white rounded-lg border p-4 space-y-3">
                <h2 className="font-semibold">{form.id ? "Edit Residence" : "Create Residence"}</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Address" required />
                    <input value={form.ownerName} onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Owner Name" />
                    <input value={form.ownerPhone} onChange={(e) => setForm((prev) => ({ ...prev, ownerPhone: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Owner Phone" />
                    <input value={form.supervisor} onChange={(e) => setForm((prev) => ({ ...prev, supervisor: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Supervisor" />
                    <input type="number" value={form.capacity} onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Capacity" min={0} />
                    <input type="number" value={form.occupied} onChange={(e) => setForm((prev) => ({ ...prev, occupied: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Occupied" min={0} />
                    <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="border rounded-md px-3 py-2">
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                    <div className="flex gap-2">
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">{form.id ? "Update" : "Create"}</button>
                        {form.id && (
                            <button type="button" onClick={() => setForm(defaultForm)} className="border px-4 py-2 rounded-md hover:bg-gray-50">Cancel</button>
                        )}
                    </div>
                </div>
            </form>

            <div className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-3">
                    <label className="block text-sm text-gray-600 mb-1">Search</label>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Address, owner or supervisor" />
                </div>
                <div className="flex items-end">
                    <button onClick={loadResidences} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Search</button>
                </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            {success && <div className="text-sm text-green-600">{success}</div>}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Address</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Owner Name</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Owner Phone</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Supervisor</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Occupancy</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Assignments</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-gray-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No residences found.</td></tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{row.address}</td>
                                    <td className="px-6 py-4 text-sm">{row.ownerName || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.ownerPhone || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.supervisor || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{(row.occupied ?? 0)}/{(row.capacity ?? 0)}</td>
                                    <td className="px-6 py-4 text-sm">{row._count?.assignments ?? 0}</td>
                                    <td className="px-6 py-4 text-sm"><button onClick={() => editResidence(row)} className="text-blue-600 hover:text-blue-800">Edit</button></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
