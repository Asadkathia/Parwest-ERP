"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Search, RotateCcw } from "lucide-react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import InlineAlert from "@/components/ui/inline-alert"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"

type ClientRow = {
  id: string
  name: string
  type: string
  city: string | null
  isBranchless: boolean
  status: string
  logoUrl: string | null
}

type Props = {
  title: string
  subtitle: string
}

export default function ClientSearchManager({ title, subtitle }: Props) {
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [clientType, setClientType] = useState("")
  const [city, setCity] = useState("")

  const loadRows = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch("/api/clients")
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Failed to fetch clients")
      }
      const data = await response.json()
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch clients")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (name && !row.name.toLowerCase().includes(name.toLowerCase())) return false
      if (clientType && row.type.toLowerCase() !== clientType.toLowerCase()) return false
      if (city && !(row.city || "").toLowerCase().includes(city.toLowerCase())) return false
      return true
    })
  }, [rows, name, clientType, city])

  return (
    <div className="space-y-6">
      <SectionTitle title={title} subtitle={subtitle} />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="ui-input" placeholder="Enter client name" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Client Type</label>
            <select value={clientType} onChange={(e) => setClientType(e.target.value)} className="ui-select">
              <option value="">--Select Client Type--</option>
              <option value="BANK">Bank</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="RETAIL">Retail</option>
              <option value="CORPORATE">Corporate</option>
              <option value="GOVERNMENT">Government</option>
              <option value="RESIDENTIAL">Residential</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="ui-input" placeholder="--Select City--" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={loadRows} className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </ActionButton>
          <ActionButton
            variant="secondary"
            className="inline-flex items-center gap-2"
            onClick={() => {
              setName("")
              setClientType("")
              setCity("")
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Clear
          </ActionButton>
        </div>
      </FilterBar>

      {error ? <InlineAlert type="error" message={error} /> : null}

      <DataTable
        rows={loading ? [] : filtered}
        columns={[
          { key: "id", header: "ID" },
          {
            key: "logoUrl",
            header: "Logo",
            render: (row) =>
              row.logoUrl ? (
                <img src={row.logoUrl} alt={row.name} className="h-8 w-8 rounded-md object-cover border border-[var(--border)]" />
              ) : (
                <span className="text-[var(--text-muted)]">—</span>
              ),
          },
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link href={`/clients/${row.id}`} className="font-medium text-[var(--brand)] hover:underline">
                {row.name}
              </Link>
            ),
            sortable: true,
          },
          { key: "type", header: "Type", sortable: true },
          { key: "city", header: "City", render: (row) => row.city || "—", sortable: true },
          { key: "isBranchless", header: "Is Branchless", render: (row) => (row.isBranchless ? "Yes" : "No") },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <StatusChip
                label={row.status}
                variant={row.status.toLowerCase() === "active" ? "success" : row.status.toLowerCase() === "inactive" ? "warning" : "neutral"}
              />
            ),
          },
          {
            key: "action",
            header: "Action",
            render: (row) => (
              <div className="flex items-center gap-3">
                <Link href={`/clients/${row.id}`} className="text-[var(--brand)] hover:underline">
                  View
                </Link>
                <Link href={`/clients/${row.id}/edit`} className="text-emerald-700 hover:underline">
                  Edit
                </Link>
              </div>
            ),
          },
        ]}
        getRowKey={(row) => row.id}
        emptyText={loading ? "Loading clients..." : "No clients found."}
        searchPlaceholder="Search table rows..."
        stickyHeader
      />
    </div>
  )
}
