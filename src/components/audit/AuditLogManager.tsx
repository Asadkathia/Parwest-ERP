/**
 * Parwest ERP — Audit Log manager (Phase 7C)
 * ─────────────────────────────────────────────────────────────────────────
 * Read-only list view of `/api/audit-logs`. Reskinned onto shadcn primitives
 * + the shared `DataTable`. Filters (module / event / search / date range)
 * remain URL-driven so deep links and back-button work.
 *
 * Inline `RegionUrlPicker` was removed — the global topbar region selector
 * covers scoping. The server page still derives effective region from the
 * URL and passes it through; we forward `regionId` to the API call.
 *
 * Row click opens a Sheet with the JSON diff viewer. Audit logs in this
 * codebase don't currently store `before`/`after` JSON, so the viewer falls
 * back to a single-pane "Record" view of the row.
 */

"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/shadcn/badge"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import { Input } from "@/components/shadcn/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/shadcn/sheet"

import JsonDiffViewer from "@/components/audit/JsonDiffViewer"

type LogRow = {
  id: string
  event: string
  module: string
  description?: string | null
  ipAddress?: string | null
  createdAt: string
  user?: { id: string; name: string; email?: string } | null
  targetEntityType?: string | null
  targetEntityId?: string | null
}

const ALL_VALUE = "__ALL__"

function eventVariant(event: string): "default" | "secondary" | "destructive" | "outline" {
  const e = event.toUpperCase()
  if (e.includes("CREATE")) return "default"
  if (e.includes("DELETE") || e.includes("REMOVE")) return "destructive"
  if (e.includes("UPDATE") || e.includes("EDIT") || e.includes("CHANGE")) return "secondary"
  return "outline"
}

/**
 * Try to surface a structured before/after blob from a row. Audit log
 * descriptions are free-form strings today, but if a writer ever serializes
 * `{ before, after }` (or just an object) we'll honor it.
 */
function extractStructured(row: LogRow): { before?: unknown; after?: unknown; record?: unknown } {
  const desc = row.description?.trim() ?? ""
  if (desc.startsWith("{") || desc.startsWith("[")) {
    try {
      const parsed = JSON.parse(desc) as Record<string, unknown>
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if ("before" in parsed || "after" in parsed) {
          return {
            before: (parsed as { before?: unknown }).before,
            after: (parsed as { after?: unknown }).after,
          }
        }
      }
      return { record: parsed }
    } catch {
      // fallthrough to record view
    }
  }
  return { record: row }
}

export default function AuditLogManager({
  regionId,
}: {
  regionId?: string
  // Accepted to keep the server page contract stable but no longer rendered —
  // the global topbar region selector covers region scoping now.
  regions?: { id: string; name: string }[]
  locked?: boolean
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const filterModule = searchParams.get("module") ?? ""
  const filterEvent = searchParams.get("event") ?? ""
  const filterDateFrom = searchParams.get("dateFrom") ?? ""
  const filterDateTo = searchParams.get("dateTo") ?? ""
  const initialSearch = searchParams.get("search") ?? ""
  const [search, setSearch] = React.useState(initialSearch)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [rows, setRows] = React.useState<LogRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [activeRow, setActiveRow] = React.useState<LogRow | null>(null)

  const pushParam = React.useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutator(params)
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  // Debounce search → URL
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pushParam((p) => {
        if (search.trim()) p.set("search", search.trim())
        else p.delete("search")
      })
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleSelect = (key: string) => (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set(key, val)
      else p.delete(key)
    })
  }

  const handleDate = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    pushParam((p) => {
      if (val) p.set(key, val)
      else p.delete(key)
    })
  }

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (initialSearch) p.set("search", initialSearch)
      if (filterModule) p.set("module", filterModule)
      if (filterEvent) p.set("event", filterEvent)
      if (filterDateFrom) p.set("dateFrom", filterDateFrom)
      if (filterDateTo) p.set("dateTo", filterDateTo)
      if (regionId) p.set("regionId", regionId)
      const res = await fetch(`/api/audit-logs?${p.toString()}`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      if (!res.ok) {
        const msg =
          (data && typeof data.message === "string" && data.message) ||
          "Failed to load audit logs."
        throw new Error(msg)
      }
      setRows(Array.isArray(data) ? (data as LogRow[]) : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load audit logs.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [initialSearch, filterModule, filterEvent, filterDateFrom, filterDateTo, regionId])

  React.useEffect(() => {
    void load()
  }, [load])

  // Distinct module/event lists for select filters — derived from the
  // currently-loaded page (matches legacy behavior).
  const modules = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.module))).sort((a, b) => a.localeCompare(b)),
    [rows]
  )
  const events = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.event))).sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const columns = React.useMemo<ColumnDef<LogRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Timestamp",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
      {
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.user?.name ?? "System"}</span>
        ),
      },
      {
        accessorKey: "module",
        header: "Module",
        cell: ({ row }) => <Badge variant="outline">{row.original.module}</Badge>,
      },
      {
        id: "entity",
        header: "Entity",
        cell: ({ row }) => {
          const t = row.original.targetEntityType
          const i = row.original.targetEntityId
          if (!t && !i) return <span className="text-muted-foreground">—</span>
          return (
            <span className="font-mono text-xs">
              {t ? <span className="text-muted-foreground">{t}:</span> : null}
              {i ?? ""}
            </span>
          )
        },
      },
      {
        accessorKey: "event",
        header: "Action",
        cell: ({ row }) => (
          <Badge variant={eventVariant(row.original.event)}>{row.original.event}</Badge>
        ),
      },
      {
        id: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {row.original.description ?? "—"}
          </span>
        ),
      },
      {
        id: "expand",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              setActiveRow(row.original)
            }}
          >
            View
          </button>
        ),
      },
    ],
    []
  )

  const isEmpty = !loading && rows.length === 0
  const structured = activeRow ? extractStructured(activeRow) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Review module actions and activity history.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Search</label>
          <div className="relative">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="module / event / user…"
              className="pr-8"
            />
            {(isPending || loading) && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Module</label>
          <Select
            value={filterModule || ALL_VALUE}
            onValueChange={handleSelect("module")}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Modules</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Action</label>
          <Select
            value={filterEvent || ALL_VALUE}
            onValueChange={handleSelect("event")}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Actions</SelectItem>
              {events.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">From</label>
          <Input type="date" value={filterDateFrom} onChange={handleDate("dateFrom")} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">To</label>
          <Input type="date" value={filterDateTo} onChange={handleDate("dateTo")} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {rows.length} entr{rows.length === 1 ? "y" : "ies"} loaded
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div className="text-base font-semibold">No audit logs found</div>
            <p className="max-w-md text-sm text-muted-foreground">
              No entries match the current filters. Try adjusting the module,
              action, or date range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKey="user"
          searchPlaceholder="Filter visible rows by user…"
          pageSize={25}
          enableColumnVisibility
          onRowClick={(row) => setActiveRow(row)}
          emptyMessage={loading ? "Loading…" : "No audit logs match the on-page filter."}
        />
      )}

      <Sheet open={Boolean(activeRow)} onOpenChange={(open) => !open && setActiveRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Audit entry</SheetTitle>
            <SheetDescription>
              {activeRow ? (
                <span className="block space-y-1 text-xs">
                  <span className="block">
                    <span className="font-medium">{activeRow.module}</span>
                    {" / "}
                    <span className="font-medium">{activeRow.event}</span>
                  </span>
                  <span className="block tabular-nums">
                    {new Date(activeRow.createdAt).toLocaleString("en-GB")}
                  </span>
                  <span className="block">
                    by {activeRow.user?.name ?? "System"}
                  </span>
                </span>
              ) : null}
            </SheetDescription>
          </SheetHeader>
          {activeRow && structured ? (
            <div className="mt-4">
              <JsonDiffViewer
                before={structured.before}
                after={structured.after}
                record={structured.record}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
