"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import EmptyState from "@/components/ui/empty-state"
import InlineAlert from "@/components/ui/inline-alert"

type ClientTypeRow = { id: string; name: string; addedBy: string }
type DocumentTypeRow = { id: string; name: string; uniqueKey: string; createdAt: string }
type LocationRow = { id: string; locationName: string; createdBy: string; createdOn: string }

const TABS = ["All Client Types", "Client's Document Types", "Client Locations"] as const

const initialClientTypes: ClientTypeRow[] = [
  { id: "1", name: "Bank", addedBy: "SUPERUSER" },
  { id: "2", name: "Manufacturer", addedBy: "SUPERUSER" },
  { id: "3", name: "Other", addedBy: "SUPERUSER" },
]

const initialDocumentTypes: DocumentTypeRow[] = [
  { id: "1", name: "Verification Form", uniqueKey: "FE879B37B8", createdAt: "2018-01-29" },
  { id: "2", name: "Authentication Form", uniqueKey: "0AFC4214F", createdAt: "2018-01-29" },
  { id: "3", name: "File", uniqueKey: "8C700922AD", createdAt: "2018-02-08" },
]

const initialLocations: LocationRow[] = [
  { id: "1", locationName: "Lahore", createdBy: "SUPERUSER", createdOn: "2018-04-26" },
  { id: "2", locationName: "Gujranwala", createdBy: "SUPERUSER", createdOn: "2018-04-26" },
  { id: "3", locationName: "Multan", createdBy: "N/A", createdOn: "2018-05-17" },
]

export default function ClientTypesLocationsManager() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All Client Types")
  const [query, setQuery] = useState("")
  const [entries, setEntries] = useState("10")
  const [inputName, setInputName] = useState("")
  const [inputUniqueKey, setInputUniqueKey] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [clientTypes, setClientTypes] = useState<ClientTypeRow[]>(initialClientTypes)
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRow[]>(initialDocumentTypes)
  const [locations, setLocations] = useState<LocationRow[]>(initialLocations)

  const filteredClientTypes = useMemo(() => {
    if (!query) return clientTypes
    return clientTypes.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()))
  }, [clientTypes, query])

  const filteredDocumentTypes = useMemo(() => {
    if (!query) return documentTypes
    return documentTypes.filter(
      (row) => row.name.toLowerCase().includes(query.toLowerCase()) || row.uniqueKey.toLowerCase().includes(query.toLowerCase())
    )
  }, [documentTypes, query])

  const filteredLocations = useMemo(() => {
    if (!query) return locations
    return locations.filter((row) => row.locationName.toLowerCase().includes(query.toLowerCase()))
  }, [locations, query])

  const onAdd = () => {
    if (!inputName.trim()) {
      setError("Name is required.")
      return
    }
    setError("")

    if (activeTab === "All Client Types") {
      setClientTypes((prev) => [{ id: String(prev.length + 1), name: inputName.trim(), addedBy: "ADMIN" }, ...prev])
    } else if (activeTab === "Client's Document Types") {
      setDocumentTypes((prev) => [
        {
          id: String(prev.length + 1),
          name: inputName.trim(),
          uniqueKey: (inputUniqueKey.trim() || Math.random().toString(16).slice(2, 10)).toUpperCase(),
          createdAt: new Date().toISOString().slice(0, 10),
        },
        ...prev,
      ])
    } else {
      setLocations((prev) => [
        { id: String(prev.length + 1), locationName: inputName.trim(), createdBy: "ADMIN", createdOn: new Date().toISOString().slice(0, 10) },
        ...prev,
      ])
    }

    setInputName("")
    setInputUniqueKey("")
    setNotice("Record added.")
  }

  const onDelete = (id: string) => {
    if (activeTab === "All Client Types") setClientTypes((prev) => prev.filter((row) => row.id !== id))
    else if (activeTab === "Client's Document Types") setDocumentTypes((prev) => prev.filter((row) => row.id !== id))
    else setLocations((prev) => prev.filter((row) => row.id !== id))
    setNotice("Record deleted.")
  }

  const resetInputs = () => {
    setInputName("")
    setInputUniqueKey("")
    setQuery("")
    setNotice("Filters reset.")
  }

  const tabClass = (tab: (typeof TABS)[number]) =>
    `px-3 py-1.5 text-sm rounded-full border transition ${
      activeTab === tab
        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]"
    }`

  return (
    <div className="space-y-6">
      <SectionTitle title="Client Types & Locations" subtitle="Master data tables for client types, document types, and client locations." />

      <FilterBar className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
            <input value={inputName} onChange={(e) => setInputName(e.target.value)} className="ui-input" placeholder="Name" />
          </div>
          {activeTab === "Client's Document Types" ? (
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-1">Unique Key</label>
              <input value={inputUniqueKey} onChange={(e) => setInputUniqueKey(e.target.value)} className="ui-input" placeholder="Unique key" />
            </div>
          ) : (
            <div />
          )}
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Show</label>
            <select value={entries} onChange={(e) => setEntries(e.target.value)} className="ui-select">
              {["10", "25", "50", "100"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="ui-input" placeholder="Search rows" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onAdd}>Add</ActionButton>
          <ActionButton variant="secondary" onClick={resetInputs}>Reset</ActionButton>
          <ActionButton variant="secondary" onClick={() => setNotice("Changes submitted.")}>Submit</ActionButton>
        </div>
      </FilterBar>

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      {activeTab === "All Client Types" ? (
        <DataTable
          rows={filteredClientTypes.slice(0, Number.parseInt(entries, 10) || 10)}
          columns={[
            { key: "id", header: "Serial #", sortable: true },
            { key: "name", header: "Name", sortable: true },
            {
              key: "addedBy",
              header: "Added By",
              render: (row) => <StatusChip label={row.addedBy} variant="neutral" />,
            },
            {
              key: "action",
              header: "Action",
              render: (row) => (
                <button className="text-red-600 hover:underline" onClick={() => setConfirmDeleteId(row.id)}>
                  Delete
                </button>
              ),
            },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText="No client types found."
        />
      ) : activeTab === "Client's Document Types" ? (
        <DataTable
          rows={filteredDocumentTypes.slice(0, Number.parseInt(entries, 10) || 10)}
          columns={[
            { key: "name", header: "Name", sortable: true },
            { key: "uniqueKey", header: "Unique Key", sortable: true },
            { key: "createdAt", header: "Created At", sortable: true },
            {
              key: "action",
              header: "Action",
              render: (row) => (
                <button className="text-red-600 hover:underline" onClick={() => setConfirmDeleteId(row.id)}>
                  Delete
                </button>
              ),
            },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText="No document types found."
        />
      ) : filteredLocations.length > 0 ? (
        <DataTable
          rows={filteredLocations.slice(0, Number.parseInt(entries, 10) || 10)}
          columns={[
            { key: "locationName", header: "Location Name", sortable: true },
            { key: "createdBy", header: "Created By", sortable: true },
            { key: "createdOn", header: "Created On", sortable: true },
            { key: "action", header: "Action", render: () => <span className="text-[var(--brand)]">Edit</span> },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText="No locations found."
        />
      ) : (
        <EmptyState title="No locations found" description="Create your first client location from the form above." />
      )}

      {confirmDeleteId ? (
        <ConfirmDialog
          title="Delete Record"
          message="Are you sure you want to delete this record?"
          onNo={() => setConfirmDeleteId(null)}
          onYes={() => {
            onDelete(confirmDeleteId)
            setConfirmDeleteId(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ConfirmDialog({
  title,
  message,
  onYes,
  onNo,
}: {
  title: string
  message: string
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
        <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <ActionButton variant="secondary" onClick={onNo}>No</ActionButton>
          <ActionButton onClick={onYes}>Yes</ActionButton>
        </div>
      </div>
    </div>
  )
}
