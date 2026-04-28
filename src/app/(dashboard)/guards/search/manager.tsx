"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { Badge } from "@/components/shadcn/badge"
import Link from "next/link"
import { AlertCircle, Download, Loader2, Search, X } from "lucide-react"
import DataTable from "@/components/shared/DataTable"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import GuardAvatar from "@/components/guards/GuardAvatar"
import SearchSelect from "@/components/ui/SearchSelect"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

// ── Types ────────────────────────────────────────────────────────────────────

type Guard = {
    id: string
    parwestId: string
    name: string
    cnic: string
    phone: string | null
    photoUrl?: string | null
    status: string
    education: string | null
    religion: string | null
    exServiceType: string | null
    createdAt: string | null
    officeName: string | null
    supervisorName: string | null
    clientName: string | null
    prerequisites: Array<{ docTypeName: string; status: string; verificationStatus: string | null }>
}

type Meta = {
    statuses: string[]
    exServiceTypes: string[]
    verificationTypes: string[]
    verificationStatuses: string[]
    prerequisiteStatuses: string[]
    clients: { id: string; name: string }[]
    offices: { id: string; name: string }[]
    educations: string[]
    religions: string[]
}

type Filters = {
    parwestId: string
    name: string
    cnic: string
    phone: string
    education: string
    religion: string
    status: string
    clientId: string
    supervisor: string
    exServiceType: string
    verificationType: string
    verificationStatus: string
    prereqStatus: string
    officeId: string
    createdFrom: string
    createdTo: string
    selectDate: string
    tableSearch: string
    rowsPerPage: string
    terminatedRecords: boolean
    onNightDuty: boolean
    overStaying: boolean
}

const defaultFilters: Filters = {
    parwestId: "",
    name: "",
    cnic: "",
    phone: "",
    education: "",
    religion: "",
    status: "",
    clientId: "",
    supervisor: "",
    exServiceType: "",
    verificationType: "",
    verificationStatus: "",
    prereqStatus: "",
    officeId: "",
    createdFrom: "",
    createdTo: "",
    selectDate: "",
    tableSearch: "",
    rowsPerPage: "25",
    terminatedRecords: false,
    onNightDuty: false,
    overStaying: false,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const lc = (v?: string | null) => String(v ?? "").toLowerCase()

const STATUS_BADGE_CLASSES: Record<string, string> = {
    ACTIVE:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-transparent",
    PRESENT:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-transparent",
    PENDING:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-transparent",
    DEFAULT:    "bg-secondary text-secondary-foreground border-transparent",
    ABSENT:     "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-transparent",
    INACTIVE:   "bg-secondary text-secondary-foreground border-transparent",
    TERMINATED: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-transparent",
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
    effectiveRegionId?: string | null
    lockedOfficeId?: string | null
    regions?: { id: string; name: string }[]
    regionLocked?: boolean
}

export default function SearchGuardsManager({
    effectiveRegionId = null,
    lockedOfficeId = null,
    regions = [],
    regionLocked = false,
}: Props = {}) {
    const [filters, setFilters] = useState<Filters>(() => ({
        ...defaultFilters,
        officeId: lockedOfficeId ?? "",
    }))
    const [guards, setGuards] = useState<Guard[]>([])
    const [meta, setMeta] = useState<Meta>({
        statuses: [],
        exServiceTypes: [],
        verificationTypes: [],
        verificationStatuses: [],
        prerequisiteStatuses: [],
        clients: [],
        offices: [],
        educations: [],
        religions: [],
    })
    const [metaLoading, setMetaLoading] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
        setFilters((prev) => ({ ...prev, [key]: value }))

    const resetFilters = () => setFilters({ ...defaultFilters, officeId: lockedOfficeId ?? "" })

    // Keep officeId synced when scope locks change.
    useEffect(() => {
        if (lockedOfficeId) {
            setFilters((prev) => ({ ...prev, officeId: lockedOfficeId }))
        }
    }, [lockedOfficeId])

    // Load meta (dynamic options) — refetch when active region changes so
    // SuperAdmin's office/client lists narrow with the picker.
    useEffect(() => {
        setMetaLoading(true)
        const params = new URLSearchParams()
        if (effectiveRegionId) params.set("regionId", effectiveRegionId)
        fetch(`/api/guards/search/meta?${params.toString()}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data) setMeta(data) })
            .catch(() => {})
            .finally(() => setMetaLoading(false))
    }, [effectiveRegionId])

    // Build server-side params and fetch
    const loadGuards = async () => {
        setLoading(true)
        setError("")
        try {
            const params = new URLSearchParams()
            const q = [filters.parwestId, filters.name, filters.cnic, filters.phone].filter(Boolean).join(" ").trim()
            if (q)                    params.set("q", q)
            if (filters.status)       params.set("status", filters.status)
            if (filters.education)    params.set("education", filters.education)
            if (filters.religion)     params.set("religion", filters.religion)
            if (filters.exServiceType) params.set("exServiceType", filters.exServiceType)
            if (filters.officeId)     params.set("officeId", filters.officeId)
            if (filters.clientId)     params.set("clientId", filters.clientId)
            if (filters.createdFrom)  params.set("createdFrom", filters.createdFrom)
            if (filters.createdTo)    params.set("createdTo", filters.createdTo)
            if (effectiveRegionId)    params.set("regionId", effectiveRegionId)

            const res = await fetch(`/api/guards/search?${params.toString()}`)
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to fetch guards")
            setGuards(await res.json())
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unexpected error")
            setGuards([])
        } finally {
            setLoading(false)
        }
    }

    // Initial load + refresh when active region changes (SuperAdmin region picker).
    useEffect(() => { loadGuards() }, [effectiveRegionId]) // eslint-disable-line react-hooks/exhaustive-deps

    // Client-side refinement filters (applied on top of server-filtered data)
    const filteredRows = useMemo(() => {
        return guards.filter((guard) => {
            if (filters.supervisor && !lc(guard.supervisorName).includes(lc(filters.supervisor))) return false

            if (filters.verificationType) {
                const match = guard.prerequisites.some((p) => lc(p.docTypeName) === lc(filters.verificationType))
                if (!match) return false
            }
            if (filters.verificationStatus) {
                const match = guard.prerequisites.some((p) => lc(p.verificationStatus) === lc(filters.verificationStatus))
                if (!match) return false
            }
            if (filters.prereqStatus) {
                const match = guard.prerequisites.some((p) => lc(p.status) === lc(filters.prereqStatus))
                if (!match) return false
            }

            if (filters.selectDate && guard.createdAt) {
                const selected = filters.selectDate
                const created = guard.createdAt.slice(0, 10)
                if (selected !== created) return false
            }

            if (filters.tableSearch) {
                const blob = [guard.parwestId, guard.name, guard.cnic, guard.phone, guard.clientName, guard.supervisorName, guard.status]
                    .map(lc).join(" ")
                if (!blob.includes(lc(filters.tableSearch))) return false
            }

            if (filters.terminatedRecords && lc(guard.status) !== "terminated") return false

            return true
        })
    }, [guards, filters])

    const supervisorOptions = useMemo(() =>
        Array.from(new Set(guards.map((g) => g.supervisorName ?? "").filter(Boolean))).sort(),
        [guards]
    )

    const rowsPerPage = useMemo(() => {
        if (filters.rowsPerPage === "All") return Math.max(filteredRows.length, 1)
        const n = parseInt(filters.rowsPerPage, 10)
        return Number.isFinite(n) && n > 0 ? n : 25
    }, [filters.rowsPerPage, filteredRows.length])

    return (
        <div className="space-y-6">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Search Guard</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Search guards with advanced filters.</p>
                </div>
            </div>

            <div className="ui-card p-5">
                <h2 className="mb-4 text-base font-semibold">Select Fields</h2>

                {metaLoading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4 animate-pulse">
                        {[...Array(16)].map((_, i) => (
                            <div key={i} className="space-y-1">
                                <div className="h-3 w-24 bg-gray-200 rounded" />
                                <div className="h-9 bg-gray-100 rounded" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <RegionUrlPicker
                            regions={regions}
                            locked={regionLocked}
                            includeGlobalOption={!regionLocked}
                        />
                        <Input label="Parwest ID"    value={filters.parwestId}   onChange={(v) => setFilter("parwestId", v)}   placeholder="Parwest ID" />
                        <Input label="Name"          value={filters.name}        onChange={(v) => setFilter("name", v)}        placeholder="Name" />
                        <Input label="CNIC#"         value={filters.cnic}        onChange={(v) => setFilter("cnic", v)}        placeholder="CNIC#" />
                        <Input label="Phone Number"  value={filters.phone}       onChange={(v) => setFilter("phone", v)}       placeholder="Phone Number" />

                        <LabeledSearchSelect label="Education"    value={filters.education}      onChange={(v) => setFilter("education", v)}      options={meta.educations.map((e) => ({ value: e, label: e }))}                                 placeholder="--Select Education--" />
                        <LabeledSearchSelect label="Religion"     value={filters.religion}       onChange={(v) => setFilter("religion", v)}       options={meta.religions.map((r) => ({ value: r, label: r }))}                                  placeholder="--Select Religion--" />
                        <LabeledSearchSelect label="Status"       value={filters.status}         onChange={(v) => setFilter("status", v)}         options={meta.statuses.map((s) => ({ value: s, label: s }))}                                   placeholder="--Select Status--" />
                        <LabeledSearchSelect label="Client"       value={filters.clientId}       onChange={(v) => setFilter("clientId", v)}       options={meta.clients.map((c) => ({ value: c.id, label: c.name }))}                            placeholder="--Select Client--" />

                        <LabeledSearchSelect label="Supervisor"          value={filters.supervisor}      onChange={(v) => setFilter("supervisor", v)}      options={supervisorOptions.map((s) => ({ value: s, label: s }))}                 placeholder="--Select Supervisor--" />
                        <LabeledSearchSelect label="Ex Service Type"     value={filters.exServiceType}   onChange={(v) => setFilter("exServiceType", v)}   options={meta.exServiceTypes.map((e) => ({ value: e, label: e }))}               placeholder="--Select Ex Service--" />
                        <LabeledSearchSelect label="Verification Type"   value={filters.verificationType}   onChange={(v) => setFilter("verificationType", v)}   options={meta.verificationTypes.map((t) => ({ value: t, label: t }))}    placeholder="--Select Verification Type--" />
                        <LabeledSearchSelect label="Verification Status" value={filters.verificationStatus} onChange={(v) => setFilter("verificationStatus", v)} options={meta.verificationStatuses.map((s) => ({ value: s, label: s }))} placeholder="--Select Verification Status--" />

                        <LabeledSearchSelect label="Prerequisite Status" value={filters.prereqStatus} onChange={(v) => setFilter("prereqStatus", v)} options={meta.prerequisiteStatuses.map((s) => ({ value: s, label: s }))} placeholder="--Select Prereq Status--" />
                        {lockedOfficeId ? (
                            <div />
                        ) : (
                            <LabeledSearchSelect label="Office"          value={filters.officeId}     onChange={(v) => setFilter("officeId", v)}     options={meta.offices.map((o) => ({ value: o.id, label: o.name }))}           placeholder="--All Offices--" />
                        )}

                        <Input label="Created From" type="date" value={filters.createdFrom} onChange={(v) => setFilter("createdFrom", v)} />
                        <Input label="Created To"   type="date" value={filters.createdTo}   onChange={(v) => setFilter("createdTo", v)} />

                        <LabeledSearchSelect label="Show records" value={filters.rowsPerPage} onChange={(v) => setFilter("rowsPerPage", v)} options={["10", "25", "50", "100", "200", "500", "All"].map((n) => ({ value: n, label: n }))} placeholder="25" />
                        <Input label="Table Search"  value={filters.tableSearch} onChange={(v) => setFilter("tableSearch", v)} placeholder="Quick search in results..." />
                        <Input label="Select Date"   type="date" value={filters.selectDate} onChange={(v) => setFilter("selectDate", v)} />
                    </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={filters.terminatedRecords} onChange={(e) => setFilter("terminatedRecords", e.target.checked)} />
                        Terminated Records
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={filters.onNightDuty} onChange={(e) => setFilter("onNightDuty", e.target.checked)} />
                        On Night Duty
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={filters.overStaying} onChange={(e) => setFilter("overStaying", e.target.checked)} />
                        Overstaying
                    </label>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={loadGuards} disabled={loading} className="inline-flex items-center gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        {loading ? "Searching..." : "SEARCH!"}
                    </Button>
                    <Button variant="secondary" onClick={resetFilters} className="inline-flex items-center gap-2">
                        <X className="h-4 w-4" />
                        Clear Filter
                    </Button>
                    <Button variant="secondary" className="inline-flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export Short Role In Excel
                    </Button>
                    <Button variant="secondary" className="inline-flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export In Bank Details
                    </Button>
                    <Button variant="secondary" className="inline-flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export In Excel
                    </Button>
                </div>
            </div>

            {error ? (
                <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            {/* Results */}
            {loading ? (
                <div className="ui-card overflow-hidden">
                    {/* Header skeleton */}
                    <div className="bg-gray-50 border-b px-4 py-3 grid grid-cols-8 gap-3 animate-pulse">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-3 bg-gray-200 rounded" />
                        ))}
                    </div>
                    {/* Row skeletons */}
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="px-4 py-3 border-b grid grid-cols-8 gap-3 items-center animate-pulse">
                            <div className="h-9 w-9 bg-gray-100 rounded-full" />
                            <div className="h-4 bg-gray-100 rounded col-span-1" />
                            <div className="h-4 bg-gray-100 rounded col-span-1" />
                            <div className="h-4 bg-gray-100 rounded col-span-1" />
                            <div className="h-4 bg-gray-100 rounded col-span-1" />
                            <div className="h-4 bg-gray-100 rounded col-span-1" />
                            <div className="h-6 w-16 bg-gray-100 rounded-full col-span-1" />
                            <div className="h-4 w-16 bg-gray-100 rounded col-span-1" />
                        </div>
                    ))}
                </div>
            ) : (
                <DataTable
                    rows={filteredRows}
                    getRowKey={(row) => row.id}
                    emptyText="No guards match selected filters."
                    searchable={false}
                    density="compact"
                    tableFixed
                    pageSize={rowsPerPage}
                    columns={[
                        {
                            key: "photo",
                            header: "Photo",
                            className: "w-12",
                            render: (g) => <GuardAvatar guardId={g.id} guardName={g.name} initialUrl={g.photoUrl} />,
                        },
                        { key: "parwestId",    header: "Parwest ID",  sortable: true, className: "w-24" },
                        { key: "name",         header: "Name",        sortable: true, className: "w-36 max-w-[9rem] truncate" },
                        { key: "cnic",         header: "CNIC",        sortable: true, className: "w-32" },
                        { key: "phone",        header: "Phone",       className: "w-28" },
                        { key: "clientName",   header: "Client",      className: "w-28 max-w-[7rem] truncate" },
                        { key: "supervisorName", header: "Supervisor", className: "w-24 max-w-[6rem] truncate" },
                        { key: "officeName",   header: "Office",      className: "w-28 max-w-[7rem] truncate" },
                        {
                            key: "status",
                            header: "Status",
                            className: "w-24",
                            render: (g) => (
                                <Badge className={`font-bold ${STATUS_BADGE_CLASSES[g.status] || STATUS_BADGE_CLASSES.DEFAULT}`}>{g.status}</Badge>
                            ),
                        },
                        {
                            key: "action",
                            header: "Action",
                            className: "w-20",
                            render: (g) => (
                                <div className="flex items-center gap-2 text-xs">
                                    <Link href={`/guards/${g.id}`} className="font-medium text-[var(--brand)] hover:underline">
                                        View
                                    </Link>
                                    <Link href={`/guards/${g.id}?tab=profile`} className="font-medium text-[var(--brand)] hover:underline">
                                        Edit
                                    </Link>
                                </div>
                            ),
                        },
                    ]}
                />
            )}

            <p className="text-xs text-[var(--text-muted)]">
                Showing {filteredRows.length} of {guards.length} guard{guards.length !== 1 ? "s" : ""}
            </p>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Input({
    label, value, onChange, placeholder, type = "text",
}: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
    return (
        <div>
            <label className="mb-1 block text-sm text-gray-600">{label}</label>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="ui-input" placeholder={placeholder} />
        </div>
    )
}

function LabeledSearchSelect({
    label, value, onChange, options, placeholder,
}: {
    label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string
}) {
    return (
        <div>
            <label className="mb-1 block text-sm text-gray-600">{label}</label>
            <SearchSelect
                name={label}
                options={options}
                value={value}
                placeholder={placeholder ?? `--Select ${label}--`}
                onChange={(v) => onChange(v)}
            />
        </div>
    )
}