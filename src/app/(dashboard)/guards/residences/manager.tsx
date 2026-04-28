"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import SearchSelect, { type SearchSelectOption } from "@/components/ui/SearchSelect"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type Residence = {
    id: string
    address: string
    ownerName: string | null
    ownerPhone: string | null
    supervisor: string | null
    capacity: number | null
    status: string
    rentPayable: number | null
    utilityBills: string | null
    paymentMethod: string | null
    referredBy: string | null
    state: string | null
    city: string | null
    remarks: string | null
    contractAttachment: string | null
    createdAt?: string
    _count?: { assignments: number }
}

type User = {
    id: string
    name: string | null
    email: string | null
    role?: { id: string; name: string } | null
}

const defaultForm = {
    id: "",
    address: "",
    ownerName: "",
    ownerPhone: "",
    supervisor: "",
    capacity: "",
    status: "ACTIVE",
    rentPayable: "",
    utilityBills: "",
    paymentMethod: "",
    referredBy: "",
    state: "",
    city: "",
    remarks: "",
    contractAttachment: "",
}

type Props = {
    regions?: { id: string; name: string }[]
    regionLocked?: boolean
}

export default function ResidencesManager({
    regions = [],
    regionLocked = false,
}: Props = {}) {
    const [query, setQuery] = useState("")
    const [entries, setEntries] = useState("10")
    const [selectDate, setSelectDate] = useState("")
    const [filterState, setFilterState] = useState("")
    const [filterCity, setFilterCity] = useState("")
    const [rows, setRows] = useState<Residence[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [form, setForm] = useState(defaultForm)
    const fileRef = useRef<HTMLInputElement>(null)

    const userOptions = useMemo<SearchSelectOption[]>(
        () => users
            .filter((u) => u.role?.name?.toLowerCase().includes("supervisor"))
            .map((u) => ({ value: u.name || u.email || u.id, label: u.name || u.email || u.id })),
        [users]
    )

    const loadResidences = useCallback(async () => {
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
            setRows(await response.json())
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [query])

    useEffect(() => { void loadResidences() }, [loadResidences])

    useEffect(() => {
        fetch("/api/users?status=ACTIVE")
            .then((r) => (r.ok ? r.json() : []))
            .then(setUsers)
            .catch(() => setUsers([]))
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => setForm((prev) => ({ ...prev, contractAttachment: reader.result as string }))
        reader.readAsDataURL(file)
    }

    const saveResidence = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess("")

        const response = await fetch(form.id ? `/api/residences/${form.id}` : "/api/residences", {
            method: form.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                address: form.address,
                ownerName: form.ownerName,
                ownerPhone: form.ownerPhone,
                supervisor: form.supervisor,
                capacity: form.capacity,
                status: form.status,
                rentPayable: form.rentPayable,
                utilityBills: form.utilityBills,
                paymentMethod: form.paymentMethod,
                referredBy: form.referredBy,
                state: form.state,
                city: form.city,
                remarks: form.remarks,
                contractAttachment: form.contractAttachment,
            }),
        })

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            setError(data.message || "Failed to save residence")
            return
        }

        setSuccess(form.id ? "Residence updated" : "Residence created")
        setForm(defaultForm)
        if (fileRef.current) fileRef.current.value = ""
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
            status: row.status || "ACTIVE",
            rentPayable: row.rentPayable?.toString() || "",
            utilityBills: row.utilityBills || "",
            paymentMethod: row.paymentMethod || "",
            referredBy: row.referredBy || "",
            state: row.state || "",
            city: row.city || "",
            remarks: row.remarks || "",
            contractAttachment: row.contractAttachment || "",
        })
        if (fileRef.current) fileRef.current.value = ""
    }

    const visibleRows = rows
        .filter((row) => {
            if (!query.trim()) return true
            const q = query.toLowerCase()
            return row.address.toLowerCase().includes(q) || (row.ownerName || "").toLowerCase().includes(q) || (row.supervisor || "").toLowerCase().includes(q)
        })
        .filter((row) => !selectDate || (row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) === selectDate : false))
        .filter((row) => !filterState || (row.state || "").toLowerCase().includes(filterState.toLowerCase()))
        .filter((row) => !filterCity || (row.city || "").toLowerCase().includes(filterCity.toLowerCase()))
        .slice(0, Number.parseInt(entries, 10) || 10)

    const f = (key: keyof typeof defaultForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm((prev) => ({ ...prev, [key]: e.target.value }))

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Add Residence</h1>
                <p className="text-gray-600 mt-1">Manage residence records and update ownership/supervisor data</p>
            </div>

            <form onSubmit={saveResidence} className="bg-white rounded-lg border p-5 space-y-4">
                <h2 className="font-semibold">{form.id ? "Edit Residence" : "Create Residence"}</h2>

                {/* Row 1: Basic info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={form.address} onChange={f("address")} className="ui-input" placeholder="Address" required />
                    <input value={form.ownerName} onChange={f("ownerName")} className="ui-input" placeholder="Owner Name" />
                    <input value={form.ownerPhone} onChange={f("ownerPhone")} className="ui-input" placeholder="Owner Phone" />
                </div>

                {/* Row 2: Supervisor, Capacity, Rent */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SearchSelect
                        key={form.id + "|" + form.supervisor}
                        name="supervisor"
                        options={userOptions}
                        placeholder="Select Supervisor..."
                        defaultValue={form.supervisor}
                        onChange={(val) => setForm((prev) => ({ ...prev, supervisor: val }))}
                    />
                    <input type="number" value={form.capacity} onChange={f("capacity")} className="ui-input" placeholder="Capacity" min={0} />
                    <input type="number" value={form.rentPayable} onChange={f("rentPayable")} className="ui-input" placeholder="Rent Payable (PKR)" min={0} />
                </div>

                {/* Row 3: Dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Utility Bills</label>
                        <select value={form.utilityBills} onChange={f("utilityBills")} className="ui-select">
                            <option value="">-- Select --</option>
                            <option value="INCLUDED">Included</option>
                            <option value="EXCLUDED">Excluded</option>
                            <option value="SHARED">Shared</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
                        <select value={form.paymentMethod} onChange={f("paymentMethod")} className="ui-select">
                            <option value="">-- Select --</option>
                            <option value="CASH">Cash</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select value={form.status} onChange={f("status")} className="ui-select">
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                        </select>
                    </div>
                </div>

                {/* Row 4: Location + Referred By */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={form.state} onChange={f("state")} className="ui-input" placeholder="State / Province" />
                    <input value={form.city} onChange={f("city")} className="ui-input" placeholder="City" />
                    <input value={form.referredBy} onChange={f("referredBy")} className="ui-input" placeholder="Referred By" />
                </div>

                {/* Row 5: Remarks + Contract */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Remarks</label>
                        <textarea value={form.remarks} onChange={f("remarks")} rows={2} className="ui-textarea" placeholder="Any remarks..." />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Rental Contract Attachment</label>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[var(--brand)] file:text-white hover:file:opacity-90 cursor-pointer border rounded-md px-2 py-1.5"
                        />
                        {form.contractAttachment && (
                            <p className="mt-1 text-xs text-green-600">
                                File attached ✓{" "}
                                <a href={form.contractAttachment} target="_blank" rel="noopener noreferrer" className="underline">Preview</a>
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button type="submit">{form.id ? "Update" : "Create"}</Button>
                    {form.id && (
                        <Button type="button" variant="secondary" onClick={() => { setForm(defaultForm); if (fileRef.current) fileRef.current.value = "" }}>
                            Cancel
                        </Button>
                    )}
                </div>
            </form>

            {/* Listing Filters */}
            <div className="bg-white rounded-lg border p-4 grid grid-cols-1 gap-3 md:grid-cols-6">
                <RegionUrlPicker
                    regions={regions}
                    locked={regionLocked}
                    includeGlobalOption={!regionLocked}
                />
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Show entries</label>
                    <select value={entries} onChange={(e) => setEntries(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                        {["10", "25", "50", "100"].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Search</label>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Address, owner or supervisor" />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Filter by State</label>
                    <input value={filterState} onChange={(e) => setFilterState(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="State / Province" />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Filter by City</label>
                    <input value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="City" />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Select Date</label>
                    <input type="date" value={selectDate} onChange={(e) => setSelectDate(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
            </div>

            {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
            {success ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert> : null}

            <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Address</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Owner</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Supervisor</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">State / City</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Rent Payable</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Utilities</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Payment</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Capacity</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Assignments</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Contract</th>
                            <th className="px-4 py-3 text-left text-xs uppercase text-gray-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={11} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
                        ) : visibleRows.length === 0 ? (
                            <tr><td colSpan={11} className="px-6 py-8 text-center text-sm text-gray-500">No residences found.</td></tr>
                        ) : (
                            visibleRows.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm">{row.address}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <div>{row.ownerName || "—"}</div>
                                        {row.ownerPhone && <div className="text-xs text-gray-400">{row.ownerPhone}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{row.supervisor ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{row.supervisor}</span> : <span className="text-gray-400 text-xs">Not assigned</span>}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {row.rentPayable != null ? `PKR ${row.rentPayable.toLocaleString()}` : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {row.utilityBills ? row.utilityBills.charAt(0) + row.utilityBills.slice(1).toLowerCase() : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {row.paymentMethod ? row.paymentMethod.replace("_", " ") : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{row.capacity ?? "—"}</td>
                                    <td className="px-4 py-3 text-sm">{row._count?.assignments ?? 0}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {row.contractAttachment ? (
                                            <a href={row.contractAttachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View</a>
                                        ) : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <Button variant="secondary" onClick={() => editResidence(row)}>Edit</Button>
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
