"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/shadcn/button"
import { PermissionGate } from "@/components/shadcn/permission-gate"

type ExportKind = "assigned-guards" | "extra-guards" | "branches"

const KIND_PATH: Record<ExportKind, (clientId: string) => string> = {
    "assigned-guards": (clientId) => `/api/clients/${clientId}/guards/export`,
    "extra-guards": (clientId) => `/api/clients/${clientId}/extra-guards/export`,
    branches: (clientId) => `/api/clients/${clientId}/branches/export`,
}

export function ClientExportButton({
    clientId,
    kind,
    params,
    label,
}: {
    clientId: string
    kind: ExportKind
    params?: Record<string, string | undefined>
    label?: string
}): React.JSX.Element {
    const [loading, setLoading] = React.useState(false)

    const buildUrl = React.useCallback(() => {
        const base = KIND_PATH[kind](clientId)
        const qs = new URLSearchParams()
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value != null && value !== "") qs.set(key, value)
            }
        }
        const query = qs.toString()
        return query ? `${base}?${query}` : base
    }, [clientId, kind, params])

    const handleClick = React.useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(buildUrl())
            if (!res.ok) {
                let message = "Failed to export."
                try {
                    const data = await res.json()
                    if (data?.message) message = data.message
                } catch {
                    // non-JSON error body — keep default message
                }
                toast.error(message)
                return
            }

            const blob = await res.blob()
            const disposition = res.headers.get("Content-Disposition") || ""
            const match = /filename="?([^"]+)"?/.exec(disposition)
            const filename = match?.[1] || `client-${clientId}-${kind}.csv`

            const objectUrl = URL.createObjectURL(blob)
            const anchor = document.createElement("a")
            anchor.href = objectUrl
            anchor.download = filename
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(objectUrl)
        } catch (error) {
            console.error("Export failed:", error)
            toast.error("Failed to export.")
        } finally {
            setLoading(false)
        }
    }, [buildUrl, clientId, kind])

    return (
        <PermissionGate module="CLIENTS" action="VIEW" mode="disable">
            <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Download className="h-4 w-4" />
                )}
                {label || "Export CSV"}
            </Button>
        </PermissionGate>
    )
}

export default ClientExportButton
