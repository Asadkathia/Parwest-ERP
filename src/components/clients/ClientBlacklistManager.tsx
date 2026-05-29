"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import { useCanAccess } from "@/components/shadcn/permission-gate"
import DataTable from "@/components/shared/DataTable"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type RegionOption = { id: string; name: string }

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

export default function ClientBlacklistManager({
  regions = [],
  locked = false,
}: {
  regions?: RegionOption[]
  locked?: boolean
} = {}) {
  const canCreate = useCanAccess("CLIENTS", "CREATE")
  const canDelete = useCanAccess("CLIENTS", "DELETE")
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
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Black Listed Clients"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage blacklisted clients by email."}</p></div></div>

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RegionUrlPicker
            regions={regions}
            locked={locked}
            includeGlobalOption={!locked}
          />
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
          {canCreate ? <Button onClick={onAdd}>Add</Button> : null}
          <Button variant="secondary" onClick={() => setConfirmAction("reset")}>Reset</Button>
          <Button variant="secondary" onClick={() => setConfirmAction("submit")}>Submit</Button>
        </div>
        </CardContent>
      </Card>

      {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
      {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}

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
            render: (row) =>
              canDelete ? (
                <button className="text-red-600 hover:underline" onClick={() => setConfirmDeleteId(row.id)}>
                  Delete
                </button>
              ) : (
                <span className="text-[var(--text-muted)]">—</span>
              ),
          },
        ]}
        getRowKey={(row) => row.id}
        emptyText="No blacklisted clients found."
        searchable={false}
      />

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "reset" ? "Reset Blacklist Form" : "Submit Blacklist Form"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "reset" ? "Reset all current fields?" : "Submit current blacklist data?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction === "reset") {
                  resetForm()
                } else {
                  setNotice("Blacklist data submitted.")
                }
                setConfirmAction(null)
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Blacklisted Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this client from blacklist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const id = confirmDeleteId
                setConfirmDeleteId(null)
                if (id) void onDelete(id)
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
