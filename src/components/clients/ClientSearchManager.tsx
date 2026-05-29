"use client"

import Link from "next/link"
import { Button } from "@/components/shadcn/button"
import { Badge } from "@/components/shadcn/badge"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Search, RotateCcw } from "lucide-react"
import { Card, CardContent } from "@/components/shadcn/card"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
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
import { buttonVariants } from "@/components/shadcn/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import DataTable from "@/components/shared/DataTable"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"
import { useCanAccess } from "@/components/shadcn/permission-gate"

type RegionOption = { id: string; name: string }

type ClientRow = {
  id: string
  name: string
  type: string
  city: string | null
  isBranchless: boolean
  status: string
  regionId?: string | null
  contactPerson?: string | null
  contactNumber?: string | null
  createdAt?: string
}

const CLIENT_TYPE_OPTIONS = ["bank", "manufacturer", "other"]

type Props = {
  title: string
  subtitle: string
  regions?: RegionOption[]
  locked?: boolean
}

export default function ClientSearchManager({ title, subtitle, regions = [], locked = false }: Props) {
  const searchParams = useSearchParams()
  const canUpdate = useCanAccess("CLIENTS", "UPDATE")
  const urlRegionId = searchParams?.get("regionId") || ""
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [name, setName] = useState("")
  const [clientType, setClientType] = useState("")
  const [city, setCity] = useState("")
  const [rowsPerPage, setRowsPerPage] = useState("10")
  const [tableSearch, setTableSearch] = useState("")
  const [selectDate, setSelectDate] = useState("")
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<ClientRow | null>(null)

  const pendingNextStatus =
    pendingStatusUpdate?.status.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE"

  const performStatusUpdate = async (row: ClientRow) => {
    const next = row.status.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setStatusUpdating(row.id)
    try {
      const res = await fetch(`/api/clients/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({} as { message?: string }))
      if (!res.ok) {
        toast.error(data?.message || "Failed to update client status.")
        return
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)))
      toast.success(`Client "${row.name}" set to ${next}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update client status.")
    } finally {
      setStatusUpdating(null)
    }
  }

  const loadRows = async () => {
    try {
      setLoading(true)
      setError("")
      const url = urlRegionId
        ? `/api/clients?regionId=${encodeURIComponent(urlRegionId)}`
        : "/api/clients"
      const response = await fetch(url)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Failed to fetch clients")
      }
      const data = await response.json()
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch clients")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRegionId])

  // Derive the City filter options from rows actually returned by the API.
  // The API is region-scoped server-side, so this list automatically respects
  // the user's locked region (no leak of out-of-region cities) and updates
  // when a SuperAdmin changes the URL regionId.
  const cityOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      const c = (row.city || "").trim()
      if (c) set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (name && !row.name.toLowerCase().includes(name.toLowerCase())) return false
      if (clientType && row.type.toLowerCase() !== clientType.toLowerCase()) return false
      if (city && city !== "All Cities" && !(row.city || "").toLowerCase().includes(city.toLowerCase())) return false
      if (tableSearch && !`${row.name} ${row.type} ${row.city || ""}`.toLowerCase().includes(tableSearch.toLowerCase())) return false
      if (selectDate && row.createdAt && new Date(row.createdAt).toISOString().slice(0, 10) !== selectDate) return false
      return true
    })
  }, [rows, name, clientType, city, tableSearch, selectDate])

  const pageSize = useMemo(() => {
    const parsed = Number.parseInt(rowsPerPage, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
  }, [rowsPerPage])

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RegionUrlPicker
            regions={regions}
            locked={locked}
            includeGlobalOption={!locked}
          />
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
            <input
              name="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-input"
              placeholder="Enter client name"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Client Type</label>
            <select name="Select Client Type" value={clientType} onChange={(e) => setClientType(e.target.value)} className="ui-select">
              <option value="">--Select Client Type--</option>
              {CLIENT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select City</label>
            <select name="Select City" value={city} onChange={(e) => setCity(e.target.value)} className="ui-select">
              <option value="">--Select City--</option>
              {cityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Show entries per page</label>
            <select
              name="Show entries per page"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(e.target.value)}
              className="ui-select"
            >
              {["10", "25", "50", "100"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search:</label>
            <input
              name="Search:"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="ui-input"
              placeholder="Search:"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Date</label>
            <input name="Select Date" type="date" value={selectDate} onChange={(e) => setSelectDate(e.target.value)} className="ui-input" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={loadRows} className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </Button>
          <Button 
            variant="secondary" className="inline-flex items-center gap-2"
            onClick={() => {
              setName("")
              setClientType("")
              setCity("")
              setRowsPerPage("10")
              setTableSearch("")
              setSelectDate("")
            }}>
            <RotateCcw className="h-4 w-4" />
            Clear
          </Button>
        </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        rows={loading ? [] : filtered}
        columns={[
          { key: "id", header: "ID" },
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link href={`/clients/${row.id}`} className="font-medium text-[var(--brand)] hover:underline">
                {row.name}
              </Link>
            ),
            sortable: true,
          },
          { key: "type", header: "Type", sortable: true },
          { key: "city", header: "City", render: (row) => row.city || "—", sortable: true },
          { key: "isBranchless", header: "Is Branchless", render: (row) => (row.isBranchless ? "Yes" : "No") },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{row.status}</Badge>
            ),
          },
          {
            key: "action",
            header: "Action",
            render: (row) => (
              <div className="flex items-center gap-3">
                <Link href={`/clients/${row.id}`} className="text-[var(--brand)] hover:underline">
                  View
                </Link>
                {canUpdate ? (
                  <Link href={`/clients/${row.id}/edit`} className="text-emerald-700 hover:underline">
                    Edit
                  </Link>
                ) : null}
                {canUpdate ? (
                  <button
                    type="button"
                    disabled={statusUpdating === row.id}
                    onClick={() => setPendingStatusUpdate(row)}
                    className="text-amber-700 hover:underline disabled:opacity-50"
                  >
                    {statusUpdating === row.id ? "Updating..." : "Update Status"}
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
        getRowKey={(row) => row.id}
        emptyText={loading ? "Loading clients..." : "No clients found."}
        searchable={false}
        pageSize={pageSize}
        stickyHeader
      />

      <AlertDialog
        open={pendingStatusUpdate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatusUpdate(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Set client to {pendingNextStatus}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusUpdate
                ? `Change status of "${pendingStatusUpdate.name}" to ${pendingNextStatus}.`
                : ""}
              {pendingNextStatus === "INACTIVE"
                ? " The server will block this if the client still has active branches or deployments."
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                pendingNextStatus === "INACTIVE"
                  ? buttonVariants({ variant: "destructive" })
                  : ""
              )}
              onClick={async () => {
                const row = pendingStatusUpdate
                setPendingStatusUpdate(null)
                if (row) await performStatusUpdate(row)
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
