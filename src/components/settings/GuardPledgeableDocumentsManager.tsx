"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import { Button } from "@/components/shadcn/button"
import DataTable from "@/components/shared/DataTable"
type DocumentRow = {
  id: string
  name: string
  description?: string | null
  createdAt?: string
}

export default function GuardPledgeableDocumentsManager() {
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback
  const [rows, setRows] = useState<DocumentRow[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await fetch("/api/guard-pledgeable-documents", { cache: "no-store" })
      // /api/guard-pledgeable-documents GET now wraps success as `ok(rows)` → `{success, data: [...]}`.
      // Errors still carry `{success:false, message}` at top level. Accept either shape.
      const raw = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(raw?.message || "Failed to load document types.")
      const next = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
      setRows(next)
    } catch (error: unknown) {
      setRows([])
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to load document types.") })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reset = () => {
    setEditingId(null)
    setName("")
    setDescription("")
  }

  const save = async () => {
    setNotice(null)
    if (!name.trim()) {
      setNotice({ type: "error", message: "Document type name is required." })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(
        editingId ? `/api/guard-pledgeable-documents/${editingId}` : "/api/guard-pledgeable-documents",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to save document type.")
      setNotice({ type: "success", message: editingId ? "Document type updated." : "Document type created." })
      reset()
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to save document type.") })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setNotice(null)
    try {
      const response = await fetch(`/api/guard-pledgeable-documents/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete document type.")
      setNotice({ type: "success", message: "Document type deleted." })
      if (editingId === id) reset()
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to delete document type.") })
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) => `${row.name} ${row.description || ""}`.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Settings: Guard Pledgeable Document Types"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage document types accepted in guard pledges."}</p></div></div>
      {notice ? ((notice.type) === "success" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert> : <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert>) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Document Type *</label>
              <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Document type" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
              <input className="ui-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
              <input className="ui-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search types" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
            <Button variant="secondary" onClick={reset}>Reset</Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        rows={filtered}
        columns={[
          { key: "name", header: "Document Type", sortable: true },
          { key: "description", header: "Description", render: (row) => row.description || "—" },
          {
            key: "edit",
            header: "Edit",
            render: (row) => (
              <button
                className="text-[var(--brand)] hover:underline"
                onClick={() => {
                  setEditingId(row.id)
                  setName(row.name)
                  setDescription(row.description || "")
                }}
              >
                Edit
              </button>
            ),
          },
          {
            key: "delete",
            header: "Delete",
            render: (row) => (
              <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>
                Delete
              </button>
            ),
          },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading document types..." : "No document types found."}
      />
    </div>
  )
}
