"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Loader2, Plus, Building2 } from "lucide-react"

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

export type ClientListRow = {
  id: string
  name: string
  type: string
  city: string | null
  status: string
  regionId: string | null
  regionName: string | null
  branchCount: number
  contractCount: number
  currentRates: { guardType: string; rate: number }[]
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
]

export type ClientTypeOption = { value: string; label: string }

// Sentinel for the shadcn `Select` "all" option. Radix `Select` disallows
// empty-string item values, so we map this back to "" before pushing to URL.
const ALL_VALUE = "__ALL__"

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "default"
    case "INACTIVE":
      return "secondary"
    default:
      return "outline"
  }
}

interface Props {
  clients: ClientListRow[]
  canCreateClient: boolean
  /**
   * Type filter options sourced from the persisted `ClientType` table — the
   * `value` must match the stored `Client.type` (e.g. `BANK`), not a label.
   */
  typeOptions: ClientTypeOption[]
}

/**
 * Client wrapper for the clients list. Filter inputs drive URL search params
 * (matching the legacy contract); the server component re-runs its scoped
 * Prisma query when those params change.
 *
 * NOTE: region scope is enforced server-side via `deriveManagerScope` /
 * `buildManagerScopeWhere` — do not move that logic here.
 */
export default function ClientsListClient({
  clients,
  canCreateClient,
  typeOptions,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const [search, setSearch] = React.useState(searchParams.get("q") ?? "")
  const status = searchParams.get("status") ?? ""
  const type = searchParams.get("type") ?? ""
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Debounce the search input — same UX as the legacy filter bar.
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pushParam((p) => {
        if (search) p.set("q", search)
        else p.delete("q")
      })
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleStatus = (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set("status", val)
      else p.delete("status")
    })
  }

  const handleType = (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set("type", val)
      else p.delete("type")
    })
  }

  const columns = React.useMemo<ColumnDef<ClientListRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Client ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs" dir="ltr">
            {row.original.id.slice(0, 8)}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.type}</Badge>
        ),
      },
      {
        accessorKey: "regionName",
        header: "Region",
        cell: ({ row }) => row.original.regionName || "—",
      },
      {
        accessorKey: "branchCount",
        header: () => <span className="block text-end">Branches</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums">
            {row.original.branchCount}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "contractCount",
        header: () => <span className="block text-end">Contracts</span>,
        cell: ({ row }) =>
          row.original.contractCount === 0 ? (
            <div className="text-end text-muted-foreground">None</div>
          ) : (
            <div className="text-end tabular-nums">
              {row.original.contractCount}
            </div>
          ),
      },
      {
        id: "currentRates",
        header: "Current Rates",
        cell: ({ row }) =>
          row.original.currentRates.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.currentRates.slice(0, 3).map((r, i) => (
                <Badge key={i} variant="secondary" className="font-normal">
                  <span className="font-medium">{r.guardType}</span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span dir="ltr" className="tabular-nums">PKR {r.rate.toLocaleString()}</span>
                </Badge>
              ))}
              {row.original.currentRates.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{row.original.currentRates.length - 3}
                </span>
              )}
            </div>
          ),
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => row.original.city || "—",
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            href={`/clients/${row.original.id}`}
            className="text-primary hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </Link>
        ),
      },
    ],
    []
  )

  const hasFilters = Boolean(search || status || type)
  const isEmpty = clients.length === 0

  return (
    <div className="space-y-4">
      {/* Filter toolbar — plain Tailwind grid (no FilterBar wrapper). */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client name or code…"
              className="pe-8"
            />
            {isPending && (
              <Loader2 className="absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            Type
          </label>
          <Select
            value={type || ALL_VALUE}
            onValueChange={handleType}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Types</SelectItem>
              {typeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            Status
          </label>
          <Select
            value={status || ALL_VALUE}
            onValueChange={handleStatus}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Status</SelectItem>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {clients.length} client{clients.length !== 1 ? "s" : ""} found
        {hasFilters ? " (filtered)" : ""}
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div className="text-base font-semibold">No clients found</div>
            <p className="max-w-md text-sm text-muted-foreground">
              No clients match the current filters. Try clearing filters or
              search by name.
            </p>
            {canCreateClient && (
              <PermissionGate module="CLIENTS" action="CREATE" mode="hide">
                <Button asChild className="mt-2">
                  <Link href="/clients/new?mode=branch">
                    <Plus className="me-2 h-4 w-4" />
                    Add Client
                  </Link>
                </Button>
              </PermissionGate>
            )}
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={clients}
          searchKey="name"
          searchPlaceholder="Filter visible rows by name…"
          pageSize={25}
          enableColumnVisibility
          emptyMessage="No clients match the on-page filter."
        />
      )}
    </div>
  )
}
