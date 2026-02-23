"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type TrainingRow = {
    id: string
    trainingType: string
    completedAt: string
    instructor: string | null
    notes: string | null
    guard?: {
        id: string
        name: string
        parwestId: string
        regionalOffice: { name: string } | null
    } | null
}

type ParsedNotes = {
    regionalOffice?: string
    client?: string
    branch?: string
    branchSupervisor?: string
    supervisorWithUniform?: string
    branchManager?: string
    armorer?: string
    conductedBy?: string
    dueDate?: string
    remarks?: string
}

const LEGACY_REGIONAL_OFFICES = [
    "head office lahore",
    "islamabad",
    "quetta",
    "peshawar",
    "karachi",
    "multan",
    "sahiwal",
    "gujranwala",
    "faisalabad",
    "sub office kasur",
    "sub office sheikhupura",
    "test office",
    "hyderabad",
    "sukkur",
    "qadir pur ghotki",
    "jand",
]

const LEGACY_CLIENTS = [
    "National Bank of Pakistan",
    "Standard Chartered Bank Limited Pakistan",
    "United Bank Limited",
    "MCB Bank Ltd",
    "Faysal Bank Limited",
    "Summit Bank Limited",
    "Meezan Bank Limited",
    "Bank Al Habib Limited",
    "Samba Bank Limited",
    "Habib Bank Limited",
]

const LEGACY_BRANCHES = [
    "Crystalline Chemicals Industries Pvt Ltd",
    "Parsi Grave Yard",
    "FGA of Pakistan",
    "Ghalib Assocoates",
    "Saudi Pak BA Rajpot",
    "AM Gill Pvt Ltd",
    "Trans Fab",
    "Mr Atif Murad",
    "21 5 Cantt Lahore Qalnadr",
    "239 FF DHA",
    "Mr Basit Rehman Malik",
    "HOUSE#96 U, PHASE III, DHA",
]

function parseNotes(raw: string | null): ParsedNotes {
    if (!raw) return {}

    const parts = raw.split("|").map((p) => p.trim())
    const parsed: ParsedNotes = {}

    for (const part of parts) {
        const [left, ...rest] = part.split(":")
        const value = rest.join(":").trim()
        const key = left.trim().toLowerCase()

        if (!value) continue

        if (key === "regional office") parsed.regionalOffice = value
        else if (key === "client") parsed.client = value
        else if (key === "branch") parsed.branch = value
        else if (key === "branch supervisor") parsed.branchSupervisor = value
        else if (key === "supervisor with uniform") parsed.supervisorWithUniform = value
        else if (key === "branch manager") parsed.branchManager = value
        else if (key === "armorer") parsed.armorer = value
        else if (key === "conducted by") parsed.conductedBy = value
        else if (key === "due date") parsed.dueDate = value
        else if (key === "remarks") parsed.remarks = value
    }

    if (!parsed.conductedBy && raw) parsed.remarks = raw

    return parsed
}

export default function TrainingsManager() {
    const [rows, setRows] = useState<TrainingRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const [regionalOfficeFilter, setRegionalOfficeFilter] = useState("")
    const [clientFilter, setClientFilter] = useState("")
    const [branchFilter, setBranchFilter] = useState("")
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")
    const [itemsPerPage, setItemsPerPage] = useState("10")
    const [tableSearch, setTableSearch] = useState("")
    const [armorer, setArmorer] = useState("No")
    const [supervisorUniform, setSupervisorUniform] = useState("Yes")

    const loadTrainings = async () => {
        try {
            setLoading(true)
            setError("")
            const response = await fetch("/api/trainings")
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to fetch trainings")
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
        loadTrainings()
    }, [])

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            const notes = parseNotes(row.notes)
            const completed = new Date(row.completedAt)
            const guardRegionalOffice = row.guard?.regionalOffice?.name || ""

            if (regionalOfficeFilter && !((notes.regionalOffice || guardRegionalOffice).toLowerCase().includes(regionalOfficeFilter.toLowerCase()))) {
                return false
            }

            if (clientFilter && !(notes.client || "").toLowerCase().includes(clientFilter.toLowerCase())) {
                return false
            }

            if (branchFilter && !(notes.branch || "").toLowerCase().includes(branchFilter.toLowerCase())) {
                return false
            }

            if (fromDate && completed < new Date(fromDate)) {
                return false
            }

            if (toDate && completed > new Date(toDate)) {
                return false
            }

            if (tableSearch.trim()) {
                const q = tableSearch.toLowerCase()
                const guardName = row.guard?.name?.toLowerCase() || ""
                const guardParwestId = row.guard?.parwestId?.toLowerCase() || ""
                const trainingType = row.trainingType?.toLowerCase() || ""
                const notesText = row.notes?.toLowerCase() || ""
                if (!(guardName.includes(q) || guardParwestId.includes(q) || trainingType.includes(q) || notesText.includes(q))) {
                    return false
                }
            }

            return true
        })
    }, [rows, regionalOfficeFilter, clientFilter, branchFilter, fromDate, toDate, tableSearch])

    const clearFilters = () => {
        setRegionalOfficeFilter("")
        setClientFilter("")
        setBranchFilter("")
        setFromDate("")
        setToDate("")
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <SectionTitle title="On Job Training" subtitle="Track OJT sessions and completion status by guard" />
                <Link href="/guards/trainings/new" className="ui-btn ui-btn-primary">Add New Training</Link>
            </div>

            <FilterBar className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Regional Office</label>
                        <select value={regionalOfficeFilter} onChange={(e) => setRegionalOfficeFilter(e.target.value)} className="ui-select">
                            <option value="">--Select Regional Office--</option>
                            {LEGACY_REGIONAL_OFFICES.map((office) => (
                                <option key={office} value={office}>{office}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Client</label>
                        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="ui-select">
                            <option value="">--Select Client--</option>
                            {LEGACY_CLIENTS.map((client) => (
                                <option key={client} value={client}>{client}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Branch</label>
                        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="ui-select">
                            <option value="">--Select Branch--</option>
                            {LEGACY_BRANCHES.map((branch) => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">From Date</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="ui-input" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">To Date</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="ui-input" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Show</label>
                        <select value={itemsPerPage} onChange={(e) => setItemsPerPage(e.target.value)} className="ui-select">
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Search:</label>
                        <input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="ui-input" placeholder="Guard / ID / type / remarks" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Armorer</label>
                        <select value={armorer} onChange={(e) => setArmorer(e.target.value)} className="ui-select">
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Supervisor Has Uniform</label>
                        <select value={supervisorUniform} onChange={(e) => setSupervisorUniform(e.target.value)} className="ui-select">
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <ActionButton>Filter</ActionButton>
                    <ActionButton variant="secondary" onClick={clearFilters}>Clear</ActionButton>
                    <ActionButton>Export All OJT Report</ActionButton>
                    <ActionButton>Export Filtered OJT Report</ActionButton>
                    <ActionButton>Branch Training Report</ActionButton>
                    <ActionButton>Export Branch Report</ActionButton>
                    <ActionButton>Export Summary</ActionButton>
                    <ActionButton variant="danger">Missing Training Report</ActionButton>
                </div>
            </FilterBar>

            {error && <InlineAlert type="error" message={error} />}

            <div className="ui-card overflow-x-auto">
                <table className="w-full min-w-[1500px]">
                    <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Date</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Date of OJT</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Regional Office</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Client</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Branch</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Guards</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Branch Supervisor</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Supervisor Uniform</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Branch Manager</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Armorer</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Conducted By</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Due Date</th>
                            <th className="px-6 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Remarks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {loading ? (
                            <tr><td colSpan={13} className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">Loading...</td></tr>
                        ) : filteredRows.length === 0 ? (
                            <tr><td colSpan={13} className="px-6 py-8 text-center text-sm text-[var(--text-muted)]">No training records found.</td></tr>
                        ) : (
                            filteredRows.slice(0, Number.parseInt(itemsPerPage, 10) || 10).map((training) => {
                                const notes = parseNotes(training.notes)
                                const created = new Date(training.completedAt)
                                const due = new Date(created)
                                due.setMonth(due.getMonth() + 1)
                                const guardName = training.guard?.name || "Unknown Guard"
                                const guardRegionalOffice = training.guard?.regionalOffice?.name

                                return (
                                    <tr key={training.id} className="hover:bg-[var(--surface-muted)]">
                                        <td className="px-6 py-4 text-sm">{created.toLocaleDateString("en-US")}</td>
                                        <td className="px-6 py-4 text-sm">{created.toLocaleDateString("en-US")}</td>
                                        <td className="px-6 py-4 text-sm">{notes.regionalOffice || guardRegionalOffice || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.client || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.branch || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{guardName}</td>
                                        <td className="px-6 py-4 text-sm">{notes.branchSupervisor || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.supervisorWithUniform || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.branchManager || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.armorer || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.conductedBy || training.instructor || "—"}</td>
                                        <td className="px-6 py-4 text-sm">{notes.dueDate || due.toLocaleDateString("en-US")}</td>
                                        <td className="px-6 py-4 text-sm">{notes.remarks || "—"}</td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
