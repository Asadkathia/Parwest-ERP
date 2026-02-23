"use client"

import { useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"

type RelationshipRow = {
  id: string
  manager: string
  supervisor: string
  effectiveDate: string
  status: string
}

const managers = ["Muhammad Nazir", "Fazal Mehdi", "Haider Ali"]
const supervisors = ["Muhammad Aslam", "Safdar Ali", "Imtiaz Hussain"]

const initialRows: RelationshipRow[] = [
  { id: "1", manager: "Muhammad Nazir", supervisor: "Muhammad Aslam", effectiveDate: "2026-02-01", status: "ACTIVE" },
]

export default function MsRelationshipManager() {
  const [rows, setRows] = useState<RelationshipRow[]>(initialRows)
  const [manager, setManager] = useState("")
  const [supervisor, setSupervisor] = useState("")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [notes, setNotes] = useState("")

  const filtered = useMemo(() => {
    if (!manager && !supervisor) return rows
    return rows.filter((row) => {
      if (manager && row.manager !== manager) return false
      if (supervisor && row.supervisor !== supervisor) return false
      return true
    })
  }, [rows, manager, supervisor])

  const assign = () => {
    if (!manager || !supervisor) return
    setRows((prev) => [
      { id: String(prev.length + 1), manager, supervisor, effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10), status: "ACTIVE" },
      ...prev,
    ])
    setNotes("")
  }

  const clear = () => {
    setManager("")
    setSupervisor("")
    setEffectiveDate("")
    setNotes("")
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="M/S Relationship" subtitle="Assign managers to supervisors." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Manager</label>
            <select className="ui-select" value={manager} onChange={(e) => setManager(e.target.value)}>
              <option value="">-- Select Manager --</option>
              {managers.map((item) => (
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
          <div>
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
          { key: "manager", header: "Manager" },
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

