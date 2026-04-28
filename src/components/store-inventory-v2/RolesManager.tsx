"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import DataTable from "@/components/shared/DataTable"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Role = {
  id: string
  name: string
  description?: string | null
}

const EMPTY_FORM = {
  name: "",
  description: "",
}

export default function RolesManager() {
  const [rows, setRows] = useState<Role[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const data = await apiGet<Role[]>("/api/roles")
      setRows(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load roles."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => `${row.name} ${row.description || ""}`.toLowerCase().includes(q))
  }, [rows, query])

  const createRole = async () => {
    const name = form.name.trim()
    if (!name) {
      setNotice({ type: "error", message: "Role name is required." })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      await apiSend<Role>("/api/roles", "POST", {
        name,
        description: form.description.trim() || null,
      })
      setNotice({ type: "success", message: "Role created successfully." })
      setForm(EMPTY_FORM)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create role."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Roles"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage inventory role definitions used by inventory users."}</p></div></div>
      {notice ? ((notice.type) === "success" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert> : <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert>) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Role Name *</label>
            <input
              className="ui-input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
            <input
              className="ui-input"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void createRole()} disabled={saving}>
            {saving ? "Saving..." : "Create Role"}
          </Button>
          <Button variant="secondary" onClick={() => setForm(EMPTY_FORM)}>
            Reset
          </Button>
        </div>
      </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
          <input
            className="ui-input"
            placeholder="Search by role name or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </CardContent>
      </Card>

      <DataTable
        rows={visibleRows}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading roles..." : "No roles found."}
        columns={[
          { key: "name", header: "Role Name", sortable: true },
          { key: "description", header: "Description", render: (row) => row.description || "—" },
        ]}
      />
    </div>
  )
}
