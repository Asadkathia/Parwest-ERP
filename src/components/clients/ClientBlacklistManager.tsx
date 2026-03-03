"use client"

import { useEffect, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type Row = {
  id: string
  name: string
  email: string
  blacklistedBy: string
  blacklistedOn: string
  reason?: string
}
type ApiBlacklistRow = {
  id: string
  name?: string | null
  email?: string | null
  updatedAt?: string | null
}

export default function ClientBlacklistManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [email, setEmail] = useState("")
  const [entries, setEntries] = useState("10")
  const [tableSearch, setTableSearch] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [confirmAction, setConfirmAction] = useState<null | "reset" | "submit">(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => {
          if (!tableSearch.trim()) return true
          const q = tableSearch.toLowerCase()
          return row.email.toLowerCase().includes(q) || row.name.toLowerCase().includes(q) || row.blacklistedBy.toLowerCase().includes(q)
        })
        .slice(0, Number.parseInt(entries, 10) || 10),
    [rows, tableSearch, entries]
  )

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      try {
        const response = await fetch("/api/clients/blacklist", { cache: "no-store" })
        const data = await response.json()
        if (!response.ok) {
          if (isMounted) setError(data?.message || "Failed to load blacklisted clients.")
          return
        }
        if (isMounted) {
          setRows(
            Array.isArray(data)
              ? (data as ApiBlacklistRow[]).map((row) => ({
                  id: String(row.id),
                  name: String(row.name || "Unknown Client"),
                  email: String(row.email || ""),
                  blacklistedBy: "System",
                  blacklistedOn: row.updatedAt ? new Date(row.updatedAt).toISOString().replace("T", " ").slice(0, 19) : "",
                  reason: undefined,
                }))
              : []
          )
        }
      } catch {
        if (isMounted) setError("Failed to load blacklisted clients.")
      }
    }
    run()
    return () => {
      isMounted = false
    }
  }, [])

  const onAdd = async () => {
    if (!email.trim()) {
      setError("Email is required.")
      return
    }
    setError("")

    const response = await fetch("/api/clients/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data?.message || "Failed to blacklist client.")
      return
    }

    setRows((prev) => [
      {
        id: String(data.id),
        name: String(data.name || "Unknown Client"),
        email: String(data.email || email.trim().toLowerCase()),
        blacklistedBy: "System",
        blacklistedOn: data.updatedAt ? new Date(data.updatedAt).toISOString().replace("T", " ").slice(0, 19) : new Date().toISOString().replace("T", " ").slice(0, 19),
        reason: undefined,
      },
      ...prev.filter((row) => row.id !== String(data.id)),
    ])
    setEmail("")
    setNotice("Client blacklisted.")
  }

  const onDelete = async (id: string) => {
    const response = await fetch(`/api/clients/blacklist?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data?.message || "Failed to remove client from blacklist.")
      return
    }
    setRows((prev) => prev.filter((row) => row.id !== String(data.id)))
    setNotice("Client removed from blacklist.")
  }

  const resetForm = () => {
    setEmail("")
    setTableSearch("")
    setEntries("10")
    setNotice("Filters reset.")
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Black Listed Clients" subtitle="Manage blacklisted clients by email." />

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Email</label>
            <input
              type="email"
              name="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ui-input"
              placeholder="client@example.com"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={onAdd}>Add</ActionButton>
          <ActionButton variant="secondary" onClick={() => setConfirmAction("reset")}>Reset</ActionButton>
          <ActionButton variant="secondary" onClick={() => setConfirmAction("submit")}>Submit</ActionButton>
        </div>
      </FilterBar>

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--text-muted)]">Show</label>
          <select value={entries} onChange={(e) => setEntries(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
            {["10", "25", "50", "100"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-muted)]">Search:</label>
          <input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="rounded-md border px-2 py-1 text-sm" />
        </div>
      </div>

      <DataTable
        rows={filteredRows}
        columns={[
          { key: "name", header: "Client", sortable: true },
          { key: "email", header: "Email #", sortable: true },
          { key: "blacklistedBy", header: "Black Listed By", sortable: true },
          { key: "blacklistedOn", header: "Black Listed On", sortable: true },
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
        emptyText="No blacklisted clients found."
        searchable={false}
      />

      {confirmAction ? (
        <ConfirmDialog
          title={confirmAction === "reset" ? "Reset Blacklist Form" : "Submit Blacklist Form"}
          message={confirmAction === "reset" ? "Reset all current fields?" : "Submit current blacklist data?"}
          onNo={() => setConfirmAction(null)}
          onYes={() => {
            if (confirmAction === "reset") {
              resetForm()
            } else {
              setNotice("Blacklist data submitted.")
            }
            setConfirmAction(null)
          }}
        />
      ) : null}

      {confirmDeleteId ? (
        <ConfirmDialog
          title="Remove Blacklisted Client"
          message="Are you sure you want to remove this client from blacklist?"
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
