"use client"

import { useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"

type RelationshipRow = {
  id: string
  client: string
  branch: string
  supervisor: string
  effectiveDate: string
  status: string
}

const clients = ["National Bank of Pakistan", "Meezan Bank Limited", "United Bank Limited"]
const branches = ["NBP Head Office", "NBP Jail Road", "Meezan Main Branch", "UBL Gulberg"]
const supervisors = ["Muhammad Aslam", "Safdar Ali", "Imtiaz Hussain"]

const initialRows: RelationshipRow[] = [
  { id: "1", client: "National Bank of Pakistan", branch: "NBP Head Office", supervisor: "Muhammad Aslam", effectiveDate: "2026-02-01", status: "ACTIVE" },
]

export default function CsRelationshipManager() {
  const [rows, setRows] = useState<RelationshipRow[]>(initialRows)
  const [client, setClient] = useState("")
  const [branch, setBranch] = useState("")
  const [supervisor, setSupervisor] = useState("")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [notes, setNotes] = useState("")

  const filtered = useMemo(() => {
    if (!client && !branch && !supervisor) return rows
    return rows.filter((row) => {
      if (client && row.client !== client) return false
      if (branch && row.branch !== branch) return false
      if (supervisor && row.supervisor !== supervisor) return false
      return true
    })
  }, [rows, client, branch, supervisor])

  const assign = () => {
    if (!client || !branch || !supervisor) return
    setRows((prev) => [
      { id: String(prev.length + 1), client, branch, supervisor, effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10), status: "ACTIVE" },
      ...prev,
    ])
    setNotes("")
  }

  const clear = () => {
    setClient("")
    setBranch("")
    setSupervisor("")
    setEffectiveDate("")
    setNotes("")
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="C/S Relationship" subtitle="Assign client branches to supervisors." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Client</label>
            <select className="ui-select" value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="">-- Select Client --</option>
              {clients.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Branch</label>
            <select className="ui-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">-- Select Branch --</option>
              {branches.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Supervisor</label>
            <select className="ui-select" value={supervisor} onChange={(e) => setSupervisor(e.target.value)}>
              <option value="">-- Select Supervisor --</option>
              {supervisors.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Effective Date</label>
            <input className="ui-input" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Notes</label>
            <input className="ui-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={assign}>Assign</ActionButton>
          <ActionButton variant="secondary" onClick={clear}>Clear</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={filtered}
        columns={[
          { key: "client", header: "Client" },
          { key: "branch", header: "Branch" },
          { key: "supervisor", header: "Supervisor" },
          { key: "effectiveDate", header: "Effective Date" },
          { key: "status", header: "Status" },
          { key: "action", header: "Action", render: () => "Edit" },
        ]}
        getRowKey={(row) => row.id}
        emptyText="No relationship records."
        searchable={false}
      />
    </div>
  )
}

