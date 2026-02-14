"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"
import ExportDialog from "@/components/shared/ExportDialog"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"

export default function ExportGuardsManager() {
    const [exportType, setExportType] = useState("summary")
    const [format, setFormat] = useState("excel")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [openDialog, setOpenDialog] = useState(false)
    const [selectedFields, setSelectedFields] = useState<string[]>([
        "Parwest ID",
        "Name",
        "CNIC",
        "Phone",
        "Status",
        "Region",
        "Education",
        "Verification",
    ])

    const allFields = ["Parwest ID", "Name", "CNIC", "Phone", "Status", "Region", "Education", "Verification"]

    const toggleField = (field: string) => {
        setSelectedFields((prev) =>
            prev.includes(field)
                ? prev.filter((f) => f !== field)
                : [...prev, field]
        )
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <SectionTitle title="Export Guards" subtitle="Generate guard exports with custom fields and date range filters" />

            <FilterBar className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Export Type</label>
                        <select value={exportType} onChange={(e) => setExportType(e.target.value)} className="ui-select">
                            <option value="summary">Summary Export</option>
                            <option value="detailed">Detailed Export</option>
                            <option value="verification">Verification Export</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Format</label>
                        <select value={format} onChange={(e) => setFormat(e.target.value)} className="ui-select">
                            <option value="excel">Excel</option>
                            <option value="pdf">PDF</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Date From</label>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="ui-input" />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Date To</label>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="ui-input" />
                    </div>
                </div>

                <div>
                    <p className="text-sm text-[var(--text-muted)] mb-2">Include Fields</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {allFields.map((field) => (
                            <label key={field} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-1.5">
                                <input
                                    type="checkbox"
                                    checked={selectedFields.includes(field)}
                                    onChange={() => toggleField(field)}
                                    className="h-4 w-4 accent-[var(--brand)]"
                                />
                                <span>{field}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <ActionButton onClick={() => setOpenDialog(true)} className="inline-flex items-center gap-2">
                    <FileDown className="h-4 w-4" />
                    Generate Export
                </ActionButton>
            </FilterBar>

            <ExportDialog
                open={openDialog}
                title="Confirm Export"
                confirmLabel="Start Export"
                onClose={() => setOpenDialog(false)}
                onConfirm={() => setOpenDialog(false)}
            >
                <div className="space-y-2 text-sm">
                    <p><strong>Export Type:</strong> {exportType}</p>
                    <p><strong>Format:</strong> {format.toUpperCase()}</p>
                    <p><strong>Date Range:</strong> {dateFrom || "—"} to {dateTo || "—"}</p>
                    <p><strong>Fields:</strong> {selectedFields.join(", ") || "None selected"}</p>
                </div>
            </ExportDialog>
        </div>
    )
}
