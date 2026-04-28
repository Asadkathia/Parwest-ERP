"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Badge } from "@/components/shadcn/badge"
import { Card, CardContent } from "@/components/shadcn/card"
import DataTable from "@/components/shared/DataTable"
type RequisitionRow = {
  id: string
  title: string
  description?: string | null
  module: string
  priority: string
  status: string
  requester?: { id: string; name: string } | null
  approver?: { id: string; name: string } | null
  createdAt: string
}

const MODULE_OPTIONS = ["GUARDS", "PAYROLL", "CLIENTS", "INVENTORY", "USERS", "REPORTS", "SETTINGS"]
const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "CRITICAL"]

export default function RequisitionsManager() {
  const [rows, setRows] = useState<RequisitionRow[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [moduleName, setModuleName] = useState("GUARDS")
  const [priority, setPriority] = useState("NORMAL")
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      if (search.trim()) params.set("search", search.trim())
      const response = await fetch(`/api/requisitions?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to fetch requisitions.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to fetch requisitions.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    setNotice("")
    setError("")
    if (!title.trim()) {
      setError("Title is required.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          module: moduleName,
          priority,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create requisition.")
      setNotice("Requisition created.")
      setTitle("")
      setDescription("")
      setModuleName("GUARDS")
      setPriority("NORMAL")
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create requisition.")
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    setNotice("")
    setError("")
    try {
      const response = await fetch(`/api/requisitions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || `Failed to mark requisition ${status.toLowerCase()}.`)
      setNotice(`Requisition ${status.toLowerCase()}.`)
      await load()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update requisition.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Requisitions"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Create and approve/reject module requisitions."}</p></div></div>
      {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}
      {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Title</label>
              <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Requisition title" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Module</label>
              <select className="ui-select" value={moduleName} onChange={(e) => setModuleName(e.target.value)}>
                {MODULE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Priority</label>
              <select className="ui-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
              <textarea className="ui-textarea min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={create} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Status Filter</label>
              <select className="ui-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
              <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title/description" />
            </div>
            <div className="flex items-end">
              <Button onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        rows={rows}
        columns={[
          { key: "title", header: "Title", sortable: true },
          { key: "module", header: "Module", sortable: true },
          { key: "priority", header: "Priority", sortable: true },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{row.status}</Badge>
            ),
            sortable: true,
          },
          { key: "requester", header: "Requester", render: (row) => row.requester?.name || "—", sortable: true },
          { key: "approver", header: "Approver", render: (row) => row.approver?.name || "—", sortable: true },
          { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleDateString("en-US"), sortable: true },
          {
            key: "action",
            header: "Action",
            render: (row) =>
              row.status === "PENDING" ? (
                <div className="flex gap-2">
                  <button className="text-green-600 hover:underline" onClick={() => void updateStatus(row.id, "APPROVED")}>Approve</button>
                  <button className="text-red-600 hover:underline" onClick={() => void updateStatus(row.id, "REJECTED")}>Reject</button>
                </div>
              ) : (
                "—"
              ),
          },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading requisitions..." : "No requisitions found."}
      />
    </div>
  )
}
