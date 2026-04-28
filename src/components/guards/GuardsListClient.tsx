"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Loader2, Plus, Shield } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/shadcn/avatar"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import {
  GuardStatusBadge,
  type GuardStatus,
} from "@/components/shadcn/guard-status-badge"
import { Input } from "@/components/shadcn/input"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
export type GuardListRow = {
  id: string
  parwestId: string
  name: string
  cnic: string
  phone: string | null
  status: string
  designation: string | null
  salary: number | null
  regionId: string | null
  regionalOfficeId: string | null
  supervisorName: string | null
  regionalOfficeName: string | null
  clientName: string | null
}

type RegionalOffice = { id: string; name: string }

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "PRESENT", label: "Present" },
  { value: "DEFAULT", label: "Default" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "TERMINATED", label: "Terminated" },
]

export type DesignationOption = { value: string; label: string }

// Sentinel value for the shadcn `Select` "all" option. Radix `Select`
// disallows empty-string item values, so we map this back to "" before
// pushing to the URL.
const ALL_VALUE = "__ALL__"

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface Props {
  guards: GuardListRow[]
  offices: RegionalOffice[]
  hideOfficePicker: boolean
  canCreateGuard: boolean
  /**
   * Designation filter options derived from canonical sources (the
   * `GuardDesignationType` lookup table merged with values currently in use
   * on `Guard.designation`). The `value` must match the stored value
   * verbatim — `where.designation` is an exact equality check.
   */
  designationOptions: DesignationOption[]
}

/**
 * Client wrapper for the guards list. Filter inputs drive URL search params
 * (matching the legacy contract); the server component re-runs its scoped
 * Prisma query with `buildManagerScopeWhere` whenever those params change.
 *
 * NOTE: TanStack filtering is intentionally limited to the in-memory search
 * input. Region / status / designation / office filters MUST round-trip
 * through the server because the regional scope is enforced server-side.
 */
export default function GuardsListClient({
  guards,
  offices,
  hideOfficePicker,
  canCreateGuard,
  designationOptions,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const [search, setSearch] = React.useState(searchParams.get("q") ?? "")
  const status = searchParams.get("status") ?? ""
  const officeId = searchParams.get("officeId") ?? ""
  const designation = searchParams.get("designation") ?? ""
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

  const handleDesignation = (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set("designation", val)
      else p.delete("designation")
    })
  }

  const handleOffice = (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set("officeId", val)
      else p.delete("officeId")
    })
  }

  const columns = React.useMemo<ColumnDef<GuardListRow>[]>(
    () => [
      {
        accessorKey: "parwestId",
        header: "Parwest ID",
        // IDs are always-LTR — `dir="ltr"` keeps the digits/letters from
        // re-ordering when the page is in RTL mode.
        cell: ({ row }) => (
          <span dir="ltr" className="font-mono text-xs tabular-nums">
            {row.original.parwestId}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {initialsOf(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "cnic",
        header: "CNIC",
        // CNICs are always-LTR — keep digit+dash sequence stable in RTL.
        cell: ({ row }) => (
          <span dir="ltr" className="font-mono text-xs tabular-nums">
            {row.original.cnic}
          </span>
        ),
      },
      {
        accessorKey: "designation",
        header: "Designation",
        cell: ({ row }) => row.original.designation || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <GuardStatusBadge status={row.original.status as GuardStatus} />
        ),
      },
      {
        accessorKey: "regionalOfficeName",
        header: "Region",
        cell: ({ row }) => row.original.regionalOfficeName || "—",
      },
      {
        accessorKey: "salary",
        header: () => <span className="block text-end">Salary</span>,
        // Currency is always-LTR — wrap in `dir="ltr"` so the ₨ symbol
        // and digits keep their natural order under RTL.
        cell: ({ row }) =>
          row.original.salary !== null &&
          Number.isFinite(row.original.salary) ? (
            <div dir="ltr" className="text-end">
              <ParwestCurrency value={row.original.salary as number} />
            </div>
          ) : (
            <div className="text-end text-muted-foreground">—</div>
          ),
      },
      {
        accessorKey: "clientName",
        header: "Assigned Client",
        cell: ({ row }) => row.original.clientName || "—",
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            href={`/guards/${row.original.id}`}
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

  const hasFilters = Boolean(search || status || officeId || designation)
  const isEmpty = guards.length === 0

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, CNIC, or Parwest ID…"
              className="pe-8"
            />
            {isPending && (
              <Loader2 className="absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
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
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            Designation
          </label>
          <Select
            value={designation || ALL_VALUE}
            onValueChange={handleDesignation}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Designations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All Designations</SelectItem>
              {designationOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hideOfficePicker ? (
          <div />
        ) : (
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Office
            </label>
            <Select
              value={officeId || ALL_VALUE}
              onValueChange={handleOffice}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Offices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All Offices</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {guards.length} guard{guards.length !== 1 ? "s" : ""} found
        {hasFilters ? " (filtered)" : ""}
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Shield className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div className="text-base font-semibold">No guards found</div>
            <p className="max-w-md text-sm text-muted-foreground">
              No guards match the current filters. Try clearing filters or
              search by name, CNIC, or Parwest ID.
            </p>
            {canCreateGuard && (
              <Button asChild className="mt-2">
                <Link href="/guards/new">
                  <Plus className="me-2 h-4 w-4" />
                  Add Guard
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={guards}
          searchKey="name"
          searchPlaceholder="Filter visible rows by name…"
          pageSize={25}
          enableColumnVisibility
          emptyMessage="No guards match the on-page filter."
        />
      )}
    </div>
  )
}
