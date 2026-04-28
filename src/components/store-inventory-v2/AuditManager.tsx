"use client"

import { useCallback, useEffect, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertCircle } from "lucide-react"

import { DataTable } from "@/components/shadcn/data-table"
import { Badge } from "@/components/shadcn/badge"
import { Card, CardContent } from "@/components/shadcn/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { apiGet } from "@/components/store-inventory-v2/api"

type Row = {
  id: string
  event: string
  module: string
  ipAddress?: string | null
  description?: string | null
  createdAt: string
  user?: { id: string; name: string; email: string } | null
}

type RegionOption = { id: string; name: string }

// Phase 6A: list-only migration. Region picker handled by the global topbar.
// Props are accepted for compat with the screen route signature but unused.
export default function AuditManager({
  regions: _regions = [],
  locked: _locked = false,
}: {
  regions?: RegionOption[]
  locked?: boolean
} = {}) {
  void _regions
  void _locked
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await apiGet<Row[]>("/api/audit-logs?module=INVENTORY_V2")
      setRows(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load audit logs."
      setErrorMessage(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ColumnDef<Row>[] = [
    {
      id: "event",
      accessorKey: "event",
      header: "Event",
      cell: ({ row }) => <span className="font-medium">{row.original.event}</span>,
    },
    {
      id: "module",
      accessorKey: "module",
      header: "Module",
      cell: ({ row }) => <Badge variant="secondary">{row.original.module}</Badge>,
    },
    {
      id: "user",
      header: "User",
      accessorFn: (row) => row.user?.name || "System",
      cell: ({ row }) => row.original.user?.name || "System",
    },
    {
      id: "ipAddress",
      header: "IP",
      accessorFn: (row) => row.ipAddress || "—",
    },
    {
      id: "description",
      header: "Description",
      accessorFn: (row) => row.description || "—",
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString("en-US"),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Audits</h1>
      <p className="text-sm text-muted-foreground -mt-4">Inventory v2 mutation audit logs.</p>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && rows.length === 0 && !errorMessage ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No inventory v2 audit logs found.
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKey="event"
          searchPlaceholder="Search by event…"
          emptyMessage={loading ? "Loading audit logs…" : "No inventory v2 audit logs found."}
        />
      )}
    </div>
  )
}
