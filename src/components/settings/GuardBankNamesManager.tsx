"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import { Button } from "@/components/shadcn/button"
import DataTable from "@/components/shared/DataTable"
type BankRow = {
  id: string
  name: string
  createdAt?: string
}

export default function GuardBankNamesManager() {
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback
  const [rows, setRows] = useState<BankRow[]>([])
  const [name, setName] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const response = await fetch("/api/guard-bank-names", { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to load bank names.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (error: unknown) {
      setRows([])
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to load bank names.") })
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
  }

  const save = async () => {
    setNotice(null)
    if (!name.trim()) {
      setNotice({ type: "error", message: "Bank name is required." })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(
        editingId ? `/api/guard-bank-names/${editingId}` : "/api/guard-bank-names",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to save bank name.")
      setNotice({ type: "success", message: editingId ? "Bank name updated." : "Bank name created." })
      reset()
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to save bank name.") })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setNotice(null)
    try {
      const response = await fetch(`/api/guard-bank-names/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete bank name.")
      setNotice({ type: "success", message: "Bank name deleted." })
      if (editingId === id) reset()
      await load()
    } catch (error: unknown) {
      setNotice({ type: "error", message: getErrorMessage(error, "Failed to delete bank name.") })
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) => row.name.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Settings: Guard Bank Names"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage allowed banks for guard account entries."}</p></div></div>
      {notice ? ((notice.type) === "success" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert> : <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert>) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Bank Name *</label>
              <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Bank name" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
              <input className="ui-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search banks" />
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
          { key: "name", header: "Bank Name", sortable: true },
          {
            key: "edit",
            header: "Edit",
            render: (row) => (
              <button
                className="text-[var(--brand)] hover:underline"
                onClick={() => {
                  setEditingId(row.id)
                  setName(row.name)
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
        emptyText={loading ? "Loading bank names..." : "No bank names found."}
      />
    </div>
  )
}
