"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"

type Row = {
  id: string
  email: string
  blacklistedBy: string
  blacklistedOn: string
  reason?: string
}

const initialRows: Row[] = [
  { id: "1", email: "testing@testing.com", blacklistedBy: "SUPERUSER", blacklistedOn: "2018-05-28 07:14:05", reason: "Compliance hold" },
]

export default function ClientBlacklistManager() {
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [email, setEmail] = useState("")
  const [reason, setReason] = useState("")
  const [search, setSearch] = useState("")

  const filteredRows = useMemo(() => {
    if (!search) return rows
    return rows.filter((row) => row.email.toLowerCase().includes(search.toLowerCase()))
  }, [rows, search])

  const onAdd = () => {
    if (!email.trim()) return

    setRows((prev) => [
      {
        id: String(prev.length + 1),
        email: email.trim().toLowerCase(),
        blacklistedBy: "ADMIN",
        blacklistedOn: new Date().toISOString().replace("T", " ").slice(0, 19),
        reason: reason.trim() || undefined,
      },
      ...prev,
    ])
    setEmail("")
    setReason("")
  }

  const onDelete = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Black Listed Clients" subtitle="Manage blacklisted clients by email." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Email #</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ui-input" placeholder="client@example.com" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="ui-input" placeholder="Reason" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input" placeholder="Search by email" />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={onAdd}>Add</ActionButton>
          <ActionButton variant="secondary">Search</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={filteredRows}
        columns={[
          { key: "email", header: "Email #", sortable: true },
          { key: "blacklistedBy", header: "Black Listed By", sortable: true },
          { key: "blacklistedOn", header: "Black Listed On", sortable: true },
          {
            key: "action",
            header: "Action",
            render: (row) => (
              <button className="text-red-600 hover:underline" onClick={() => onDelete(row.id)}>
                Delete
              </button>
            ),
          },
        ]}
        getRowKey={(row) => row.id}
        emptyText="No blacklisted clients found."
        searchable={false}
      />
    </div>
  )
}
