"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"
import ExportDialog from "@/components/shared/ExportDialog"

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
            <div>
                <h1 className="text-3xl font-bold">Export Guards</h1>
                <p className="text-gray-600 mt-1">Generate guard exports with custom fields and date range filters</p>
            </div>

            <div className="bg-white rounded-lg border p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Export Type</label>
                        <select value={exportType} onChange={(e) => setExportType(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="summary">Summary Export</option>
                            <option value="detailed">Detailed Export</option>
                            <option value="verification">Verification Export</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Format</label>
                        <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full border rounded-md px-3 py-2">
                            <option value="excel">Excel</option>
                            <option value="pdf">PDF</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Date From</label>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Date To</label>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                    </div>
                </div>

                <div>
                    <p className="text-sm text-gray-600 mb-2">Include Fields</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {allFields.map((field) => (
                            <label key={field} className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedFields.includes(field)}
                                    onChange={() => toggleField(field)}
                                    className="rounded"
                                />
                                <span>{field}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <button onClick={() => setOpenDialog(true)} className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <FileDown className="h-4 w-4" />
                    Generate Export
                </button>
            </div>

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
