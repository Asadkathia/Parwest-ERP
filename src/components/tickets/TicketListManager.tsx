"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { AlertCircle, CheckCircle2, Clock, Loader2, Plus, Tag, Ticket } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import { Input } from "@/components/shadcn/input"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"

type Lookup = { id: string; name: string; color?: string | null }
type TicketRow = {
  id: string
  ticketNumber?: number | null
  subject: string
  sender?: { id: string; name: string } | null
  assignedTo?: { id: string; name: string } | null
  category?: Lookup | null
  priority?: Lookup | null
  status?: Lookup | null
  createdAt: string
}

// Sentinel for the shadcn `Select` "all" option. Radix `Select` disallows
// empty-string item values, so we map this back to "" before pushing to URL.
const ALL_VALUE = "__ALL__"

function statusVariant(name: string): "default" | "secondary" | "destructive" | "outline" {
  const n = name.toLowerCase()
  if (n.includes("close") || n.includes("resolv")) return "secondary"
  if (n.includes("progress")) return "default"
  if (n.includes("reject") || n.includes("cancel")) return "destructive"
  return "outline"
}

function priorityVariant(name: string): "default" | "secondary" | "destructive" | "outline" {
  const n = name.toLowerCase()
  if (n.includes("critical") || n.includes("urgent") || n.includes("high")) return "destructive"
  if (n.includes("medium") || n.includes("normal")) return "default"
  if (n.includes("low")) return "secondary"
  return "outline"
}

function StatusIcon({ name }: { name: string }) {
  const n = name.toLowerCase()
  if (n.includes("close") || n.includes("resolv")) return <CheckCircle2 className="me-1 h-3 w-3" />
  if (n.includes("progress")) return <Clock className="me-1 h-3 w-3" />
  return <AlertCircle className="me-1 h-3 w-3" />
}

export default function TicketListManager({
  canCreate = true,
}: {
  canCreate?: boolean
  // Note: `regions` and `locked` are accepted to keep the server page contract
  // stable but are no longer rendered — the global topbar region selector
  // covers region scoping now.
  regions?: { id: string; name: string }[]
  locked?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const filterStatus = searchParams.get("statusId") ?? ""
  const filterPriority = searchParams.get("priorityId") ?? ""
  const filterCategory = searchParams.get("categoryId") ?? ""
  const initialSearch = searchParams.get("search") ?? ""
  const [search, setSearch] = React.useState(initialSearch)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tickets, setTickets] = React.useState<TicketRow[]>([])
  const [categories, setCategories] = React.useState<Lookup[]>([])
  const [priorities, setPriorities] = React.useState<Lookup[]>([])
  const [statuses, setStatuses] = React.useState<Lookup[]>([])
  const [loading, setLoading] = React.useState(false)

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

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (initialSearch) p.set("search", initialSearch)
      if (filterCategory) p.set("categoryId", filterCategory)
      if (filterPriority) p.set("priorityId", filterPriority)
      if (filterStatus) p.set("statusId", filterStatus)
      const res = await fetch(`/api/tickets?${p}`, { cache: "no-store" })
      const data = await res.json().catch(() => [])
      if (!res.ok) {
        const msg =
          (data && typeof data.message === "string" && data.message) ||
          "Failed to load tickets."
        throw new Error(msg)
      }
      setTickets(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tickets.")
    } finally {
      setLoading(false)
    }
  }, [initialSearch, filterCategory, filterPriority, filterStatus])

  React.useEffect(() => {
    Promise.all([
      fetch("/api/tickets/categories").then((r) => r.json()).catch(() => []),
      fetch("/api/tickets/priorities").then((r) => r.json()).catch(() => []),
      fetch("/api/tickets/statuses").then((r) => r.json()).catch(() => []),
    ]).then(([c, p, s]) => {
      setCategories(Array.isArray(c) ? c : [])
      setPriorities(Array.isArray(p) ? p : [])
      setStatuses(Array.isArray(s) ? s : [])
    })
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const columns = React.useMemo<ColumnDef<TicketRow>[]>(
    () => [
      {
        accessorKey: "ticketNumber",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.ticketNumber ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "subject",
        header: "Subject",
        cell: ({ row }) => (
          <Link
            href={`/tickets/${row.original.id}`}
            className="font-medium text-primary hover:underline line-clamp-2"
          >
            {row.original.subject}
          </Link>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) =>
          row.original.category ? (
            <Badge variant="outline">{row.original.category.name}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "priority",
        header: "Priority",
        cell: ({ row }) =>
          row.original.priority ? (
            <Badge variant={priorityVariant(row.original.priority.name)}>
              {row.original.priority.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status ? (
            <Badge variant={statusVariant(row.original.status.name)}>
              <StatusIcon name={row.original.status.name} />
              {row.original.status.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "sender",
        header: "Reporter",
        cell: ({ row }) => row.original.sender?.name ?? "—",
      },
      {
        id: "assignedTo",
        header: "Assignee",
        cell: ({ row }) =>
          row.original.assignedTo ? (
            <span className="font-medium">{row.original.assignedTo.name}</span>
          ) : (
            <Badge variant="destructive">Unassigned</Badge>
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            href={`/tickets/${row.original.id}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </Link>
        ),
      },
    ],
    []
  )

  const isEmpty = !loading && tickets.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Track and resolve support tickets
          </p>
        </div>
        {canCreate ? (
          <PermissionGate module="TICKETING" action="CREATE" mode="hide">
            <Button asChild>
              <Link href="/tickets/new">
                <Plus className="me-2 h-4 w-4" />
                New Ticket
              </Link>
            </Button>
          </PermissionGate>
        ) : null}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Search</label>
          <div className="relative">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject or description…"
              className="pr-8"
            />
            {(isPending || loading) && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Status</label>
          <Select
            value={filterStatus || ALL_VALUE}
            onValueChange={handleSelect("statusId")}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Priority</label>
          <Select
            value={filterPriority || ALL_VALUE}
            onValueChange={handleSelect("priorityId")}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Priorities</SelectItem>
              {priorities.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Category</label>
          <Select
            value={filterCategory || ALL_VALUE}
            onValueChange={handleSelect("categoryId")}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} found
        </span>
        <Link
          href="/tickets/prerequisites"
          className="flex items-center gap-1 text-primary hover:underline"
        >
          <Tag className="h-3 w-3" /> Configure Lookups
        </Link>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Ticket className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div className="text-base font-semibold">No tickets found</div>
            <p className="max-w-md text-sm text-muted-foreground">
              No tickets match the current filters. Try clearing filters or
              create a new ticket.
            </p>
            {canCreate && (
              <PermissionGate module="TICKETING" action="CREATE" mode="hide">
                <Button asChild className="mt-2">
                  <Link href="/tickets/new">
                    <Plus className="me-2 h-4 w-4" />
                    Create Ticket
                  </Link>
                </Button>
              </PermissionGate>
            )}
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={tickets}
          searchKey="subject"
          searchPlaceholder="Filter visible rows by subject…"
          pageSize={25}
          enableColumnVisibility
          emptyMessage={loading ? "Loading…" : "No tickets match the on-page filter."}
        />
      )}
    </div>
  )
}
