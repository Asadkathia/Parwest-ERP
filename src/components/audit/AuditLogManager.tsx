"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type LogRow = {
  id: string
  event: string
  module: string
  description?: string | null
  ipAddress?: string | null
  createdAt: string
  user?: { id: string; name: string; email?: string } | null
}

type RegionOption = { id: string; name: string }

export default function AuditLogManager({
  regionId,
  regions = [],
  locked = false,
}: {
  regionId?: string
  regions?: RegionOption[]
  locked?: boolean
} = {}) {
  const [rows, setRows] = useState<LogRow[]>([])
  const [moduleFilter, setModuleFilter] = useState("")
  const [eventFilter, setEventFilter] = useState("")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const modules = useMemo(
    () => Array.from(new Set(rows.map((row) => row.module))).sort((a, b) => a.localeCompare(b)),
    [rows]
  )
  const events = useMemo(
    () => Array.from(new Set(rows.map((row) => row.event))).sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (moduleFilter) params.set("module", moduleFilter)
      if (eventFilter) params.set("event", eventFilter)
      if (search.trim()) params.set("search", search.trim())
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      if (regionId) params.set("regionId", regionId)
      const response = await fetch(`/api/audit-logs?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to load audit logs.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit logs.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, eventFilter, moduleFilter, regionId, search])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <SectionTitle title="Audit Logs" subtitle="Review module actions and activity history." />
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Suspense>
            <RegionUrlPicker regions={regions} locked={locked} includeGlobalOption={!locked} />
          </Suspense>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Module</label>
            <select className="ui-select" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">All</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Event</label>
            <select className="ui-select" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="">All</option>
              {events.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
            <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="module/event/user" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">From</label>
            <input className="ui-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">To</label>
            <input className="ui-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => {
              setModuleFilter("")
              setEventFilter("")
              setSearch("")
              setDateFrom("")
              setDateTo("")
              void load()
            }}
          >
            Clear
          </ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={rows}
        columns={[
          { key: "createdAt", header: "Timestamp", render: (row) => new Date(row.createdAt).toLocaleString("en-US"), sortable: true },
          { key: "module", header: "Module", sortable: true },
          { key: "event", header: "Event", sortable: true, render: (row) => <StatusChip label={row.event} variant="neutral" /> },
          { key: "user", header: "User", render: (row) => row.user?.name || "System", sortable: true },
          { key: "description", header: "Description", render: (row) => row.description || "—" },
          { key: "ipAddress", header: "IP", render: (row) => row.ipAddress || "—", sortable: true },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading logs..." : "No audit logs found."}
      />
    </div>
  )
}
