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
const fallbackClients: Client[] = [
  { id: "National Bank of Pakistan", name: "National Bank of Pakistan" },
  { id: "Standard Chartered Bank Limited Pakistan", name: "Standard Chartered Bank Limited Pakistan" },
  { id: "United Bank Limited", name: "United Bank Limited" },
  { id: "MCB Bank Ltd", name: "MCB Bank Ltd" },
]

const managers = [
  "Anayat Ullah MT",
  "Ashfaq Ali",
  "Capt M Baqar FSD",
  "GHULAM BAQIR KHAN Zone II III",
  "Ghulam Qadir MT",
  "Haji Umar Daraz Sahiwal",
  "hashir",
  "JAHANGIR KHAN KHI Z II",
  "Muhammad Afzal Abid",
  "Muhammad Arshad",
  "Muhammad Farhan Abbas",
  "Muhammad Nazir",
  "Muhammad Shabbir",
  "Muhammad Tayyab",
  "Qaisar Mehmood Kiani",
  "Riaz Ahmad",
  "SAJJAD HUSSAIN KHI Z I",
  "usman",
  "Waqar Ahmad",
  "Waqas Nasir Mehmood",
  "ZULFIQAR AHMED KHI Z III",
]

const baseRows: Array<Omit<ExportRow, "clientId"> & { clientName: string }> = [
  { id: "1", name: "NBP Head Office", supervisor: "Muhammad Aslam", manager: "Muhammad Nazir", clientName: "National Bank of Pakistan" },
  { id: "2", name: "NBP Jail Road", supervisor: "Fazal Mehdi", manager: "Muhammad Nazir", clientName: "National Bank of Pakistan" },
  { id: "3", name: "Standard Chartered Main", supervisor: "Safiar Ali", manager: "Muhammad Arshad", clientName: "Standard Chartered Bank Limited Pakistan" },
  { id: "4", name: "UBL Ravi Road", supervisor: "Haider Ali", manager: "Muhammad Farhan Abbas", clientName: "United Bank Limited" },
  { id: "5", name: "MCB Gulberg", supervisor: "Imtiaz Hussain", manager: "Muhammad Tayyab", clientName: "MCB Bank Ltd" },
]

export default function ExportBranchesManager() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedManager, setSelectedManager] = useState("")
  const [selectedClient, setSelectedClient] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [rows, setRows] = useState<ExportRow[]>([])

  const exportFieldOptions = [
    "check_box_1",
    "check_box_2",
    "check_box_3",
    "check_box_4",
    "check_box_5",
    "check_box_6",
    "check_box_7",
    "check_box_8",
    "check_box_9",
    "check_box_10",
    "check_box_15",
    "check_box_16",
    "check_box_19",
    "check_box_22",
    "check_box_25",
    "check_box_26",
    "check_box_27",
    "check_box_28",
    "check_box_29",
    "check_box_30",
    "check_box_31",
    "check_box_32",
  ]

  useEffect(() => {
    const load = async () => {
      try {
        setError("")
        const response = await fetch("/api/clients")
        if (!response.ok) throw new Error("Failed to load clients")
        const data = (await response.json()) as Client[]
        setClients(data)
        setRows(
          baseRows.map((row, index) => ({
            id: row.id,
            name: row.name,
            supervisor: row.supervisor,
            manager: row.manager,
            clientId:
              data.find((client) => client.name === row.clientName)?.id ||
              data[index % Math.max(1, data.length)]?.id ||
              "",
          }))
        )
      } catch {
        setClients(fallbackClients)
        setRows(
          baseRows.map((row) => ({
            id: row.id,
            name: row.name,
            supervisor: row.supervisor,
            manager: row.manager,
            clientId: fallbackClients.find((client) => client.name === row.clientName)?.id || row.clientName,
          }))
        )
        setError("Could not load clients. Showing available mock rows.")
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedManager && row.manager !== selectedManager) return false
      if (selectedClient && row.clientId !== selectedClient) return false
      return true
    })
  }, [rows, selectedManager, selectedClient])

  const handleSubmit = () => {
    setNotice(`Prepared ${filtered.length} branch record(s) with ${selectedFields.length} selected field(s).`)
  }

  const handleExport = () => {
    setNotice(`Export simulated for ${filtered.length} branch record(s).`)
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Export Client Branches" subtitle="Filter by manager/client and export branch ownership mapping." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Manager</label>
            <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)} className="ui-select">
              <option value="">--Select Manager--</option>
              {managers.map((manager) => (
                <option key={manager} value={manager}>{manager}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Client</label>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="ui-select">
              <option value="">--Select Client--</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm text-[var(--text-muted)]">select_all_checkbox</label>
          <div className="mb-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedFields.length === exportFieldOptions.length}
                onChange={(e) => setSelectedFields(e.target.checked ? exportFieldOptions : [])}
              />
              Select All
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {exportFieldOptions.map((field) => (
              <label key={field} className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={(e) =>
                    setSelectedFields((prev) =>
                      e.target.checked ? [...prev, field] : prev.filter((x) => x !== field)
                    )
                  }
                />
                {field}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={handleSubmit} className="inline-flex items-center gap-2"><Filter className="h-4 w-4" />Submit</ActionButton>
          <ActionButton onClick={handleExport} variant="secondary" className="inline-flex items-center gap-2"><Download className="h-4 w-4" />Export Excel</ActionButton>
        </div>
      </FilterBar>

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

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
