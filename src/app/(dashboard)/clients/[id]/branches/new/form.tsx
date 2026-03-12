"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, X } from "lucide-react"
import Link from "next/link"

type Region = { id: string; name: string }

type Props = {
    clientId: string
    clientName: string
    regions: Region[]
}

const OFFICE_TYPES = [
    "Main Branch",
    "Sub Branch",
    "Regional Office",
    "Area Office",
    "Field Office",
    "Cash Office",
    "ATM Site",
    "Warehouse",
    "Checkpoint",
    "Other",
]

export default function BranchForm({ clientId, clientName, regions }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Staff users for supervisor / manager dropdowns
    const [staffUsers, setStaffUsers] = useState<{ id: string; name: string }[]>([])

    // Regional office search
    const [regionSearch, setRegionSearch] = useState("")

    // Multiple contract attachments
    const [attachments, setAttachments] = useState<{ name: string; dataUrl: string }[]>([])
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetch("/api/users?limit=500")
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setStaffUsers(
                        (data as { id: string; name?: string | null }[])
                            .filter((u) => u.name)
                            .map((u) => ({ id: u.id, name: u.name as string }))
                    )
                }
            })
            .catch(() => {})
    }, [])

    const filteredRegions = regions.filter((r) =>
        r.name.toLowerCase().includes(regionSearch.toLowerCase())
    )

    const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        files.forEach((file) => {
            const reader = new FileReader()
            reader.onload = () =>
                setAttachments((prev) => [
                    ...prev,
                    { name: file.name, dataUrl: reader.result as string },
                ])
            reader.readAsDataURL(file)
        })
        if (fileRef.current) fileRef.current.value = ""
    }

    const removeAttachment = (idx: number) =>
        setAttachments((prev) => prev.filter((_, i) => i !== idx))

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = {
            ...Object.fromEntries(formData.entries()),
            clientId,
            isHeadOffice: formData.get("isHeadOffice") === "on",
            contractAttachments: attachments,
        }

        try {
            const response = await fetch("/api/branches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.message || "Failed to create branch")
            }

            router.push(`/clients/${clientId}`)
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="ui-card p-6">
            {error && (
                <div className="mb-6 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="space-y-8">

                {/* ── Basic Information ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Basic Information</h2>
                    <p className="mb-4 text-sm text-[var(--text-muted)]">Creating branch for: <span className="font-medium text-[var(--text)]">{clientName}</span></p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Branch Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                placeholder="e.g., Main Branch, Gulberg Branch"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Branch Code</label>
                            <input
                                type="text"
                                name="code"
                                placeholder="e.g., LHR-001, ISB-002"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Branch Model</label>
                            <select name="branchType" defaultValue="CONVENTIONAL" className="ui-select">
                                <option value="CONVENTIONAL">Conventional</option>
                                <option value="ISLAMIC">Islamic</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Office Type</label>
                            <select name="officeType" className="ui-select">
                                <option value="">— Select Office Type —</option>
                                {OFFICE_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="isHeadOffice"
                                    className="h-4 w-4 accent-[var(--brand)]"
                                />
                                <span className="text-sm text-[var(--text)]">This is the head office</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* ── Location Information ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Location Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Address</label>
                            <textarea
                                name="address"
                                rows={2}
                                placeholder="Enter complete address"
                                className="ui-textarea"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">City</label>
                            <input
                                type="text"
                                name="city"
                                placeholder="e.g., Lahore, Karachi"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Province</label>
                            <select name="province" className="ui-select">
                                <option value="">Select province</option>
                                <option value="Punjab">Punjab</option>
                                <option value="Sindh">Sindh</option>
                                <option value="KPK">Khyber Pakhtunkhwa</option>
                                <option value="Balochistan">Balochistan</option>
                                <option value="Islamabad">Islamabad Capital Territory</option>
                            </select>
                        </div>

                        {/* Regional Office with search */}
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Regional Office</label>
                            <input
                                type="text"
                                placeholder="Search regional office…"
                                value={regionSearch}
                                onChange={(e) => setRegionSearch(e.target.value)}
                                className="ui-input mb-1"
                            />
                            <select name="regionalOfficeId" className="ui-select">
                                <option value="">— Select Regional Office —</option>
                                {filteredRegions.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Coordinates */}
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Coordinates</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    name="latitude"
                                    placeholder="Latitude (-90 to 90)"
                                    className="ui-input"
                                />
                                <input
                                    type="text"
                                    name="longitude"
                                    placeholder="Longitude (-180 to 180)"
                                    className="ui-input"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Pin Location (Google Maps URL)</label>
                            <input
                                type="url"
                                name="pinLocation"
                                placeholder="https://maps.google.com/?q=..."
                                className="ui-input"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Contact Information ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Person</label>
                            <input
                                type="text"
                                name="contactPerson"
                                placeholder="Name of contact person"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Phone</label>
                            <input
                                type="tel"
                                name="contactPhone"
                                placeholder="0300-1234567"
                                className="ui-input"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Email</label>
                            <input
                                type="email"
                                name="contactEmail"
                                placeholder="branch@example.com"
                                className="ui-input"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Supervisor & Manager Assignment ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Supervisor &amp; Manager Assignment</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Supervisor</label>
                            <select name="assignedSupervisorId" className="ui-select">
                                <option value="">— Select Supervisor —</option>
                                {staffUsers.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Manager</label>
                            <select name="assignedManagerId" className="ui-select">
                                <option value="">— Select Manager —</option>
                                {staffUsers.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* ── Contract Attachments ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contract Attachments</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Upload Attachments</label>
                            <input
                                ref={fileRef}
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={handleFileAdd}
                                className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[var(--brand)] file:text-white hover:file:opacity-90 cursor-pointer border border-[var(--border)] rounded-[var(--radius-md)] px-2 py-1.5"
                            />
                            <p className="mt-1 text-xs text-[var(--text-muted)]">PDF, Word, or image files. You can select multiple files.</p>
                        </div>

                        {attachments.length > 0 && (
                            <div className="space-y-2">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="truncate text-[var(--text)]">{att.name}</span>
                                            <a
                                                href={att.dataUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-shrink-0 text-xs text-[var(--brand)] hover:underline"
                                            >
                                                Preview
                                            </a>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(idx)}
                                            className="flex-shrink-0 ml-3 text-[var(--text-muted)] hover:text-red-500"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {attachments.length === 0 && (
                            <p className="text-sm text-[var(--text-muted)] italic">No attachments added yet.</p>
                        )}
                    </div>
                </div>

            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t border-[var(--border)]">
                <Link
                    href={`/clients/${clientId}`}
                    className="ui-btn ui-btn-secondary inline-flex items-center gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="ui-btn ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "Creating..." : "Create Branch"}
                </button>
            </div>
        </form>
    )
}
