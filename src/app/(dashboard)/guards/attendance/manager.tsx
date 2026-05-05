"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle, Download } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type Props = {
    regions?: { id: string; name: string }[]
    regionLocked?: boolean
}

export default function GuardAttendanceManager({
    regions = [],
    regionLocked = false,
}: Props = {}) {
    const searchParams = useSearchParams()
    const [parwestId, setParwestId] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")

    const exportToExcel = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setNotice("")

        if (!parwestId.trim()) {
            setError("Secure Ops ID is required to export.")
            return
        }

        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set("parwestId", parwestId.trim())
            if (startDate) params.set("startDate", startDate)
            if (endDate) params.set("endDate", endDate)
            const regionId = searchParams.get("regionId")
            const regionalOfficeId = searchParams.get("regionalOfficeId")
            if (regionId) params.set("regionId", regionId)
            if (regionalOfficeId) params.set("regionalOfficeId", regionalOfficeId)

            const response = await fetch(`/api/attendance/export?${params.toString()}`)
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to export attendance")
            }

            const blob = await response.blob()
            const disposition = response.headers.get("Content-Disposition") || ""
            const match = disposition.match(/filename="?([^";]+)"?/)
            const filename = match?.[1] || `attendance_${parwestId.trim()}.xlsx`

            const url = window.URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)

            setNotice(`Exported attendance for ${parwestId.trim()}.`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unexpected error")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Attendance Export</h1>
                <p className="text-gray-600 mt-1">
                    Export attendance for an individual guard as an Excel file.
                </p>
            </div>

            <form
                onSubmit={exportToExcel}
                className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-5 gap-4"
            >
                <RegionUrlPicker
                    regions={regions}
                    locked={regionLocked}
                    includeGlobalOption={!regionLocked}
                />
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Secure Ops ID*</label>
                    <input
                        name="parwestId"
                        value={parwestId}
                        onChange={(e) => setParwestId(e.target.value)}
                        className="w-full border rounded-md px-3 py-2"
                        placeholder="Secure Ops ID"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full border rounded-md px-3 py-2"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">End Date</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full border rounded-md px-3 py-2"
                    />
                </div>
                <div className="flex items-end">
                    <Button type="submit" disabled={loading} className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        {loading ? "Exporting..." : "Export to Excel"}
                    </Button>
                </div>
            </form>

            {error ? (
                <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            {notice ? (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>{notice}</AlertDescription>
                </Alert>
            ) : null}
        </div>
    )
}
