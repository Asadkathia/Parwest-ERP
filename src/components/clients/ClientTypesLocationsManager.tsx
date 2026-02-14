"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import EmptyState from "@/components/ui/empty-state"

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
  const [inputName, setInputName] = useState("")
  const [inputUniqueKey, setInputUniqueKey] = useState("")

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
    if (!inputName.trim()) return

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
  }

  const onDelete = (id: string) => {
    if (activeTab === "All Client Types") setClientTypes((prev) => prev.filter((row) => row.id !== id))
    else if (activeTab === "Client's Document Types") setDocumentTypes((prev) => prev.filter((row) => row.id !== id))
    else setLocations((prev) => prev.filter((row) => row.id !== id))
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
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="ui-input" placeholder="Search rows" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onAdd}>Add</ActionButton>
          <ActionButton variant="secondary">Update</ActionButton>
          <ActionButton variant="danger">Delete</ActionButton>
        </div>
      </FilterBar>

      {activeTab === "All Client Types" ? (
        <DataTable
          rows={filteredClientTypes}
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
                <button className="text-red-600 hover:underline" onClick={() => onDelete(row.id)}>
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
          rows={filteredDocumentTypes}
          columns={[
            { key: "name", header: "Name", sortable: true },
            { key: "uniqueKey", header: "Unique Key", sortable: true },
            { key: "createdAt", header: "Created At", sortable: true },
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
          searchable={false}
          emptyText="No document types found."
        />
      ) : filteredLocations.length > 0 ? (
        <DataTable
          rows={filteredLocations}
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
    </div>
  )
}
