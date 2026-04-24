"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Plus, X, Upload, CheckCircle2, ExternalLink, Paperclip } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import SearchSelect from "@/components/ui/SearchSelect"
import MultiSearchSelect from "@/components/ui/MultiSearchSelect"
import LocationPickerMap from "@/components/ui/LocationPickerMap"
import CnicInput from "@/components/ui/CnicInput"
import PhoneInput from "@/components/ui/PhoneInput"
import { isValidCnic, isValidPhone } from "@/lib/validation/formats"

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

// These are now loaded dynamically from /api/guard-designation-types and /api/guard-ex-service-types

type Region = {
    id: string
    name: string
}

type Props = {
    regions: Region[]
    initialBranchless?: boolean
    isSuperAdmin?: boolean
}

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(file)
    })
}

export default function ClientEnrollmentForm({ regions, initialBranchless = true, isSuperAdmin = false }: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [isBranchless, setIsBranchless] = useState(initialBranchless)
    const [selectedProvince, setSelectedProvince] = useState("")
    const [introducerAddress, setIntroducerAddress] = useState("")
    const [defaultBranchName, setDefaultBranchName] = useState("")
    const [contactNumbers, setContactNumbers] = useState<string[]>([""])
    const [supervisorUsers, setSupervisorUsers] = useState<{ id: string; name: string }[]>([])
    const [managerUsers, setManagerUsers] = useState<{ id: string; name: string }[]>([])
    const [selectedRegionId, setSelectedRegionId] = useState("")
    const [selectedRegionalOfficeId, setSelectedRegionalOfficeId] = useState("")
    const [regionalOffices, setRegionalOffices] = useState<{ id: string; name: string }[]>([])
    const [contractFile, setContractFile] = useState<string | null>(null)
    const [contractFileName, setContractFileName] = useState("")
    const [attachments, setAttachments] = useState<{ name: string; dataUrl: string }[]>([])
    const attachFileRef = useRef<HTMLInputElement>(null)
    const [savedClient, setSavedClient] = useState<{ id: string; name: string; branchCreated: boolean } | null>(null)
    const [clientTypes, setClientTypes] = useState<{ value: string; label: string }[]>([])
    const [, setLatManual] = useState("")
    const [, setLngManual] = useState("")

    // Branch-specific state (branch section in branch-client mode)
    const [branchRegionId, setBranchRegionId] = useState("")
    const [branchRegionalOfficeId, setBranchRegionalOfficeId] = useState("")
    const [branchRegionalOffices, setBranchRegionalOffices] = useState<{ id: string; name: string }[]>([])
    const [branchManagerUsers, setBranchManagerUsers] = useState<{ id: string; name: string }[]>([])
    const [branchSupervisorUsers, setBranchSupervisorUsers] = useState<{ id: string; name: string }[]>([])
    const [branchIsLockerBranch, setBranchIsLockerBranch] = useState<"yes" | "no">("no")
    const [branchContactPhones, setBranchContactPhones] = useState<string[]>([""])
    const [branchOperationsManagerId, setBranchOperationsManagerId] = useState("")
    const [branchLatManual, setBranchLatManual] = useState("")
    const [branchLngManual, setBranchLngManual] = useState("")
    const [designationOptions, setDesignationOptions] = useState<{ value: string; label: string }[]>([])
    const [exServiceOptions, setExServiceOptions] = useState<{ value: string; label: string }[]>([])

    useEffect(() => {
        fetch("/api/guard-designation-types")
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setDesignationOptions((data as { name: string }[]).map((d) => ({ value: d.name, label: d.name })))
                }
            })
            .catch(() => {})
        fetch("/api/guard-ex-service-types")
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setExServiceOptions((data as { name: string }[]).map((d) => ({ value: d.name, label: d.name })))
                }
            })
            .catch(() => {})
    }, [])

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

    // Load managers/supervisors — filtered by region when selected
    useEffect(() => {
        const url = selectedRegionId
            ? `/api/users?limit=500&regionId=${selectedRegionId}`
            : "/api/users?limit=500"
        fetch(url)
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
    }, [selectedRegionId])

    // Load regional offices when region changes
    useEffect(() => {
        setSelectedRegionalOfficeId("")
        setRegionalOffices([])
        if (!selectedRegionId) return
        fetch(`/api/regional-offices?regionId=${selectedRegionId}`)
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setRegionalOffices((data as { id: string; name: string }[]).map((o) => ({ id: o.id, name: o.name })))
                }
            })
            .catch(() => {})
    }, [selectedRegionId])

    // Branch region → branch regional offices
    useEffect(() => {
        setBranchRegionalOfficeId("")
        setBranchRegionalOffices([])
        if (!branchRegionId) return
        fetch(`/api/regional-offices?regionId=${branchRegionId}`)
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setBranchRegionalOffices((data as { id: string; name: string }[]).map((o) => ({ id: o.id, name: o.name })))
                }
            })
            .catch(() => {})
    }, [branchRegionId])

    // Branch region → branch managers/supervisors
    useEffect(() => {
        const url = branchRegionId
            ? `/api/users?limit=500&regionId=${branchRegionId}`
            : "/api/users?limit=500"
        fetch(url)
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    const users = data as { id: string; name?: string | null; role?: { name?: string | null } }[]
                    const toOption = (u: typeof users[0]) => ({ id: u.id, name: u.name as string })
                    setBranchManagerUsers(users.filter((u) => u.name && u.role?.name?.toLowerCase() === "manager").map(toOption))
                    setBranchSupervisorUsers(users.filter((u) => u.name && u.role?.name?.toLowerCase() === "supervisor").map(toOption))
                }
            })
            .catch(() => {})
    }, [branchRegionId])

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
        const branchFilled = branchContactPhones.filter((n) => n.trim())

        // CNIC validation
        const cnicFields: [string, string][] = [
            ["Introducer CNIC", String(formData.get("introducerCnicNumber") ?? "").trim()],
            ["Branch Contact Person CNIC", String(formData.get("branchContactPersonCnic") ?? "").trim()],
        ]
        for (const [label, val] of cnicFields) {
            if (val && !isValidCnic(val)) {
                setError(`${label} format is invalid. Expected XXXXX-XXXXXXX-X.`)
                setLoading(false)
                return
            }
        }

        // Phone validation — visible inline fields.
        // PhoneInput pre-fills "+92-" into its form value, so an untouched
        // optional field submits as the bare prefix. Treat prefix-only as empty.
        const normalizePhone = (raw: string) => {
            const v = raw.trim()
            return v === "+92-" ? "" : v
        }
        const phoneFields: [string, string][] = [
            ["Introducer Contact Number", normalizePhone(String(formData.get("introducerContactNumber") ?? ""))],
            ["Branch Manager Contact", normalizePhone(String(formData.get("branchManagerContact") ?? ""))],
            ["Branch Operations Manager Contact", normalizePhone(String(formData.get("branchOperationsManagerContact") ?? ""))],
            ["Branch Supervisor Contact", normalizePhone(String(formData.get("branchSupervisorContact") ?? ""))],
        ]
        for (const [label, val] of phoneFields) {
            if (val && !isValidPhone(val)) {
                setError(`${label} must be in format +92-XXX-XXXXXXX.`)
                setLoading(false)
                return
            }
        }

        // Primary contact number required + format
        const primary = filled[0] ?? ""
        if (!primary) {
            setError("Primary contact number is required.")
            setLoading(false)
            return
        }
        for (const num of filled) {
            if (!isValidPhone(num)) {
                setError(`Contact number "${num}" must be in format +92-XXX-XXXXXXX.`)
                setLoading(false)
                return
            }
        }
        for (const num of branchFilled) {
            if (!isValidPhone(num)) {
                setError(`Branch phone "${num}" must be in format +92-XXX-XXXXXXX.`)
                setLoading(false)
                return
            }
        }

        // Contract file requires contract start + end dates
        if (contractFile) {
            const cStart = String(formData.get("contractStart") ?? "").trim()
            const cEnd = String(formData.get("contractEnd") ?? "").trim()
            if (!cStart || !cEnd) {
                setError("Contract start and end dates are required when uploading a contract.")
                setLoading(false)
                return
            }
            if (new Date(cEnd).getTime() <= new Date(cStart).getTime()) {
                setError("Contract end date must be after the contract start date.")
                setLoading(false)
                return
            }
        }

        const data = {
            ...Object.fromEntries(formData.entries()),
            isBranchless,
            contactNumber: filled[0] ?? "",
            contactNumbers: filled,
            ...(contractFile ? { contractUrl: contractFile } : {}),
            contractAttachments: attachments,
            // Branch-specific state values
            branchIsLockerBranch,
            branchContactPhone: branchFilled[0] ?? "",
            branchOperationsManagerId: branchOperationsManagerId || null,
            branchRegionId: branchRegionId || null,
            branchRegionalOfficeId: branchRegionalOfficeId || null,
            branchLatitude: branchLatManual || null,
            branchLongitude: branchLngManual || null,
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
                                Enrollment Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                name="enrollmentDate"
                                required
                                className={`ui-input ${!isSuperAdmin ? "bg-[var(--surface-muted)] cursor-not-allowed" : ""}`}
                                defaultValue={new Date().toISOString().slice(0, 10)}
                                readOnly={!isSuperAdmin}
                            />
                            {!isSuperAdmin && (
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Auto-set to today. Only Super Admin can override.</p>
                            )}
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
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Person Designation</label>
                            <input type="text" name="contactPersonDesignation" className="ui-input" placeholder="e.g., Manager, Director, Officer" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number *</label>
                            <div className="space-y-2">
                                {contactNumbers.map((num, idx) => {
                                    const invalid = num.trim().length > 0 && !isValidPhone(num.trim())
                                    return (
                                    <div key={idx} className="flex items-start gap-2">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={num}
                                                required={idx === 0}
                                                onChange={(e) => {
                                                    const updated = [...contactNumbers]
                                                    updated[idx] = e.target.value
                                                    setContactNumbers(updated)
                                                }}
                                                className={`ui-input w-full ${invalid ? "border-red-400 focus:ring-red-300" : ""}`}
                                                placeholder={idx === 0 ? "+92-300-1234567" : `Contact number ${idx + 1}`}
                                            />
                                            {invalid && (
                                                <p className="mt-1 text-[11px] text-red-500">Format must be +92-300-1234567</p>
                                            )}
                                        </div>
                                        {contactNumbers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setContactNumbers(contactNumbers.filter((_, i) => i !== idx))}
                                                className="flex-shrink-0 mt-2 text-[var(--text-muted)] hover:text-red-500"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                    )
                                })}
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
                            <PhoneInput name="introducerContactNumber" />
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
                            <CnicInput name="introducerCnicNumber" placeholder="CNIC number" />
                        </div>
                    </div>
                </div>

                {/* Operational Territory */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Operational Territory</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Operational Provinces</label>
                            <SearchSelect name="operationalProvinces" options={PROVINCE_OPTIONS} placeholder="Select Operational Territory" onChange={(val) => setSelectedProvince(val)} />
                        </div>
                    </div>
                </div>

                {/* Region / Regional Office + Manager & Supervisor Assignment */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Region &amp; Assignment</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {!selectedProvince && (
                            <p className="md:col-span-2 text-sm text-[var(--text-muted)] bg-amber-50 rounded-[var(--radius-md)] px-4 py-3 border border-amber-200">
                                Select an Operational Territory above before assigning a region.
                            </p>
                        )}
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Region</label>
                            <select
                                name="regionId"
                                className="ui-input disabled:opacity-50 disabled:cursor-not-allowed"
                                value={selectedRegionId}
                                onChange={(e) => setSelectedRegionId(e.target.value)}
                                disabled={!selectedProvince}
                            >
                                <option value="">— Select Region —</option>
                                {regions.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Regional Office</label>
                            <select
                                name="regionalOfficeId"
                                className="ui-input"
                                value={selectedRegionalOfficeId}
                                onChange={(e) => setSelectedRegionalOfficeId(e.target.value)}
                                disabled={!selectedRegionId}
                            >
                                <option value="">
                                    {!selectedRegionId ? "— Select Region First —" : regionalOffices.length === 0 ? "No offices in this region" : "— Select Regional Office —"}
                                </option>
                                {regionalOffices.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Manager & Supervisor — only for branchless clients */}
                        {isBranchless && (
                            <>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Manager</label>
                                    <SearchSelect
                                        name="assignedManagerId"
                                        options={managerUsers.map((u) => ({ value: u.id, label: u.name }))}
                                        placeholder={selectedRegionId ? "— Select Manager —" : "— Select Region First —"}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Supervisor</label>
                                    <SearchSelect
                                        name="assignedSupervisorId"
                                        options={supervisorUsers.map((u) => ({ value: u.id, label: u.name }))}
                                        placeholder={selectedRegionId ? "— Select Supervisor —" : "— Select Region First —"}
                                    />
                                </div>
                            </>
                        )}

                        {!isBranchless && (
                            <p className="md:col-span-2 text-sm text-[var(--text-muted)] bg-[var(--surface-muted)] rounded-[var(--radius-md)] px-4 py-3 border border-[var(--border)]">
                                Manager and supervisor will be assigned per branch. Use the branch form below or the branch wizard after saving.
                            </p>
                        )}
                    </div>
                </div>

                {/* ── DEFAULT BRANCH (branchless clients only) ── */}
                <input type="hidden" name="defaultBranchName" value={isBranchless ? "__branchless_default__" : defaultBranchName} />
                {isBranchless && <div className="space-y-8">
                        <h2 className="text-base font-semibold pb-2 border-b border-[var(--border)] text-[var(--text)]">
                            {isBranchless ? "Client Location & Capacity (Default Branch)" : "Add Client's New Branch"}
                        </h2>

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">
                                    Name Of Branch <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="default_branch_name"
                                    className="ui-input"
                                    placeholder="e.g., Main Branch, Gulberg Branch"
                                    value={defaultBranchName}
                                    onChange={(e) => setDefaultBranchName(e.target.value)}
                                />
                                <input type="hidden" name="defaultBranchName" value={defaultBranchName} />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Branch Code</label>
                                <input type="text" name="branchCode" placeholder="e.g., LHR-001" className="ui-input" />
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

                        {/* Location: Map + Lat/Lng */}
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-[var(--text)]">
                                Pick Branch Location on Map
                                <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">(click to drop marker — or type coordinates manually)</span>
                            </label>
                            <LocationPickerMap
                                latName="branchLatitudeHidden"
                                lngName="branchLongitudeHidden"
                                label="Branch"
                                onLocationChange={(lat, lng) => { setBranchLatManual(lat); setBranchLngManual(lng) }}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">
                                        Latitude <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" name="branchLatitudeManual" className="ui-input" placeholder="e.g. 31.5204" value={branchLatManual} onChange={(e) => setBranchLatManual(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">
                                        Longitude <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" name="branchLongitudeManual" className="ui-input" placeholder="e.g. 74.3587" value={branchLngManual} onChange={(e) => setBranchLngManual(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Branch Region / Office / City */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Region</label>
                                <select className="ui-input" value={branchRegionId} onChange={(e) => setBranchRegionId(e.target.value)}>
                                    <option value="">— Select Region —</option>
                                    {regions.map((r) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Regional Office</label>
                                <select
                                    name="branchRegionalOfficeId"
                                    className="ui-input"
                                    value={branchRegionalOfficeId}
                                    onChange={(e) => setBranchRegionalOfficeId(e.target.value)}
                                    disabled={!branchRegionId}
                                >
                                    <option value="">
                                        {!branchRegionId ? "— Select Region First —" : branchRegionalOffices.length === 0 ? "No offices" : "— Select Office —"}
                                    </option>
                                    {branchRegionalOffices.map((o) => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Select City</label>
                                <SearchSelect name="branchCity" options={CITY_OPTIONS} placeholder="— Select City —" />
                            </div>
                        </div>

                        {/* Capacity */}
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Capacity Requirements</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <BCapField label="Day CPO's Required" name="branchDayCpoCapacity" />
                                <BCapField label="Night CPO's Required" name="branchNightCpoCapacity" />
                                <BCapField label="Day SO Capacity" name="branchDaySoCapacity" />
                                <BCapField label="Night SO Capacity" name="branchNightSoCapacity" />
                                <BCapField label="Day ASO Capacity" name="branchDayAsoCapacity" />
                                <BCapField label="Night ASO Capacity" name="branchNightAsoCapacity" />
                                <BCapField label="Day LSO Capacity" name="branchDayLsoCapacity" />
                                <BCapField label="Night LSO Capacity" name="branchNightLsoCapacity" />
                                <BCapField label="Day Supervisors Required" name="branchDaySupervisorCapacity" />
                                <BCapField label="Night Supervisors Required" name="branchNightSupervisorCapacity" />
                                <BCapField label="Day Guards" name="branchDayGuardCapacity" />
                                <BCapField label="Night Guards" name="branchNightGuardCapacity" />
                                <BCapField label="Day CCTV Operators" name="branchDayCctvCapacity" />
                                <BCapField label="Night CCTV Operators" name="branchNightCctvCapacity" />
                                <BCapField label="Day Receptionists" name="branchDayReceptionistCapacity" />
                                <BCapField label="Night Receptionists" name="branchNightReceptionistCapacity" />
                            </div>
                        </div>

                        {/* Enrollment Date + Locker Branch */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">
                                    Branch Enrollment Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="branchEnrollmentDate"
                                    className={`ui-input ${!isSuperAdmin ? "bg-[var(--surface-muted)] cursor-not-allowed" : ""}`}
                                    defaultValue={new Date().toISOString().slice(0, 10)}
                                    readOnly={!isSuperAdmin}
                                />
                                {!isSuperAdmin && (
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">Auto-set to today. Only Super Admin can override.</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-2">
                                    Locker Branch <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="branchIsLockerBranchRadio" value="yes" checked={branchIsLockerBranch === "yes"} onChange={() => setBranchIsLockerBranch("yes")} className="h-4 w-4 accent-[var(--brand)]" />
                                        <span className="text-sm text-[var(--text)]">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="branchIsLockerBranchRadio" value="no" checked={branchIsLockerBranch === "no"} onChange={() => setBranchIsLockerBranch("no")} className="h-4 w-4 accent-[var(--brand)]" />
                                        <span className="text-sm text-[var(--text)]">No</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Contact Person Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--text)] mb-3 pb-1 border-b border-[var(--border)]">Contact Person Info</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
                                    <input type="text" name="branchContactPerson" placeholder="Contact person name" className="ui-input" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Designation</label>
                                    <input type="text" name="branchContactPersonDesignation" placeholder="e.g., Branch Manager" className="ui-input" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">CNIC #</label>
                                    <CnicInput name="branchContactPersonCnic" placeholder="#####-#######-#" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Phone Number</label>
                                    <div className="space-y-2">
                                        {branchContactPhones.map((num, idx) => {
                                            const invalid = num.trim().length > 0 && !isValidPhone(num.trim())
                                            return (
                                            <div key={idx} className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <input
                                                        type="tel"
                                                        value={num}
                                                        onChange={(e) => {
                                                            const updated = [...branchContactPhones]
                                                            updated[idx] = e.target.value
                                                            setBranchContactPhones(updated)
                                                        }}
                                                        className={`ui-input w-full ${invalid ? "border-red-400 focus:ring-red-300" : ""}`}
                                                        placeholder={idx === 0 ? "+92-300-1234567" : `Phone ${idx + 1}`}
                                                    />
                                                    {invalid && (
                                                        <p className="mt-1 text-[11px] text-red-500">Format must be +92-300-1234567</p>
                                                    )}
                                                </div>
                                                {branchContactPhones.length > 1 && (
                                                    <button type="button" onClick={() => setBranchContactPhones(branchContactPhones.filter((_, i) => i !== idx))} className="flex-shrink-0 mt-2 text-[var(--text-muted)] hover:text-red-500">
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            )
                                        })}
                                        <button type="button" onClick={() => setBranchContactPhones([...branchContactPhones, ""])} className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline mt-1">
                                            <Plus size={13} /> Add another number
                                        </button>
                                    </div>
                                    {branchContactPhones.filter(p => p.trim()).map((p, idx) => (
                                        <input key={idx} type="hidden" name={idx === 0 ? "branchContactPhone" : `branchContactPhone_${idx}`} value={p} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Branch Manager's Information */}
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--text)] mb-3 pb-1 border-b border-[var(--border)]">Branch Manager&apos;s Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
                                    <input type="text" name="branchManagerName" placeholder="Manager's full name" className="ui-input" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number</label>
                                    <PhoneInput name="branchManagerContact" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Email</label>
                                    <input type="email" name="branchManagerEmail" placeholder="manager@example.com" className="ui-input" />
                                </div>
                            </div>
                        </div>

                        {/* Operations Manager & Supervisor — branchful only; branchless assigns at client level */}
                        {!isBranchless && (
                            <>
                                <div>
                                    <h3 className="text-sm font-semibold text-[var(--text)] mb-3 pb-1 border-b border-[var(--border)]">Operations Manager&apos;s Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                                Manager <span className="text-red-500">*</span>
                                            </label>
                                            <SearchSelect
                                                name="_branchOpsManagerSelect"
                                                options={branchManagerUsers.map((u) => ({ value: u.id, label: u.name }))}
                                                placeholder={branchRegionId ? "— Select Manager —" : "— Select Region First —"}
                                                onChange={(val) => setBranchOperationsManagerId(val)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                                Manager Contact Number
                                            </label>
                                            <PhoneInput name="branchOperationsManagerContact" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold text-[var(--text)] mb-3 pb-1 border-b border-[var(--border)]">Supervisor&apos;s Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                                Supervisor <span className="text-red-500">*</span>
                                            </label>
                                            <SearchSelect
                                                name="branchAssignedSupervisorId"
                                                options={branchSupervisorUsers.map((u) => ({ value: u.id, label: u.name }))}
                                                placeholder={branchRegionId ? "— Select Supervisor —" : "— Select Region First —"}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                                Supervisor Contact Number
                                            </label>
                                            <PhoneInput name="branchSupervisorContact" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                    </div>}

                    {/* ── Contract (branchless only; branch clients set contract per-branch) ── */}
                    {isBranchless && (
                        <div>
                            <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">
                                Branchless Client Contract
                            </h2>
                            <ContractFields regions={regions} prefix="" designationOptions={designationOptions} exServiceOptions={exServiceOptions} />
                        </div>
                    )}

                </div>

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
function ContractFields({ regions, prefix, designationOptions, exServiceOptions }: {
    regions: Region[]
    prefix: string
    designationOptions: { value: string; label: string }[]
    exServiceOptions: { value: string; label: string }[]
}) {
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
            {/* spacer to keep grid aligned */}
            <div />

            {/* Day Guards */}
            <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-[var(--text)] mb-3 mt-1">Day Guards</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Designation</label>
                        <MultiSearchSelect name={n("contractDayGuardDesignation")} options={designationOptions} placeholder="Select designations" />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Ex Service</label>
                        <MultiSearchSelect name={n("contractDayGuardExService")} options={exServiceOptions} placeholder="Select" />
                    </div>
                </div>
            </div>

            {/* Night Guards */}
            <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-[var(--text)] mb-3 mt-1">Night Guards</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Designation</label>
                        <MultiSearchSelect name={n("contractNightGuardDesignation")} options={designationOptions} placeholder="Select designations" />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Ex Service</label>
                        <MultiSearchSelect name={n("contractNightGuardExService")} options={exServiceOptions} placeholder="Select" />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Additional Day Guards</label>
                <input type="number" name={n("contractAdditionalDayGuards")} className="ui-input" placeholder="0" min={0} />
            </div>
            <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Additional Night Guards</label>
                <input type="number" name={n("contractAdditionalNightGuards")} className="ui-input" placeholder="0" min={0} />
            </div>
        </div>
    )
}

// Helper component for branch capacity number inputs (used in Add Client branch section)
function BCapField({ label, name }: { label: string; name: string }) {
    return (
        <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
                {label} <span className="text-red-500">*</span>
            </label>
            <input type="number" name={name} className="ui-input" placeholder="0" min={0} defaultValue={0} />
        </div>
    )
}
