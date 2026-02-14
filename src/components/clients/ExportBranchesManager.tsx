"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Filter } from "lucide-react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type Client = { id: string; name: string }
type ExportRow = { id: string; name: string; supervisor: string; manager: string; clientId: string }

const managers = ["Muhammad Nazir", "Fazal Mehdi", "Haider Ali", "Safiar Ali"]
const allRows: ExportRow[] = [
  { id: "1", name: "NBP Head Office", supervisor: "Muhammad Aslam", manager: "Muhammad Nazir", clientId: "" },
  { id: "2", name: "NBP Jail Road", supervisor: "Fazal Mehdi", manager: "Muhammad Nazir", clientId: "" },
  { id: "3", name: "Meezan Main Branch", supervisor: "Safiar Ali", manager: "Fazal Mehdi", clientId: "" },
]

export default function ExportBranchesManager() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedManager, setSelectedManager] = useState("")
  const [selectedClient, setSelectedClient] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        setError("")
        const response = await fetch("/api/clients")
        if (!response.ok) throw new Error("Failed to load clients")
        const data = await response.json()
        setClients(data)
      } catch {
        setClients([])
        setError("Could not load clients. Showing available mock rows.")
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      if (selectedManager && row.manager !== selectedManager) return false
      if (selectedClient && row.clientId !== selectedClient) return false
      return true
    })
  }, [selectedManager, selectedClient])

  return (
    <div className="space-y-6">
      <SectionTitle title="Export Client Branches" subtitle="Filter by manager/client and export branch ownership mapping." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Manager</label>
            <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)} className="ui-select">
              <option value="">All Managers</option>
              {managers.map((manager) => (
                <option key={manager} value={manager}>{manager}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Client</label>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="ui-select">
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton className="inline-flex items-center gap-2"><Filter className="h-4 w-4" />Submit</ActionButton>
          <ActionButton variant="secondary" className="inline-flex items-center gap-2"><Download className="h-4 w-4" />Export Excel</ActionButton>
        </div>
      </FilterBar>

      {error ? <InlineAlert type="error" message={error} /> : null}

      <DataTable
        rows={filtered}
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "supervisor", header: "Supervisor", sortable: true },
          { key: "manager", header: "Manager", sortable: true },
        ]}
        getRowKey={(row) => row.id}
        emptyText="No Record Found"
        searchable={false}
      />
    </div>
  )
}
