"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"

type Lookup = { id: string; name: string }
type TicketRow = {
  id: string
  subject: string
  sender?: { id: string; name: string } | null
  assignedTo?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  priority?: { id: string; name: string } | null
  status?: { id: string; name: string } | null
  createdAt: string
}

export default function TicketListManager() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [categories, setCategories] = useState<Lookup[]>([])
  const [priorities, setPriorities] = useState<Lookup[]>([])
  const [statuses, setStatuses] = useState<Lookup[]>([])
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [priorityId, setPriorityId] = useState("")
  const [statusId, setStatusId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set("search", search.trim())
      if (categoryId) params.set("categoryId", categoryId)
      if (priorityId) params.set("priorityId", priorityId)
      if (statusId) params.set("statusId", statusId)
      const response = await fetch(`/api/tickets?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to fetch tickets.")
      setTickets(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to fetch tickets.")
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadLookups() {
      try {
        const [catRes, prioRes, statusRes] = await Promise.all([
          fetch("/api/tickets/categories", { cache: "no-store" }),
          fetch("/api/tickets/priorities", { cache: "no-store" }),
          fetch("/api/tickets/statuses", { cache: "no-store" }),
        ])
        const [catJson, prioJson, statusJson] = await Promise.all([
          catRes.json().catch(() => []),
          prioRes.json().catch(() => []),
          statusRes.json().catch(() => []),
        ])
        if (cancelled) return
        setCategories(Array.isArray(catJson) ? catJson : [])
        setPriorities(Array.isArray(prioJson) ? prioJson : [])
        setStatuses(Array.isArray(statusJson) ? statusJson : [])
      } catch {
        // keep page usable even if lookup calls fail
      }
    }

    void loadLookups()
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const statusVariant = useMemo(
    () => ({
      new: "neutral",
      "in-progress": "warning",
      closed: "success",
      resolved: "success",
    } as Record<string, "neutral" | "warning" | "success" | "danger">),
    []
  )

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Ticketing"
        subtitle="Track and manage support tickets."
        action={
          <Link className="ui-btn ui-btn-primary" href="/tickets/new">
            Create Ticket
          </Link>
        }
      />
      {error ? <InlineAlert type="error" message={error} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
            <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Subject/description" />
          </div>
          <SelectField label="Category" value={categoryId} onChange={setCategoryId} rows={categories} />
          <SelectField label="Priority" value={priorityId} onChange={setPriorityId} rows={priorities} />
          <SelectField label="Status" value={statusId} onChange={setStatusId} rows={statuses} />
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => {
              setSearch("")
              setCategoryId("")
              setPriorityId("")
              setStatusId("")
              void load()
            }}
          >
            Clear
          </ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={tickets}
        columns={[
          { key: "subject", header: "Subject", sortable: true },
          { key: "sender", header: "Sender", render: (row) => row.sender?.name || "—", sortable: true },
          { key: "assignedTo", header: "Assigned To", render: (row) => row.assignedTo?.name || "—", sortable: true },
          { key: "category", header: "Category", render: (row) => row.category?.name || "—", sortable: true },
          { key: "priority", header: "Priority", render: (row) => row.priority?.name || "—", sortable: true },
          {
            key: "status",
            header: "Status",
            render: (row) => {
              const label = row.status?.name || "Unknown"
              return (
                <StatusChip
                  label={label}
                  variant={statusVariant[label.toLowerCase()] || "neutral"}
                />
              )
            },
            sortable: true,
          },
          {
            key: "createdAt",
            header: "Created",
            render: (row) => new Date(row.createdAt).toLocaleDateString("en-US"),
            sortable: true,
          },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading tickets..." : "No tickets found."}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows: Lookup[]
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </div>
  )
}
