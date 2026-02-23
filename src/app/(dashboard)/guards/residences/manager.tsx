"use client"

import { useEffect, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Residence = {
    id: string
    address: string
    ownerName: string | null
    ownerPhone: string | null
    supervisor: string | null
    capacity: number | null
    occupied: number | null
    status: string
    createdAt?: string
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
    const [entries, setEntries] = useState("10")
    const [selectDate, setSelectDate] = useState("")
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

    const visibleRows = rows
        .filter((row) => {
            if (!query.trim()) return true
            const q = query.toLowerCase()
            return row.address.toLowerCase().includes(q) || (row.ownerName || "").toLowerCase().includes(q) || (row.supervisor || "").toLowerCase().includes(q)
        })
        .filter((row) => {
            if (!selectDate) return true
            if (!row.createdAt) return false
            return new Date(row.createdAt).toISOString().slice(0, 10) === selectDate
        })
        .slice(0, Number.parseInt(entries, 10) || 10)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Add Residence</h1>
                <p className="text-gray-600 mt-1">Manage residence records and update ownership/supervisor data</p>
            </div>

            <form onSubmit={saveResidence} className="bg-white rounded-lg border p-4 space-y-3">
                <h2 className="font-semibold">{form.id ? "Edit Residence" : "Create Residence"}</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Address" required />
                    <input value={form.ownerName} onChange={(e) => setForm((prev) => ({ ...prev, ownerName: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Owner Name" />
                    <input value={form.ownerPhone} onChange={(e) => setForm((prev) => ({ ...prev, ownerPhone: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Owner Phone" />
                    <input value={form.supervisor} onChange={(e) => setForm((prev) => ({ ...prev, supervisor: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Select Supervisor" />
                    <input type="number" value={form.capacity} onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Capacity" min={0} />
                    <input type="number" value={form.occupied} onChange={(e) => setForm((prev) => ({ ...prev, occupied: e.target.value }))} className="border rounded-md px-3 py-2" placeholder="Occupied" min={0} />
                    <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="border rounded-md px-3 py-2">
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                    <div className="flex gap-2">
                        <ActionButton type="submit">{form.id ? "Update" : "Create"}</ActionButton>
                        {form.id && (
                            <ActionButton type="button" variant="secondary" onClick={() => setForm(defaultForm)}>Cancel</ActionButton>
                        )}
                    </div>
                </div>
            </form>

            <div className="bg-white rounded-lg border p-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Show</label>
                    <select value={entries} onChange={(e) => setEntries(e.target.value)} className="w-full border rounded-md px-3 py-2">
                        {["10", "25", "50", "100"].map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Search:</label>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="Address, owner or supervisor" />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Select Date</label>
                    <input type="date" value={selectDate} onChange={(e) => setSelectDate(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                </div>
                <div className="flex items-end">
                    <ActionButton onClick={loadResidences} className="w-full">Search</ActionButton>
                </div>
            </div>

            {error ? <InlineAlert type="error" message={error} /> : null}
            {success ? <InlineAlert type="success" message={success} /> : null}

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
                        ) : visibleRows.length === 0 ? (
                            <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No residences found.</td></tr>
                        ) : (
                            visibleRows.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm">{row.address}</td>
                                    <td className="px-6 py-4 text-sm">{row.ownerName || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.ownerPhone || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{row.supervisor || "—"}</td>
                                    <td className="px-6 py-4 text-sm">{(row.occupied ?? 0)}/{(row.capacity ?? 0)}</td>
                                    <td className="px-6 py-4 text-sm">{row._count?.assignments ?? 0}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <ActionButton variant="secondary" onClick={() => editResidence(row)}>Edit</ActionButton>
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
