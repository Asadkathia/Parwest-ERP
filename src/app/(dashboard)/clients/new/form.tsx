"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Plus, X, Upload, CheckCircle2, ExternalLink, Paperclip } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import SearchSelect from "@/components/ui/SearchSelect"
import LocationPickerMap from "@/components/ui/LocationPickerMap"

// Client types loaded dynamically from DB (see useEffect below)

const CITY_OPTIONS = [
    "All Cities","Lahore","Gujranwala","Sahiwal","Islamabad","Karachi","Multan","Faisalabad",
    "Khanpur","Chichawatni","Bahawalpur","Mian Channu","Khanewal","Ahmedpur East",
    "Ahmed Nager Chatha","Ali Pur","Arifwala","Attock","Basti Malook","Bhagalchur",
    "Bhalwal","Bahawalnagar","Bhaipheru","Bhakkar","Burewala","Chailianwala","Chakwal",
    "Chiniot","Chowk Azam","Chowk Sarwar Shaheed","Daska",
].map((c) => ({ value: c, label: c }))

const PROVINCE_OPTIONS = [
    { value: "Punjab", label: "Punjab" },
    { value: "Sindh", label: "Sindh" },
    { value: "KPK", label: "KPK" },
    { value: "Balochistan", label: "Balochistan" },
    { value: "All Pakistan", label: "All Pakistan" },
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

type Region = {
    id: string
    name: string
}

type Props = {
    regions: Region[]
    initialBranchless?: boolean
}

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(file)
    })
}

export default function ClientEnrollmentForm({ regions, initialBranchless = true }: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [isBranchless, setIsBranchless] = useState(initialBranchless)
    const [introducerAddress, setIntroducerAddress] = useState("")
    const [defaultBranchName, setDefaultBranchName] = useState("")
    const [contactNumbers, setContactNumbers] = useState<string[]>([""])
    const [supervisorUsers, setSupervisorUsers] = useState<{ id: string; name: string }[]>([])
    const [managerUsers, setManagerUsers] = useState<{ id: string; name: string }[]>([])
    const [contractFile, setContractFile] = useState<string | null>(null)
    const [contractFileName, setContractFileName] = useState("")
    const [attachments, setAttachments] = useState<{ name: string; dataUrl: string }[]>([])
    const attachFileRef = useRef<HTMLInputElement>(null)
    const [savedClient, setSavedClient] = useState<{ id: string; name: string; branchCreated: boolean } | null>(null)
    const [clientTypes, setClientTypes] = useState<{ value: string; label: string }[]>([])
    const [latManual, setLatManual] = useState("")
    const [lngManual, setLngManual] = useState("")

    useEffect(() => {
        fetch("/api/client-types")
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setClientTypes(
                        (data as { name: string; label: string }[]).map((t) => ({ value: t.name, label: t.label }))
                    )
                }
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        fetch("/api/users?limit=500")
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    const users = data as { id: string; name?: string | null; role?: { name?: string | null } }[]
                    const toOption = (u: typeof users[0]) => ({ id: u.id, name: u.name as string })
                    setSupervisorUsers(
                        users.filter((u) => u.name && u.role?.name?.toLowerCase() === "supervisor").map(toOption)
                    )
                    setManagerUsers(
                        users.filter((u) => u.name && u.role?.name?.toLowerCase() === "manager").map(toOption)
                    )
                }
            })
            .catch(() => {})
    }, [])

    const applyOcrFields = (fields: Record<string, string>) => {
        const form = formRef.current
        if (!form) return
        Object.entries(fields).forEach(([name, value]) => {
            const input = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
            if (input) input.value = value
        })
    }

    const handleAttachmentAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        files.forEach((file) => {
            const reader = new FileReader()
            reader.onload = () =>
                setAttachments((prev) => [...prev, { name: file.name, dataUrl: reader.result as string }])
            reader.readAsDataURL(file)
        })
        if (attachFileRef.current) attachFileRef.current.value = ""
    }

    const removeAttachment = (idx: number) =>
        setAttachments((prev) => prev.filter((_, i) => i !== idx))

    const handleContractFile = async (file: File | null) => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            setError("Contract file must be under 5 MB")
            return
        }
        const base64 = await readFileAsBase64(file)
        setContractFile(base64)
        setContractFileName(file.name)
    }

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const filled = contactNumbers.filter((n) => n.trim())
        const data = {
            ...Object.fromEntries(formData.entries()),
            isBranchless,
            contactNumber: filled[0] ?? "",
            contactNumbers: filled,
            ...(contractFile ? { contractUrl: contractFile } : {}),
            contractAttachments: attachments,
        }

        try {
            const response = await fetch("/api/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.message || "Failed to create client")
            }

            const created = await response.json()

            if (!isBranchless) {
                const branchCreated = Array.isArray(created.branches) && created.branches.length > 0
                setSavedClient({ id: created.id, name: created.name, branchCreated })
            } else {
                router.push("/clients")
                router.refresh()
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to create client")
            setLoading(false)
        }
    }

    // ── Success state (branch client only) ──────────────────────────────────
    if (savedClient) {
        return (
            <div className="ui-card p-8 flex flex-col items-center gap-6 text-center">
                <CheckCircle2 className="h-14 w-14 text-green-500" />
                <div>
                    <h2 className="text-xl font-semibold text-[var(--text)]">{savedClient.name} saved!</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        {savedClient.branchCreated
                            ? "Branch client created with its first branch. You can add more branches anytime."
                            : "Branch client created. No branch was added yet — you can add one now or later."}
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <Link href={`/clients/${savedClient.id}`} className="ui-btn ui-btn-primary inline-flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        View Client
                    </Link>
                    <Link href={`/clients/${savedClient.id}/branches/new`} className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        {savedClient.branchCreated ? "Add Another Branch" : "Add a Branch"}
                    </Link>
                    <Link href="/clients/new" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
                        Add Another Client
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="ui-card p-6">
            {error && (
                <div className="mb-6 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="mb-6">
                <OcrUploadPanel target="client" onApply={applyOcrFields} />
            </div>

            <div className="space-y-8">
                {/* Basic Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Client&apos;s Name <span className="text-red-500">*</span>
                            </label>
                            <input type="text" name="name" required className="ui-input" placeholder="Enter client name" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Client Type <span className="text-red-500">*</span>
                            </label>
                            <SearchSelect
                                name="type"
                                options={clientTypes}
                                placeholder={clientTypes.length === 0 ? "Loading types…" : "Select client type"}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Client&apos;s Email *
                            </label>
                            <input type="email" name="email" required className="ui-input" placeholder="Client's Email" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Enrollment Date* (Please Enter Correct Enrollment Date For Accurate Reporting)
                            </label>
                            <input
                                type="date"
                                name="enrollmentDate"
                                required
                                className="ui-input"
                                defaultValue={new Date().toISOString().slice(0, 10)}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Client Add Mode</label>
                            <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => { setIsBranchless(false); setLatManual(""); setLngManual("") }}
                                    className={`px-4 py-2 text-sm font-medium transition-colors ${!isBranchless ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"}`}
                                >
                                    Branch Client
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsBranchless(true); setLatManual(""); setLngManual("") }}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-l border-[var(--border)] ${isBranchless ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"}`}
                                >
                                    Branchless Client
                                </button>
                            </div>
                            <input type="hidden" name="isBranchless" value={isBranchless ? "true" : "false"} />
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Person *</label>
                            <input type="text" name="contactPerson" required className="ui-input" placeholder="Contact person" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number *</label>
                            <div className="space-y-2">
                                {contactNumbers.map((num, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={num}
                                            required={idx === 0}
                                            onChange={(e) => {
                                                const updated = [...contactNumbers]
                                                updated[idx] = e.target.value
                                                setContactNumbers(updated)
                                            }}
                                            className="ui-input flex-1"
                                            placeholder={idx === 0 ? "Primary contact number" : `Contact number ${idx + 1}`}
                                        />
                                        {contactNumbers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setContactNumbers(contactNumbers.filter((_, i) => i !== idx))}
                                                className="flex-shrink-0 text-[var(--text-muted)] hover:text-red-500"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setContactNumbers([...contactNumbers, ""])}
                                    className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline mt-1"
                                >
                                    <Plus size={13} /> Add another number
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Client Location</label>
                            <SearchSelect name="clientLocation" options={CITY_OPTIONS} placeholder="Select city" defaultValue="Lahore" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Client&apos;s Postal Code</label>
                            <input type="text" name="clientPostalCode" className="ui-input" placeholder="Postal code" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Head Office Address *</label>
                            <textarea name="headOfficeAddress" required rows={2} className="ui-textarea" placeholder="Head Office Address" />
                        </div>
                    </div>
                </div>

                {/* Introducer/Referral */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Introducer/Referral</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
                            <input type="text" name="introducerName" className="ui-input" placeholder="Name" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number</label>
                            <input type="text" name="introducerContactNumber" className="ui-input" placeholder="Contact number" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Address</label>
                            <input
                                type="text"
                                name="introducer_address"
                                className="ui-input"
                                placeholder="Address"
                                value={introducerAddress}
                                onChange={(e) => setIntroducerAddress(e.target.value)}
                            />
                            <input type="hidden" name="introducerAddress" value={introducerAddress} />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">CNIC Number</label>
                            <input type="text" name="introducerCnicNumber" className="ui-input" placeholder="CNIC number" />
                        </div>
                    </div>
                </div>

                {/* Operational Territory */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Operational Territory</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Operational Provinces</label>
                            <SearchSelect name="operationalProvinces" options={PROVINCE_OPTIONS} placeholder="Select Operational Territory" />
                        </div>
                    </div>
                </div>

                {/* Supervisor & Manager Assignment */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Supervisor &amp; Manager Assignment</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Supervisor</label>
                            <SearchSelect
                                name="assignedSupervisorId"
                                options={supervisorUsers.map((u) => ({ value: u.id, label: u.name }))}
                                placeholder="— Select Supervisor —"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Manager</label>
                            <SearchSelect
                                name="assignedManagerId"
                                options={managerUsers.map((u) => ({ value: u.id, label: u.name }))}
                                placeholder="— Select Manager —"
                            />
                        </div>
                    </div>
                </div>

                {/* ── BRANCHLESS: Location Information ── */}
                {isBranchless && (
                    <div className="space-y-6">
                        <h2 className="text-base font-semibold pb-2 border-b border-[var(--border)] text-[var(--text)]">Branchless Location Information</h2>

                        {/* Regional Office ABOVE the map so its dropdown is never hidden */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Regional Office</label>
                                <SearchSelect
                                    name="locationRegionalOffice"
                                    options={regions.map((r) => ({ value: r.id, label: r.name }))}
                                    placeholder="— Select Regional Office —"
                                />
                            </div>
                        </div>

                        {/* Map picker */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--text)] mb-2">
                                Pick Location on Map
                                <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">(search or click to drop marker — or type coordinates manually below)</span>
                            </label>
                            <LocationPickerMap
                                latName="latitude"
                                lngName="longitude"
                                label="Location"
                                onLocationChange={(lat, lng) => { setLatManual(lat); setLngManual(lng) }}
                            />
                        </div>

                        {/* Manual coordinate override + capacities */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Latitude <span className="text-xs">(manual)</span></label>
                                <input type="text" name="latitudeManual" className="ui-input" placeholder="e.g. 31.5204" value={latManual} onChange={(e) => setLatManual(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Longitude <span className="text-xs">(manual)</span></label>
                                <input type="text" name="longitudeManual" className="ui-input" placeholder="e.g. 74.3587" value={lngManual} onChange={(e) => setLngManual(e.target.value)} />
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
                )}

                {/* ── BRANCH CLIENT: Default Branch ── */}
                {!isBranchless && (
                    <div>
                        <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Default Branch</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Default Branch Name</label>
                                <input
                                    type="text"
                                    name="default_branch_name"
                                    className="ui-input"
                                    placeholder="Default Branch Name"
                                    value={defaultBranchName}
                                    onChange={(e) => setDefaultBranchName(e.target.value)}
                                />
                                <input type="hidden" name="defaultBranchName" value={defaultBranchName} />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Branch Model</label>
                                <SearchSelect
                                    name="branchType"
                                    options={[
                                        { value: "CONVENTIONAL", label: "Conventional" },
                                        { value: "ISLAMIC", label: "Islamic" },
                                    ]}
                                    defaultValue="CONVENTIONAL"
                                    placeholder="Select model"
                                />
                            </div>
                        </div>
                    </div>
                )}
                {isBranchless && <input type="hidden" name="default_branch_name" value="" />}

                {/* ── BRANCH CLIENT: Branch Information ── */}
                {!isBranchless && (
                    <div className="space-y-6">
                        <h2 className="text-base font-semibold pb-2 border-b border-[var(--border)] text-[var(--text)]">Branch Information</h2>

                        {/* Regional Office ABOVE the map */}
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Regional Office</label>
                            <SearchSelect
                                name="locationRegionalOffice"
                                options={regions.map((r) => ({ value: r.id, label: r.name }))}
                                placeholder="— Select Regional Office —"
                            />
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

                        {/* Manual coordinate override + capacities */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Latitude <span className="text-xs">(manual)</span></label>
                                <input type="text" name="latitudeManual" className="ui-input" placeholder="e.g. 31.5204" value={latManual} onChange={(e) => setLatManual(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Longitude <span className="text-xs">(manual)</span></label>
                                <input type="text" name="longitudeManual" className="ui-input" placeholder="e.g. 74.3587" value={lngManual} onChange={(e) => setLngManual(e.target.value)} />
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
                )}

                {/* ── BRANCHLESS: Contract ── */}
                {isBranchless && (
                    <div>
                        <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Branchless Client Contract</h2>
                        <ContractFields regions={regions} prefix="" />
                    </div>
                )}

                {/* ── BRANCH CLIENT: Branch Contract ── */}
                {!isBranchless && (
                    <div>
                        <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Branch Client Contract</h2>
                        <ContractFields regions={regions} prefix="" />
                    </div>
                )}

                {/* ── CONTRACT PDF ATTACHMENT (both modes) ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contract Attachment</h2>
                    <label className="block text-sm text-[var(--text-muted)] mb-2">Upload Client Contract (PDF / Image, max 5 MB)</label>
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

                {/* ── ADDITIONAL ATTACHMENTS (both modes) ── */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Additional Attachments</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Upload Files (PDF, Word, Images)</label>
                            <input
                                ref={attachFileRef}
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={handleAttachmentAdd}
                                className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[var(--brand)] file:text-white hover:file:opacity-90 cursor-pointer border border-[var(--border)] rounded-[var(--radius-md)] px-2 py-1.5"
                            />
                            <p className="mt-1 text-xs text-[var(--text-muted)]">You can select multiple files.</p>
                        </div>
                        {attachments.length > 0 ? (
                            <div className="space-y-2">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Paperclip size={13} className="flex-shrink-0 text-[var(--text-muted)]" />
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
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link href="/clients" className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="ui-btn ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "Saving..." : "Save Client"}
                </button>
            </div>
        </form>
    )
}

// ── Shared contract fields component ────────────────────────────────────────
function ContractFields({ regions, prefix }: { regions: Region[]; prefix: string }) {
    const n = (name: string) => prefix ? `${prefix}_${name}` : name
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Start</label>
                <input type="date" name={n("contractStart")} className="ui-input" />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Contract End</label>
                <input type="date" name={n("contractEnd")} className="ui-input" />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Rate Start</label>
                <input type="date" name={n("contractRateStart")} className="ui-input" />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Rate End</label>
                <input type="date" name={n("contractRateEnd")} className="ui-input" />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Regional Office</label>
                <SearchSelect
                    name={n("contractRegionalOffice")}
                    options={regions.map((r) => ({ value: r.id, label: r.name }))}
                    placeholder="— Select Regional Office —"
                />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Designation</label>
                <SearchSelect
                    name={n("contractGuardDesignation")}
                    options={DESIGNATION_OPTIONS}
                    placeholder="Select designation"
                />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Additional Guards</label>
                <input type="number" name={n("contractAdditionalGuards")} className="ui-input" placeholder="0" min={0} />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Ex Service</label>
                <SearchSelect
                    name={n("contractGuardExService")}
                    options={EX_SERVICE_OPTIONS}
                    placeholder="Select"
                />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Price</label>
                <input type="number" name={n("contractPrice")} className="ui-input" placeholder="Price" />
            </div>
        </div>
    )
}
