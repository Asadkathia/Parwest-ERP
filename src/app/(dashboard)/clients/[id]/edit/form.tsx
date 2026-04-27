"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Plus, X } from "lucide-react"
import Link from "next/link"
import OcrUploadPanel from "@/components/ocr/OcrUploadPanel"
import SearchSelect from "@/components/ui/SearchSelect"
import CnicInput from "@/components/ui/CnicInput"
import PhoneInput from "@/components/ui/PhoneInput"
import { isValidCnic, isValidPhone } from "@/lib/validation/formats"

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

type Client = {
    id: string
    name: string
    type: string
    email: string | null
    enrollmentDate: Date | string
    regionId: string | null
    regionalOfficeId: string | null
    city: string | null
    status: string
    isBranchless: boolean
    headOfficeAddress: string | null
    ntn: string | null
    strn: string | null
    contractUrl: string | null
    logoUrl: string | null
    // Contact
    contactPerson: string | null
    contactPersonDesignation: string | null
    phone: string | null
    contactNumbers: unknown
    postalCode: string | null
    // Introducer
    introducerName: string | null
    introducerContactNumber: string | null
    introducerAddress: string | null
    introducerCnic: string | null
    // Operational
    operationalProvinces: string | null
    // Assigned
    assignedManagerId: string | null
    // Contract
    contractStart: Date | string | null
    contractEnd: Date | string | null
    contractRateStart: Date | string | null
    contractRateEnd: Date | string | null
    contractDayGuardDesignation: string | null
    contractDayGuardExService: string | null
    contractNightGuardDesignation: string | null
    contractNightGuardExService: string | null
    contractAdditionalDayGuards: number | null
    contractAdditionalNightGuards: number | null
    contractPrice: number | null
    reservePct: number | null
}

type Region = { id: string; name: string }

type Props = {
    client: Client
    regions: Region[]
    currentSupervisorId?: string | null
    isSuperAdmin?: boolean
    viewerRegionId?: string | null
    viewerRegionalOfficeId?: string | null
}

function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return ""
    const date = typeof d === "string" ? new Date(d) : d
    return date.toISOString().slice(0, 10)
}

function initContactNumbers(raw: unknown): string[] {
    if (Array.isArray(raw) && raw.length > 0) return raw as string[]
    return [""]
}

export default function ClientEditForm({ client, regions, currentSupervisorId, isSuperAdmin = false, viewerRegionId = null, viewerRegionalOfficeId = null }: Props) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const isRegionalViewer = !isSuperAdmin && Boolean(viewerRegionId)
    const lockedRegionalOffice = isRegionalViewer ? viewerRegionalOfficeId : null
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Region / Regional Office (dynamic cascade)
    const [selectedRegionId, setSelectedRegionId] = useState(
        isRegionalViewer ? (viewerRegionId ?? "") : (client.regionId ?? "")
    )
    const [selectedRegionalOfficeId, setSelectedRegionalOfficeId] = useState(
        lockedRegionalOffice ?? (client.regionalOfficeId ?? "")
    )
    const [regionalOffices, setRegionalOffices] = useState<{ id: string; name: string }[]>([])

    // Manager / Supervisor (filtered by region)
    const [managerUsers, setManagerUsers] = useState<{ id: string; name: string }[]>([])
    const [supervisorUsers, setSupervisorUsers] = useState<{ id: string; name: string }[]>([])

    // Client types
    const [clientTypes, setClientTypes] = useState<{ value: string; label: string }[]>([])

    // Designation / ex-service options (dynamic — no hardcoded LEGACY fallbacks)
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

    // Contact numbers
    const [contactNumbers, setContactNumbers] = useState<string[]>(initContactNumbers(client.contactNumbers))

    // Branchless toggle
    const [isBranchless, setIsBranchless] = useState(client.isBranchless)

    // Reserve % override — stored as decimal (0..1) in DB, edited as % (0..100) in UI
    const [reservePctInput, setReservePctInput] = useState<string>(
        client.reservePct != null ? String(Math.round(client.reservePct * 10000) / 100) : ""
    )

    useEffect(() => {
        fetch("/api/client-types")
            .then((r) => r.ok ? r.json() : [])
            .then((data: unknown) => {
                if (Array.isArray(data)) {
                    setClientTypes((data as { name: string; label: string }[]).map((t) => ({ value: t.name, label: t.label })))
                }
            })
            .catch(() => {})
    }, [])

    // Load regional offices when region changes
    useEffect(() => {
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

    // Load managers/supervisors when region changes
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
                    setManagerUsers(users.filter((u) => u.name && u.role?.name?.toLowerCase() === "manager").map(toOption))
                    setSupervisorUsers(users.filter((u) => u.name && u.role?.name?.toLowerCase() === "supervisor").map(toOption))
                }
            })
            .catch(() => {})
    }, [selectedRegionId])

    const applyOcrFields = (fields: Record<string, string>) => {
        const form = formRef.current
        if (!form) return
        Object.entries(fields).forEach(([name, value]) => {
            const input = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
            if (input) input.value = value
        })
    }

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const filled = contactNumbers.filter((n) => n.trim())

        // CNIC validation
        const introCnic = String(formData.get("introducerCnicNumber") ?? "").trim()
        if (introCnic && !isValidCnic(introCnic)) {
            setError("Introducer CNIC format is invalid. Expected XXXXX-XXXXXXX-X.")
            setLoading(false)
            return
        }

        // Phone validation
        const introPhone = String(formData.get("introducerContactNumber") ?? "").trim()
        if (introPhone && !isValidPhone(introPhone)) {
            setError("Introducer contact number must be in format +92-XXX-XXXXXXX.")
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

        // Contract dates consistency
        const cStart = String(formData.get("contractStart") ?? "").trim()
        const cEnd = String(formData.get("contractEnd") ?? "").trim()
        if (cStart && cEnd && new Date(cEnd).getTime() <= new Date(cStart).getTime()) {
            setError("Contract end date must be after the contract start date.")
            setLoading(false)
            return
        }

        // Validate + convert reserve % (UI 0-100) -> decimal (0-1) for API
        let reservePctDecimal: number | null = null
        const rpTrim = reservePctInput.trim()
        if (rpTrim !== "") {
            const pct = parseFloat(rpTrim)
            if (Number.isNaN(pct) || pct < 0 || pct > 100) {
                setError("Reserve Salary % must be between 0 and 100.")
                setLoading(false)
                return
            }
            reservePctDecimal = Math.round((pct / 100) * 10000) / 10000
        }

        const data = {
            ...Object.fromEntries(formData.entries()),
            isBranchless,
            contactNumber: filled[0] ?? "",
            contactNumbers: filled,
            regionId: selectedRegionId || null,
            regionalOfficeId: selectedRegionalOfficeId || null,
            reservePct: reservePctDecimal,
        }

        try {
            const response = await fetch(`/api/clients/${client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.message || "Failed to update client")
            }

            router.push(`/clients/${client.id}`)
            router.refresh()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setLoading(false)
        }
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
                            <input type="text" name="name" required defaultValue={client.name} className="ui-input" placeholder="Enter client name" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">
                                Client Type <span className="text-red-500">*</span>
                            </label>
                            <SearchSelect
                                name="type"
                                options={clientTypes}
                                defaultValue={client.type}
                                placeholder={clientTypes.length === 0 ? "Loading types…" : "Select client type"}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Client&apos;s Email</label>
                            <input type="email" name="email" defaultValue={client.email || ""} className="ui-input" placeholder="Client's Email" />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Enrollment Date</label>
                            <input
                                type="date"
                                name="enrollmentDate"
                                defaultValue={fmtDate(client.enrollmentDate)}
                                className={`ui-input ${!isSuperAdmin ? "bg-[var(--surface-muted)] cursor-not-allowed" : ""}`}
                                readOnly={!isSuperAdmin}
                            />
                            {!isSuperAdmin && (
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Only Super Admin can change the enrollment date.</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Status</label>
                            <select name="status" defaultValue={client.status} className="ui-input">
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                                <option value="BLACKLISTED">Blacklisted</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-2">Client Add Mode</label>
                            <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setIsBranchless(false)}
                                    className={`px-4 py-2 text-sm font-medium transition-colors ${!isBranchless ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"}`}
                                >
                                    Branch Client
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsBranchless(true)}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-l border-[var(--border)] ${isBranchless ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)]"}`}
                                >
                                    Branchless Client
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contact Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Person</label>
                            <input type="text" name="contactPerson" defaultValue={client.contactPerson || ""} className="ui-input" placeholder="Contact person" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Person Designation</label>
                            <input type="text" name="contactPersonDesignation" defaultValue={client.contactPersonDesignation || ""} className="ui-input" placeholder="e.g., Manager, Director, Officer" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number</label>
                            <div className="space-y-2">
                                {contactNumbers.map((num, idx) => {
                                    const invalid = num.trim().length > 0 && !isValidPhone(num.trim())
                                    return (
                                    <div key={idx} className="flex items-start gap-2">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={num}
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
                            <SearchSelect name="clientLocation" options={CITY_OPTIONS} defaultValue={client.city || ""} placeholder="Select city" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Client&apos;s Postal Code</label>
                            <input type="text" name="clientPostalCode" defaultValue={client.postalCode || ""} className="ui-input" placeholder="Postal code" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Head Office Address</label>
                            <textarea name="headOfficeAddress" rows={2} defaultValue={client.headOfficeAddress || ""} className="ui-textarea" placeholder="Head Office Address" />
                        </div>
                    </div>
                </div>

                {/* Introducer/Referral */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Introducer/Referral</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
                            <input type="text" name="introducerName" defaultValue={client.introducerName || ""} className="ui-input" placeholder="Name" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contact Number</label>
                            <PhoneInput name="introducerContactNumber" defaultValue={client.introducerContactNumber || ""} />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Address</label>
                            <input type="text" name="introducerAddress" defaultValue={client.introducerAddress || ""} className="ui-input" placeholder="Address" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">CNIC Number</label>
                            <CnicInput name="introducerCnicNumber" defaultValue={client.introducerCnic || ""} placeholder="CNIC number" />
                        </div>
                    </div>
                </div>

                {/* Operational Territory */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Operational Territory</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Operational Provinces</label>
                            <SearchSelect name="operationalProvinces" options={PROVINCE_OPTIONS} defaultValue={client.operationalProvinces || ""} placeholder="Select Operational Territory" />
                        </div>
                    </div>
                </div>

                {/* Region & Assignment */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Region &amp; Assignment</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Region</label>
                            <select
                                className="ui-input disabled:opacity-50 disabled:cursor-not-allowed"
                                value={selectedRegionId}
                                onChange={(e) => {
                                    setSelectedRegionId(e.target.value)
                                    setSelectedRegionalOfficeId("")
                                }}
                                disabled={isRegionalViewer}
                            >
                                <option value="">— Select Region —</option>
                                {regions.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                            {isRegionalViewer && (
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Locked to your assigned region.</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Regional Office</label>
                            <select
                                name="regionalOfficeId"
                                className="ui-input disabled:opacity-50 disabled:cursor-not-allowed"
                                value={selectedRegionalOfficeId}
                                onChange={(e) => setSelectedRegionalOfficeId(e.target.value)}
                                disabled={!selectedRegionId || Boolean(lockedRegionalOffice)}
                            >
                                <option value="">
                                    {!selectedRegionId ? "— Select Region First —" : regionalOffices.length === 0 ? "No offices in this region" : "— Select Regional Office —"}
                                </option>
                                {regionalOffices.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                            {lockedRegionalOffice && (
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Locked to your assigned regional office.</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Manager</label>
                            <SearchSelect
                                name="assignedManagerId"
                                options={managerUsers.map((u) => ({ value: u.id, label: u.name }))}
                                defaultValue={client.assignedManagerId || ""}
                                placeholder={selectedRegionId ? "— Select Manager —" : "— Select Region First —"}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Assigned Supervisor</label>
                            <SearchSelect
                                name="assignedSupervisorId"
                                options={supervisorUsers.map((u) => ({ value: u.id, label: u.name }))}
                                defaultValue={currentSupervisorId || ""}
                                placeholder={selectedRegionId ? "— Select Supervisor —" : "— Select Region First —"}
                            />
                        </div>
                    </div>
                </div>

                {/* Tax & Legal */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Tax &amp; Legal</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">NTN (National Tax Number)</label>
                            <input type="text" name="ntn" defaultValue={client.ntn || ""} className="ui-input" placeholder="Enter NTN" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">STRN (Sales Tax Registration)</label>
                            <input type="text" name="strn" defaultValue={client.strn || ""} className="ui-input" placeholder="Enter STRN" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Logo URL</label>
                            <input type="url" name="logoUrl" defaultValue={client.logoUrl || ""} className="ui-input" placeholder="https://example.com/logo.png" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Reserve Salary % (override)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={reservePctInput}
                                onChange={(e) => setReservePctInput(e.target.value)}
                                className="ui-input"
                                placeholder="e.g. 30"
                            />
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                Optional. % of net pay withheld monthly as reserve balance. Leave blank to use the regional office or global default (30%).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contract Details */}
                <div>
                    <h2 className="text-base font-semibold mb-4 pb-2 border-b border-[var(--border)] text-[var(--text)]">Contract Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Start</label>
                            <input type="date" name="contractStart" defaultValue={fmtDate(client.contractStart)} className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract End</label>
                            <input type="date" name="contractEnd" defaultValue={fmtDate(client.contractEnd)} className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Rate Start</label>
                            <input type="date" name="contractRateStart" defaultValue={fmtDate(client.contractRateStart)} className="ui-input" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Contract Rate End</label>
                            <input type="date" name="contractRateEnd" defaultValue={fmtDate(client.contractRateEnd)} className="ui-input" />
                        </div>

                        {/* Day Guards */}
                        <div className="md:col-span-2">
                            <h3 className="text-sm font-semibold text-[var(--text)] mb-3 mt-1">Day Guards</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Designation</label>
                                    <SearchSelect name="contractDayGuardDesignation" options={designationOptions} defaultValue={client.contractDayGuardDesignation || ""} placeholder={designationOptions.length === 0 ? "Loading…" : "Select designation"} />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Ex Service</label>
                                    <SearchSelect name="contractDayGuardExService" options={exServiceOptions} defaultValue={client.contractDayGuardExService || ""} placeholder={exServiceOptions.length === 0 ? "Loading…" : "Select"} />
                                </div>
                            </div>
                        </div>

                        {/* Night Guards */}
                        <div className="md:col-span-2">
                            <h3 className="text-sm font-semibold text-[var(--text)] mb-3 mt-1">Night Guards</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Designation</label>
                                    <SearchSelect name="contractNightGuardDesignation" options={designationOptions} defaultValue={client.contractNightGuardDesignation || ""} placeholder={designationOptions.length === 0 ? "Loading…" : "Select designation"} />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Guard Ex Service</label>
                                    <SearchSelect name="contractNightGuardExService" options={exServiceOptions} defaultValue={client.contractNightGuardExService || ""} placeholder={exServiceOptions.length === 0 ? "Loading…" : "Select"} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Additional Day Guards</label>
                            <input type="number" name="contractAdditionalDayGuards" defaultValue={client.contractAdditionalDayGuards ?? ""} className="ui-input" placeholder="0" min={0} />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Additional Night Guards</label>
                            <input type="number" name="contractAdditionalNightGuards" defaultValue={client.contractAdditionalNightGuards ?? ""} className="ui-input" placeholder="0" min={0} />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Price</label>
                            <input type="number" name="contractPrice" defaultValue={client.contractPrice ?? ""} className="ui-input" placeholder="Price" />
                        </div>
                    </div>
                </div>

            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t">
                <Link href={`/clients/${client.id}`} className="ui-btn ui-btn-secondary inline-flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="ui-btn ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? "Updating..." : "Update Client"}
                </button>
            </div>
        </form>
    )
}