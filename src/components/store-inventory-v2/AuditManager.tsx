"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet } from "@/components/store-inventory-v2/api"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type Row = {
  id: string
  event: string
  module: string
  ipAddress?: string | null
  description?: string | null
  createdAt: string
  user?: { id: string; name: string; email: string } | null
}

type RegionOption = { id: string; name: string }

export default function AuditManager({
  regions = [],
  locked = false,
}: {
  regions?: RegionOption[]
  locked?: boolean
} = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const data = await apiGet<Row[]>("/api/audit-logs?module=INVENTORY_V2")
      setRows(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load audit logs."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase().trim()
    return rows.filter((row) => `${row.event} ${row.module} ${row.description || ""} ${row.user?.name || ""}`.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <div className="space-y-6">
      <SectionTitle title="Audits" subtitle="Inventory v2 mutation audit logs." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Suspense>
            <RegionUrlPicker regions={regions} locked={locked} includeGlobalOption={false} />
          </Suspense>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
            <input className="ui-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by event/user/description" />
          </div>
        </div>
      </FilterBar>

      <DataTable
        rows={visible}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading audit logs..." : "No inventory v2 audit logs found."}
        columns={[
          { key: "event", header: "Event", sortable: true },
          { key: "module", header: "Module", sortable: true },
          { key: "user", header: "User", render: (row) => row.user?.name || "System" },
          { key: "ipAddress", header: "IP", render: (row) => row.ipAddress || "—" },
          { key: "description", header: "Description", render: (row) => row.description || "—" },
          { key: "createdAt", header: "Date", render: (row) => new Date(row.createdAt).toLocaleString("en-US") },
        ]}
      />
    </div>
  )
}
