"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Button } from "@/components/shadcn/button"
import DataTable from "@/components/shared/DataTable"
type ClientTypeRow = { id: string; serial: number; name: string; label: string; addedBy: string }
type DocumentTypeRow = { id: string; name: string; uniqueKey: string; createdAt: string; status: "ACTIVE" | "INACTIVE" }
type LocationRow = { id: string; locationName: string; createdBy: string; createdOn: string }

type AddMode = "clientType" | "documentType" | "location"

const initialDocumentTypes: DocumentTypeRow[] = [
  { id: "1", name: "Verification Form", uniqueKey: "FE879B37B8", createdAt: "2018-01-29 10:00:36", status: "INACTIVE" },
  { id: "2", name: "Authentication Form", uniqueKey: "0AFC4214F", createdAt: "2018-01-29 10:01:31", status: "INACTIVE" },
  { id: "3", name: "File", uniqueKey: "8C700922AD", createdAt: "2018-02-08 14:52:58", status: "INACTIVE" },
]

const initialLocations: LocationRow[] = [
  { id: "1", locationName: "ALL CITIES", createdBy: "SUPERUSER", createdOn: "NOV 30TH, -0001" },
  { id: "2", locationName: "LAHORE", createdBy: "SUPERUSER", createdOn: "APR 26TH, 2018" },
  { id: "3", locationName: "GUJRANWALA", createdBy: "SUPERUSER", createdOn: "APR 26TH, 2018" },
  { id: "4", locationName: "MULTAN", createdBy: "N/A", createdOn: "MAY 17TH, 2018" },
]

export default function ClientTypesLocationsManager() {
  const [clientTypes, setClientTypes] = useState<ClientTypeRow[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRow[]>(initialDocumentTypes)
  const [locations, setLocations] = useState<LocationRow[]>(initialLocations)
  const [clientTypesLoading, setClientTypesLoading] = useState(false)

  const [query, setQuery] = useState("")
  const [entries, setEntries] = useState("10")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const [addMode, setAddMode] = useState<AddMode | null>(null)
  const [nameInput, setNameInput] = useState("")
  const [uniqueKeyInput, setUniqueKeyInput] = useState("")

  // ── Load client types from DB ──────────────────────────────────────────────
  const loadClientTypes = async () => {
    setClientTypesLoading(true)
    try {
      const res = await fetch("/api/client-types", { cache: "no-store" })
      const data = await res.json().catch(() => [])
      if (!res.ok) throw new Error(data?.message || "Failed to load client types.")
      setClientTypes(
        (Array.isArray(data) ? data : []).map((t: { id: string; name: string; label: string }, i: number) => ({
          id: t.id,
          serial: i + 1,
          name: t.name,
          label: t.label,
          addedBy: "Admin",
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load client types.")
    } finally {
      setClientTypesLoading(false)
    }
  }

  useEffect(() => { void loadClientTypes() }, [])

  const limited = Number.parseInt(entries, 10) || 10
  const q = query.trim().toLowerCase()

  const filteredClientTypes = useMemo(() => {
    const rows = q
      ? clientTypes.filter((row) => row.name.toLowerCase().includes(q) || row.addedBy.toLowerCase().includes(q))
      : clientTypes
    return rows.slice(0, limited)
  }, [clientTypes, q, limited])

  const filteredDocumentTypes = useMemo(() => {
    const rows = q
      ? documentTypes.filter(
          (row) =>
            row.name.toLowerCase().includes(q) ||
            row.uniqueKey.toLowerCase().includes(q) ||
            row.createdAt.toLowerCase().includes(q)
        )
      : documentTypes
    return rows.slice(0, limited)
  }, [documentTypes, q, limited])

  const filteredLocations = useMemo(() => {
    const rows = q
      ? locations.filter(
          (row) =>
            row.locationName.toLowerCase().includes(q) ||
            row.createdBy.toLowerCase().includes(q) ||
            row.createdOn.toLowerCase().includes(q)
        )
      : locations
    return rows.slice(0, limited)
  }, [locations, q, limited])

  const closeModal = () => {
    setAddMode(null)
    setNameInput("")
    setUniqueKeyInput("")
  }

  const submitAdd = async () => {
    if (!nameInput.trim()) {
      setError("Name is required.")
      return
    }

    setError("")

    if (addMode === "clientType") {
      try {
        const res = await fetch("/api/client-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: nameInput.trim() }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Failed to create client type.")
        setNotice("Client type added.")
        await loadClientTypes()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create client type.")
      }
      closeModal()
      return
    }

    if (addMode === "documentType") {
      setDocumentTypes((prev) => [
        {
          id: crypto.randomUUID(),
          name: nameInput.trim(),
          uniqueKey: (uniqueKeyInput.trim() || Math.random().toString(16).slice(2, 10)).toUpperCase(),
          createdAt: new Date().toLocaleString("en-US"),
          status: "INACTIVE",
        },
        ...prev,
      ])
      setNotice("Client document type added.")
    }

    if (addMode === "location") {
      setLocations((prev) => [
        {
          id: crypto.randomUUID(),
          locationName: nameInput.trim().toUpperCase(),
          createdBy: "SUPERUSER",
          createdOn: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase(),
        },
        ...prev,
      ])
      setNotice("Client location added.")
    }

    closeModal()
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Types & Locations"}</h2><p className="mt-1 text-sm text-muted-foreground">{"All client types, client's document types, and client locations."}</p></div></div>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--text-muted)]">Show</label>
          <select value={entries} onChange={(e) => setEntries(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
            {[
              "10",
              "25",
              "50",
              "100",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-muted)]">Search:</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm"
            placeholder="Search all tables"
          />
        </div>
      </div>

      {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
      {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}

      <MasterSection title="All Client Types" onAdd={() => setAddMode("clientType")}>
        <DataTable
          rows={filteredClientTypes}
          columns={[
            { key: "serial", header: "#", sortable: true },
            { key: "label", header: "Label", sortable: true },
            { key: "name", header: "System Key", sortable: true },
            { key: "addedBy", header: "Added By", sortable: true },
            {
              key: "action",
              header: "Action",
              render: (row) => (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={async () => {
                    if (!confirm(`Delete "${row.label}"?`)) return
                    const res = await fetch(`/api/client-types/${row.id}`, { method: "DELETE" })
                    if (res.ok) { setNotice(`"${row.label}" deleted.`); await loadClientTypes() }
                    else setError("Failed to delete.")
                  }}
                >
                  Delete
                </button>
              ),
            },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText={clientTypesLoading ? "Loading…" : "No client types found."}
        />
      </MasterSection>

      <MasterSection title="Client's Document Types" onAdd={() => setAddMode("documentType")}>
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
                <button
                  type="button"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                  onClick={() => {
                    setDocumentTypes((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } : item)))
                    setNotice("Document status updated.")
                  }}
                >
                  {row.status === "ACTIVE" ? "DEACTIVATE" : "ACTIVATE"}
                </button>
              ),
            },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText="No document types found."
        />
      </MasterSection>

      <MasterSection title="Client Locations" onAdd={() => setAddMode("location")}>
        <DataTable
          rows={filteredLocations}
          columns={[
            { key: "locationName", header: "Location Name", sortable: true },
            { key: "createdBy", header: "Created By", sortable: true },
            { key: "createdOn", header: "Created On", sortable: true },
            { key: "action", header: "Action", render: () => <span className="text-[var(--brand)]">EDIT</span> },
          ]}
          getRowKey={(row) => row.id}
          searchable={false}
          emptyText="No locations found."
        />
      </MasterSection>

      {addMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
            <h3 className="text-base font-semibold text-[var(--text)]">
              {addMode === "clientType"
                ? "Add Client Type"
                : addMode === "documentType"
                  ? "Add Client Document Type"
                  : "Add Client Location"}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Name*</label>
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="ui-input" placeholder="Name" />
              </div>
              {addMode === "documentType" ? (
                <div>
                  <label className="mb-1 block text-sm text-[var(--text-muted)]">Unique Key</label>
                  <input value={uniqueKeyInput} onChange={(e) => setUniqueKeyInput(e.target.value)} className="ui-input" placeholder="Unique key" />
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={closeModal}>Close</Button>
              <Button onClick={submitAdd}>Submit</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MasterSection({
  title,
  children,
  onAdd,
}: {
  title: string
  children: ReactNode
  onAdd: () => void
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--text)] uppercase">{title}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-7 w-7 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600"
          aria-label={`Add ${title}`}
        >
          +
        </button>
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}
