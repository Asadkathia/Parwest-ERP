"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download, Search } from "lucide-react"
import AdvancedFilterPanel from "@/components/guards/AdvancedFilterPanel"
import DataTable from "@/components/shared/DataTable"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import StatusChip from "@/components/ui/status-chip"

type Guard = {
    id: string
    parwestId: string
    name: string
    cnic: string
    phone: string | null
    status: string
    education: string | null
}

export default function SearchGuardsManager() {
    const [query, setQuery] = useState("")
    const [status, setStatus] = useState("")
    const [education, setEducation] = useState("")
    const [religion, setReligion] = useState("")
    const [client, setClient] = useState("")
    const [supervisor, setSupervisor] = useState("")
    const [exService, setExService] = useState("")
    const [verificationType, setVerificationType] = useState("")
    const [verificationStatus, setVerificationStatus] = useState("")
    const [createdFrom, setCreatedFrom] = useState("")
    const [createdTo, setCreatedTo] = useState("")
    const [bankName, setBankName] = useState("")
    const [bankAccountStatus, setBankAccountStatus] = useState("")
    const [bankCardStatus, setBankCardStatus] = useState("")
    const [bankAccountType, setBankAccountType] = useState("")
    const [residence, setResidence] = useState("")
    const [overStaying, setOverStaying] = useState(false)
    const [onNightDuty, setOnNightDuty] = useState(false)
    const [terminatedRecords, setTerminatedRecords] = useState(false)
    const [guards, setGuards] = useState<Guard[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const loadGuards = async () => {
        try {
            setLoading(true)
            setError("")

            const params = new URLSearchParams()
            if (query.trim()) params.set("q", query.trim())
            if (status) params.set("status", status)
            if (education) params.set("education", education)

            const response = await fetch(`/api/guards/search?${params.toString()}`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch guards")
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
        loadGuards()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const hasFilters = useMemo(
        () =>
            query ||
            status ||
            education ||
            religion ||
            client ||
            supervisor ||
            exService ||
            verificationType ||
            verificationStatus ||
            createdFrom ||
            createdTo ||
            bankName ||
            bankAccountStatus ||
            bankCardStatus ||
            bankAccountType ||
            residence ||
            overStaying ||
            onNightDuty ||
            terminatedRecords,
        [
            query,
            status,
            education,
            religion,
            client,
            supervisor,
            exService,
            verificationType,
            verificationStatus,
            createdFrom,
            createdTo,
            bankName,
            bankAccountStatus,
            bankCardStatus,
            bankAccountType,
            residence,
            overStaying,
            onNightDuty,
            terminatedRecords,
        ]
    )

    return (
        <div className="space-y-6">
            <div>
                <SectionTitle title="Search Guards" subtitle="Advanced guard search and export" />
            </div>

            <AdvancedFilterPanel
                title="Filters"
                actions={(
                    <>
                        <ActionButton
                            onClick={loadGuards}
                            className="inline-flex items-center gap-2"
                        >
                            <Search className="h-4 w-4" />
                            Search
                        </ActionButton>
                        <ActionButton variant="secondary" className="inline-flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Export Short Role In Excel
                        </ActionButton>
                        <ActionButton variant="secondary" className="inline-flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Export In Bank Details
                        </ActionButton>
                        <ActionButton variant="secondary" className="inline-flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Export In Excel
                        </ActionButton>
                        {hasFilters && (
                            <ActionButton
                            variant="secondary"
                            onClick={() => {
                                setQuery("")
                                setStatus("")
                                setEducation("")
                                setReligion("")
                                setClient("")
                                setSupervisor("")
                                setExService("")
                                setVerificationType("")
                                setVerificationStatus("")
                                setCreatedFrom("")
                                setCreatedTo("")
                                setBankName("")
                                setBankAccountStatus("")
                                setBankCardStatus("")
                                setBankAccountType("")
                                setResidence("")
                                setOverStaying(false)
                                setOnNightDuty(false)
                                setTerminatedRecords(false)
                            }}
                        >
                                Clear
                            </ActionButton>
                        )}
                    </>
                )}
            >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">Parwest ID / Name / CNIC / Phone</label>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search guards..."
                            className="ui-input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className="ui-select">
                            <option value="">All</option>
                            <option value="ACTIVE">Active</option>
                            <option value="PENDING">Pending</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="BLACKLISTED">Blacklisted</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Education</label>
                        <input
                            value={education}
                            onChange={(e) => setEducation(e.target.value)}
                            className="ui-input"
                            placeholder="e.g. Matric"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Religion</label>
                        <input value={religion} onChange={(e) => setReligion(e.target.value)} className="ui-input" placeholder="Religion" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Client</label>
                        <input value={client} onChange={(e) => setClient(e.target.value)} className="ui-input" placeholder="Client" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Supervisor</label>
                        <input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="ui-input" placeholder="Supervisor" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Ex Service</label>
                        <select value={exService} onChange={(e) => setExService(e.target.value)} className="ui-select">
                            <option value="">All</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Verification Type</label>
                        <input value={verificationType} onChange={(e) => setVerificationType(e.target.value)} className="ui-input" placeholder="NADRA / Health / Police" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Verification Status</label>
                        <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)} className="ui-select">
                            <option value="">All</option>
                            <option value="VERIFIED">Verified</option>
                            <option value="PENDING">Pending</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Created From</label>
                        <input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} className="ui-input" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Created To</label>
                        <input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} className="ui-input" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Bank Name</label>
                        <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="ui-input" placeholder="Bank name" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Bank Account Status</label>
                        <select value={bankAccountStatus} onChange={(e) => setBankAccountStatus(e.target.value)} className="ui-select">
                            <option value="">All</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Bank Card Status</label>
                        <select value={bankCardStatus} onChange={(e) => setBankCardStatus(e.target.value)} className="ui-select">
                            <option value="">All</option>
                            <option value="Received">Received</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Bank Account Type</label>
                        <select value={bankAccountType} onChange={(e) => setBankAccountType(e.target.value)} className="ui-select">
                            <option value="">All</option>
                            <option value="Savings">Savings</option>
                            <option value="Current">Current</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Residence</label>
                        <input value={residence} onChange={(e) => setResidence(e.target.value)} className="ui-input" placeholder="Residence" />
                    </div>
                    <div className="md:col-span-4 flex flex-wrap gap-6 pt-2">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={overStaying} onChange={(e) => setOverStaying(e.target.checked)} />
                            Over Staying
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={onNightDuty} onChange={(e) => setOnNightDuty(e.target.checked)} />
                            On Night Duty
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={terminatedRecords} onChange={(e) => setTerminatedRecords(e.target.checked)} />
                            Terminated Records
                        </label>
                    </div>
                </div>
            </AdvancedFilterPanel>

            {error && <InlineAlert type="error" message={error} />}

            {loading ? (
                <div className="ui-card px-6 py-10 text-center text-sm text-[var(--text-muted)]">Loading guards...</div>
            ) : (
                <DataTable
                    rows={guards}
                    getRowKey={(row) => row.id}
                    emptyText="No guards match selected filters."
                    searchable={false}
                    density="compact"
                    columns={[
                        { key: "parwestId", header: "Parwest ID", sortable: true },
                        { key: "name", header: "Name", sortable: true },
                        { key: "cnic", header: "CNIC", sortable: true },
                        { key: "phone", header: "Phone" },
                        {
                            key: "status",
                            header: "Status",
                            render: (guard) => (
                                <StatusChip label={guard.status} variant={guard.status === "ACTIVE" ? "success" : "neutral"} />
                            ),
                        },
                        {
                            key: "action",
                            header: "Action",
                            render: (guard) => (
                                <Link href={`/guards/${guard.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                                    View
                                </Link>
                            ),
                        },
                    ]}
                />
            )}
        </div>
    )
}
