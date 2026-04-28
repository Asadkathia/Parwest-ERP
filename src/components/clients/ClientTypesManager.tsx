"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import { Card, CardContent } from "@/components/shadcn/card"
import { Button } from "@/components/shadcn/button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type ClientTypeRow = {
    id: string
    name: string
    label: string
    createdAt: string
}

export default function ClientTypesManager() {
    const [rows, setRows] = useState<ClientTypeRow[]>([])
    const [label, setLabel] = useState("")
    const [search, setSearch] = useState("")
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState("")
    const [error, setError] = useState("")

    const load = async () => {
        setLoading(true)
        setError("")
        try {
            const res = await fetch("/api/client-types", { cache: "no-store" })
            const data = await res.json().catch(() => [])
            if (!res.ok) throw new Error(data?.message || "Failed to load client types.")
            setRows(Array.isArray(data) ? data : [])
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load client types.")
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { void load() }, [])

    const visibleRows = useMemo(() => {
        if (!search.trim()) return rows
        const q = search.toLowerCase()
        return rows.filter((r) => r.label.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
    }, [rows, search])

    const create = async () => {
        setNotice("")
        setError("")
        const trimmed = label.trim()
        if (!trimmed) { setError("Label is required."); return }
        setSaving(true)
        try {
            const res = await fetch("/api/client-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: trimmed }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || "Failed to create client type.")
            setNotice(`"${trimmed}" added successfully.`)
            setLabel("")
            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create client type.")
        } finally {
            setSaving(false)
        }
    }

    const remove = async (id: string, rowLabel: string) => {
        if (!confirm(`Delete client type "${rowLabel}"? This cannot be undone.`)) return
        setNotice("")
        setError("")
        try {
            const res = await fetch(`/api/client-types/${id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || "Failed to delete.")
            setNotice(`"${rowLabel}" deleted.`)
            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to delete client type.")
        }
    }

    return (
        <div className="space-y-6">
            <SectionTitle
                title="Client Types"
                subtitle="Manage the client types available when adding a new client. Changes reflect immediately in the Add Client form."
            />
            {notice && <InlineAlert type="success" message={notice} />}
            {error && <InlineAlert type="error" message={error} />}

            <Card>
                <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">New Client Type Label</label>
                        <input
                            className="ui-input"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && void create()}
                            placeholder='e.g. "Security Firm"'
                        />
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                            The system key is auto-derived (e.g. <code>SECURITY_FIRM</code>).
                        </p>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
                        <input
                            className="ui-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search types…"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={create} disabled={saving}>
                        {saving ? "Saving…" : "Add Type"}
                    </Button>
                    <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                        Refresh
                    </Button>
                </div>
                </CardContent>
            </Card>

            <DataTable
                rows={visibleRows}
                columns={[
                    { key: "label", header: "Label", sortable: true },
                    { key: "name", header: "System Key", sortable: true },
                    {
                        key: "createdAt",
                        header: "Created",
                        sortable: true,
                        render: (row) => new Date(row.createdAt).toLocaleDateString("en-US"),
                    },
                    {
                        key: "action",
                        header: "Action",
                        render: (row) => (
                            <button
                                className="text-red-600 hover:underline text-sm"
                                onClick={() => void remove(row.id, row.label)}
                            >
                                Delete
                            </button>
                        ),
                    },
                ]}
                rowKey="id"
                searchable={false}
                emptyText={loading ? "Loading…" : "No client types found."}
            />
        </div>
    )
}
