"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, X, CheckCircle2, Upload, Plus } from "lucide-react"
import Link from "next/link"
import SearchSelect from "@/components/ui/SearchSelect"
import LocationPickerMap from "@/components/ui/LocationPickerMap"

type Region = { id: string; name: string }

type Props = {
    clientId: string
    clientName: string
    regions: Region[]
}

const OFFICE_TYPE_OPTIONS = [
    "Main Branch", "Sub Branch", "Regional Office", "Area Office",
    "Field Office", "Cash Office", "ATM Site", "Warehouse", "Checkpoint", "Other",
].map((t) => ({ value: t, label: t }))

const PROVINCE_OPTIONS = [
    { value: "Punjab", label: "Punjab" },
    { value: "Sindh", label: "Sindh" },
    { value: "KPK", label: "Khyber Pakhtunkhwa" },
    { value: "Balochistan", label: "Balochistan" },
    { value: "Islamabad", label: "Islamabad Capital Territory" },
]

const BRANCH_MODEL_OPTIONS = [
    { value: "CONVENTIONAL", label: "Conventional" },
    { value: "ISLAMIC", label: "Islamic" },
]

const DESIGNATION_OPTIONS = [
    { value: "Guard", label: "Guard" },
    { value: "Supervisor", label: "Supervisor" },
    { value: "CPO", label: "CPO" },
    { value: "Armed Guard", label: "Armed Guard" },
    { value: "Unarmed Guard", label: "Unarmed Guard" },
]

const EX_SERVICE_OPTIONS = [
    { value: "Yes", label: "Yes" },
    { value: "No", label: "No" },
    { value: "Other", label: "Other" },
]

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(file)
    })
}

export default function BranchForm({ clientId, clientName, regions }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Staff users for supervisor / manager dropdowns
    const [staffUsers, setStaffUsers] = useState<{ id: string; name: string }[]>([])

    // Map → manual lat/lng auto-fill
    const [latManual, setLatManual] = useState("")
    const [lngManual, setLngManual] = useState("")

    // Multiple contact phones
    const [contactPhones, setContactPhones] = useState<string[]>([""])

    // Contract PDF attachment (single)
    const [contractFile, setContractFile] = useState<string | null>(null)
    const [contractFileName, setContractFileName] = useState("")

    // Additional file attachments (multi)
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

    const handleContractFile = async (file: File | null) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) { setError("Contract file must be under 5 MB"); return }
        const base64 = await readFileAsBase64(file)
        setContractFile(base64)
        setContractFileName(file.name)
    }

    const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        files.forEach((file) => {
            const reader = new FileReader()
            reader.onload = () =>
                setAttachments((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }])
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
            ...(contractFile ? { contractUrl: contractFile } : {}),
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

            router.push(`/clients/${clientId}?tab=branches`)
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
                            <input type="text" name="name" required placeholder="e.g., Main Branch, Gulberg Branch" className="ui-input" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Branch Code</label>
                            <input type="text" name="code" placeholder="e.g., LHR-001, ISB-002" className="ui-input" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Branch Model</label>
                            <SearchSelect name="branchType" options={BRANCH_MODEL_OPTIONS} defaultValue="CONVENTIONAL" placeholder="Select model" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Office Type</label>
                            <SearchSelect name="officeType" options={OFFICE_TYPE_OPTIONS} placeholder="— Select Office Type —" />
                        </div>

                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" name="isHeadOffice" className="h-4 w-4 accent-[var(--brand)]" />
                                <span className="text-sm text-[var(--text)]">This is the head office</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* ── Location Information ── */}
                <div className="space-y-6">
                    <h2 className="text-base font-semibold pb-2 border-b border-[var(--border)] text-[var(--text)]">Location Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Address</label>
                            <textarea name="address" rows={2} placeholder="Enter complete address" className="ui-textarea" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">City</label>
                            <input type="text" name="city" placeholder="e.g., Lahore, Karachi" className="ui-input" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Province</label>
                            <SearchSelect name="province" options={PROVINCE_OPTIONS} placeholder="Select province" />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Regional Office</label>
                            <SearchSelect
                                name="regionalOfficeId"
                                options={regions.map((r) => ({ value: r.id, label: r.name }))}
                                placeholder="— Select Regional Office —"
                            />
                        </div>
                    </div>

                    {/* Map picker */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-2">
                            Pick Branch Location on Map
                            <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">(search or click to drop marker — or type coordinates manually below)</span>
                        </label>
                        <LocationPickerMap
                            latName="latitude"
                            lngName="longitude"
                            label="Branch"
                            onLocationChange={(lat, lng) => { setLatManual(lat); setLngManual(lng) }}
                        />
                    </div>

                    {/* Manual coordinate override */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Latitude <span className="text-xs">(manual)</span></label>
                            <input
                                type="text"
                                name="latitudeManual"
                                className="ui-input"
                                placeholder="e.g. 31.5204"
                                value={latManual}
                                onChange={(e) => setLatManual(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Longitude <span className="text-xs">(manual)</span></label>
                            <input
                                type="text"
                                name="longitudeManual"
                                className="ui-input"
                                placeholder="e.g. 74.3587"
                                value={lngManual}
                                onChange={(e) => setLngManual(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Day Guard Capacity</label>
                            <input type="number" name="dayGuardCapacity" className="ui-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Night Guard Capacity</label>
                            <input type="number" name="nightGuardCapacity" className="ui-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Day Supervisor Capacity</label>
                            <input type="number" name="daySupervisorCapacity" className="ui-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Night Supervisor Capacity</label>
                            <input type="number" name="nightSupervisorCapacity" className="ui-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">CPO Capacity</label>
                            <input type="number" name="cpoCapacity" className="ui-input" placeholder="0" />
                        </div>

                    </div>
                </div>

                {/* ── Contact Information ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Person</label>
                            <input type="text" name="contactPerson" placeholder="Name of contact person" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Phone</label>
                            <div className="space-y-2">
                                {contactPhones.map((num, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="tel"
                                            value={num}
                                            onChange={(e) => {
                                                const updated = [...contactPhones]
                                                updated[idx] = e.target.value
                                                setContactPhones(updated)
                                            }}
                                            className="ui-input flex-1"
                                            placeholder={idx === 0 ? "0300-1234567" : `Phone ${idx + 1}`}
                                        />
                                        {contactPhones.length > 1 && (
                                            <button type="button" onClick={() => setContactPhones(contactPhones.filter((_, i) => i !== idx))} className="flex-shrink-0 text-[var(--text-muted)] hover:text-red-500">
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={() => setContactPhones([...contactPhones, ""])} className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline mt-1">
                                    <Plus size={13} /> Add another number
                                </button>
                            </div>
                            {/* Hidden inputs for form submission */}
                            {contactPhones.filter(p => p.trim()).map((p, idx) => (
                                <input key={idx} type="hidden" name={idx === 0 ? "contactPhone" : `contactPhone_${idx}`} value={p} />
                            ))}
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Email</label>
                            <input type="email" name="contactEmail" placeholder="branch@example.com" className="ui-input" />
                        </div>
                    </div>
                </div>

                {/* ── Supervisor & Manager Assignment ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Supervisor &amp; Manager Assignment</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Supervisor</label>
                            <SearchSelect
                                name="assignedSupervisorId"
                                options={staffUsers.map((u) => ({ value: u.id, label: u.name }))}
                                placeholder="— Select Supervisor —"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Manager</label>
                            <SearchSelect
                                name="assignedManagerId"
                                options={staffUsers.map((u) => ({ value: u.id, label: u.name }))}
                                placeholder="— Select Manager —"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Branch Contract ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Branch Contract</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Start</label>
                            <input type="date" name="contractStart" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract End</label>
                            <input type="date" name="contractEnd" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Rate Start</label>
                            <input type="date" name="contractRateStart" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Rate End</label>
                            <input type="date" name="contractRateEnd" className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Regional Office (Contract)</label>
                            <SearchSelect
                                name="contractRegionalOffice"
                                options={regions.map((r) => ({ value: r.id, label: r.name }))}
                                placeholder="— Select Regional Office —"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Designation</label>
                            <SearchSelect name="contractGuardDesignation" options={DESIGNATION_OPTIONS} placeholder="Select designation" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Additional Guards</label>
                            <input type="number" name="contractAdditionalGuards" className="ui-input" placeholder="0" min={0} />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Ex Service</label>
                            <SearchSelect name="contractGuardExService" options={EX_SERVICE_OPTIONS} placeholder="Select" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Price</label>
                            <input type="number" name="contractPrice" className="ui-input" placeholder="Price" />
                        </div>
                    </div>
                </div>

                {/* ── Contract PDF Attachment ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contract Attachment (PDF)</h2>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-2">Upload Contract (PDF / Image, max 5 MB)</label>
                        {contractFile ? (
                            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-green-200 bg-green-50 px-4 py-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                <span className="text-sm text-green-800 font-medium flex-1 truncate">{contractFileName}</span>
                                <button type="button" onClick={() => { setContractFile(null); setContractFileName("") }} className="text-red-500 hover:text-red-700 flex-shrink-0">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <label className="flex items-center gap-3 cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] px-4 py-5 hover:border-[var(--brand)] transition-colors">
                                <Upload className="h-5 w-5 text-[var(--text-muted)]" />
                                <span className="text-sm text-[var(--text-muted)]">Click to upload PDF or image</span>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleContractFile(e.target.files?.[0] || null)} />
                            </label>
                        )}
                    </div>
                </div>

                {/* ── Additional Attachments ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Additional Attachments</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Upload Files (PDF, Word, Images)</label>
                            <input
                                ref={fileRef}
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={handleFileAdd}
                                className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[var(--brand)] file:text-white hover:file:opacity-90 cursor-pointer border border-[var(--border)] rounded-[var(--radius-md)] px-2 py-1.5"
                            />
                            <p className="mt-1 text-xs text-[var(--text-muted)]">You can select multiple files.</p>
                        </div>
                        {attachments.length > 0 ? (
                            <div className="space-y-2">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="truncate text-[var(--text)]">{att.name}</span>
                                            <a href={att.dataUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-xs text-[var(--brand)] hover:underline">Preview</a>
                                        </div>
                                        <button type="button" onClick={() => removeAttachment(idx)} className="flex-shrink-0 ml-3 text-[var(--text-muted)] hover:text-red-500">
                                            <X size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] italic">No attachments added yet.</p>
                        )}
                    </div>
                </div>

            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t border-[var(--border)]">
                <Link href={`/clients/${clientId}?tab=branches`} className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button type="submit" disabled={loading} className="ui-btn ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Save className="h-4 w-4" />
                    {loading ? "Creating..." : "Create Branch"}
                </button>
            </div>
        </form>
    )
}
