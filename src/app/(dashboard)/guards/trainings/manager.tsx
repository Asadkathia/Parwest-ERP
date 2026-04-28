"use client"

import Link from "next/link"
import { Button } from "@/components/shadcn/button"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/shadcn/card"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

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

type RegionalOffice = { id: string; name: string }

type Props = {
    effectiveRegionId?: string | null
    lockedOfficeId?: string | null
    regions?: { id: string; name: string }[]
    regionLocked?: boolean
}

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

function exportCsv(rows: TrainingRow[], filename: string) {
    const headers = ["Date", "Date of OJT", "Regional Office", "Client", "Branch", "Guard", "Branch Supervisor", "Supervisor Uniform", "Branch Manager", "Armorer", "Conducted By", "Due Date", "Remarks"]
    const csvRows = [headers.join(",")]
    for (const row of rows) {
        const notes = parseNotes(row.notes)
        const created = new Date(row.completedAt)
        const due = new Date(created)
        due.setMonth(due.getMonth() + 1)
        const guardRegionalOffice = row.guard?.regionalOffice?.name || ""
        const cells = [
            created.toLocaleDateString("en-US"),
            created.toLocaleDateString("en-US"),
            notes.regionalOffice || guardRegionalOffice || "",
            notes.client || "",
            notes.branch || "",
            row.guard?.name || "",
            notes.branchSupervisor || "",
            notes.supervisorWithUniform || "",
            notes.branchManager || "",
            notes.armorer || "",
            notes.conductedBy || row.instructor || "",
            notes.dueDate || due.toLocaleDateString("en-US"),
            notes.remarks || "",
        ].map(c => `"${String(c).replace(/"/g, '""')}"`)
        csvRows.push(cells.join(","))
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

export default function TrainingsManager({
    effectiveRegionId = null,
    lockedOfficeId = null,
    regions = [],
    regionLocked = false,
}: Props = {}) {
    const [rows, setRows] = useState<TrainingRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])

    const [regionalOfficeFilter, setRegionalOfficeFilter] = useState("")
    const [clientFilter, setClientFilter] = useState("")
    const [branchFilter, setBranchFilter] = useState("")
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")
    const [itemsPerPage, setItemsPerPage] = useState("10")
    const [tableSearch, setTableSearch] = useState("")
    const [armorer, setArmorer] = useState("No")
    const [supervisorUniform, setSupervisorUniform] = useState("Yes")

    useEffect(() => {
        let cancelled = false
        const loadTrainings = async () => {
            try {
                setLoading(true)
                setError("")
                const params = new URLSearchParams()
                if (effectiveRegionId) params.set("regionId", effectiveRegionId)
                const response = await fetch(`/api/trainings?${params.toString()}`)
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}))
                    throw new Error(data.message || "Failed to fetch trainings")
                }
                const data = await response.json()
                if (!cancelled) setRows(data)
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Unexpected error")
                    setRows([])
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        void loadTrainings()
        const officeParams = new URLSearchParams()
        if (effectiveRegionId) officeParams.set("regionId", effectiveRegionId)
        fetch(`/api/regional-offices?${officeParams.toString()}`)
            .then(r => r.ok ? r.json() : [])
            .then((data: RegionalOffice[]) => { if (!cancelled) setRegionalOffices(data) })
            .catch(() => {})
        return () => { cancelled = true }
    }, [effectiveRegionId])

    const uniqueClients = useMemo(() => {
        const seen = new Set<string>()
        for (const row of rows) {
            const client = parseNotes(row.notes).client
            if (client) seen.add(client)
        }
        return Array.from(seen).sort()
    }, [rows])

    const uniqueBranches = useMemo(() => {
        const seen = new Set<string>()
        for (const row of rows) {
            const branch = parseNotes(row.notes).branch
            if (branch) seen.add(branch)
        }
        return Array.from(seen).sort()
    }, [rows])

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
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">On Job Training</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Track OJT sessions and completion status by guard</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Link href="/guards/trainings/new" className="ui-btn ui-btn-primary">Add New Training</Link>
                </div>
            </div>

            <Card>
                <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <RegionUrlPicker
                        regions={regions}
                        locked={regionLocked}
                        includeGlobalOption={!regionLocked}
                    />
                    {!lockedOfficeId && (
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Select Regional Office</label>
                            <select name="regional_office_id" value={regionalOfficeFilter} onChange={(e) => setRegionalOfficeFilter(e.target.value)} className="ui-select">
                                <option value="">--Select Regional Office--</option>
                                {regionalOffices.map((office) => (
                                    <option key={office.id} value={office.name}>{office.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Client</label>
                        <select name="client_id" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="ui-select">
                            <option value="">--Select Client--</option>
                            {uniqueClients.map((client) => (
                                <option key={client} value={client}>{client}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Branch</label>
                        <select name="branch_id" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="ui-select">
                            <option value="">--Select Branch--</option>
                            {uniqueBranches.map((branch) => (
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
                        <label className="block text-sm text-gray-600 mb-1">Items per page:</label>
                        <select name="Items per page:" value={itemsPerPage} onChange={(e) => setItemsPerPage(e.target.value)} className="ui-select">
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Search by client, branch, guard, supervisor...</label>
                        <input name="Search by client, branch, guard, supervisor..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="ui-input" placeholder="Guard / ID / type / remarks" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Armorer</label>
                        <select value={armorer} onChange={(e) => setArmorer(e.target.value)} className="ui-select">
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            <label className="inline-flex items-center gap-1">
                                <input name="Yes" type="radio" checked={armorer === "Yes"} onChange={() => setArmorer("Yes")} />
                                Yes
                            </label>
                            <label className="inline-flex items-center gap-1">
                                <input name="No" type="radio" checked={armorer === "No"} onChange={() => setArmorer("No")} />
                                No
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Supervisor Has Uniform</label>
                        <select value={supervisorUniform} onChange={(e) => setSupervisorUniform(e.target.value)} className="ui-select">
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            <label className="inline-flex items-center gap-1">
                                <input name="supervisor_uniform_yes" type="radio" checked={supervisorUniform === "Yes"} onChange={() => setSupervisorUniform("Yes")} />
                                Yes
                            </label>
                            <label className="inline-flex items-center gap-1">
                                <input name="supervisor_uniform_no" type="radio" checked={supervisorUniform === "No"} onChange={() => setSupervisorUniform("No")} />
                                No
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button>Filter</Button>
                    <Button variant="secondary" onClick={clearFilters}>Clear</Button>
                    <Button onClick={() => exportCsv(rows, "ojt-all.csv")}>Export All OJT Report</Button>
                    <Button onClick={() => exportCsv(filteredRows, "ojt-filtered.csv")}>Export Filtered OJT Report</Button>
                    <Button onClick={() => exportCsv(filteredRows, "ojt-branch-report.csv")}>Branch Training Report</Button>
                    <Button onClick={() => exportCsv(filteredRows, "ojt-branch-export.csv")}>Export Branch Report</Button>
                    <Button onClick={() => exportCsv(filteredRows, "ojt-summary.csv")}>Export Summary</Button>
                    <Button variant="destructive" onClick={() => {
                        const missing = rows.filter(r => !r.trainingType || !r.completedAt)
                        exportCsv(missing, "ojt-missing.csv")
                    }}>Missing Training Report</Button>
                </div>
                </CardContent>
            </Card>

            {error && <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(error)}</AlertDescription></Alert>}

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
