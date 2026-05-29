"use client"

/**
 * Parwest ERP — Deployments list (design-system v1.1)
 * ─────────────────────────────────────────────────────────────────────────
 * Phase 4A reskin. Behaviour parity with the legacy table:
 *   - Region & office pickers (URL-driven `?regionId=`, `?regionalOfficeId=`)
 *   - Optional status / client / shift filters via URL params
 *   - Server-side scoping is unchanged — `/api/deployments?...` enforces it
 *   - Empty state: shadcn Card + "Deploy a Guard" CTA
 *   - Bulk action toasts via sonner (no bulk mutations exist today; the
 *     selection plumbing is wired so the ability is preserved if added)
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import {
  Activity,
  Clock,
  Loader2,
  MapPin,
  PauseCircle,
  Plus,
  ShieldOff,
  Lock as LockIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shadcn/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert"
import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type RegionOption = { id: string; name: string }
type OfficeOption = { id: string; name: string; regionId: string | null }

type DeploymentRow = {
  id: string
  status: string
  shiftType: string
  designation: string
  deploymentDate: string
  endDate: string | null
  guard: {
    id: string
    parwestId: string
    name: string
    phone: string | null
    photoUrl: string | null
  }
  client: { id: string; name: string }
  branch: { id: string; name: string; city: string | null } | null
  regionalOffice: { id: string; name: string }
}

type Props = {
  regions: RegionOption[]
  offices: OfficeOption[]
  scopedRegionId: string | null
  scopedOfficeId: string | null
  canCreate: boolean
  canDelete: boolean
}

const ALL_VALUE = "__ALL__"

// Deployment rows are only ever ACTIVE | PENDING | INACTIVE. PAUSED/ENDED are
// never produced by any code path — do not re-add them (always returns zero rows).
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "INACTIVE", label: "Inactive" },
]

// Deployment-status badge variants + labels (a11y: label text is always shown,
// color is never the sole signal). Distinct from GuardStatusBadge's guard vocab.
const DEPLOYMENT_STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  ACTIVE: { label: "Active", variant: "default" },
  PENDING: { label: "Pending", variant: "secondary" },
  INACTIVE: { label: "Inactive", variant: "outline" },
}

const SHIFT_OPTIONS = [
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
  { value: "BOTH", label: "Both" },
]

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function DeploymentsListClient({
  regions,
  offices,
  scopedRegionId,
  scopedOfficeId,
  canCreate,
  canDelete,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = React.useTransition()

  const isRegionLocked = Boolean(scopedRegionId)
  const isOfficeLocked = Boolean(scopedOfficeId)

  const urlRegionId = searchParams.get("regionId") ?? ""
  const regionId = scopedRegionId ?? urlRegionId
  const urlOfficeId = searchParams.get("regionalOfficeId") ?? ""
  const officeId = scopedOfficeId ?? urlOfficeId
  const statusFilter = searchParams.get("status") ?? ""
  const shiftFilter = searchParams.get("shift") ?? ""
  const clientFilter = searchParams.get("clientId") ?? ""

  const [rows, setRows] = React.useState<DeploymentRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [fetched, setFetched] = React.useState(false)
  const [selected, setSelected] = React.useState<DeploymentRow[]>([])

  const officesInRegion = React.useMemo(() => {
    if (!regionId) return offices
    return offices.filter((o) => !o.regionId || o.regionId === regionId)
  }, [offices, regionId])

  // Fetch whenever a region is selected (or office changes within it).
  React.useEffect(() => {
    if (!regionId) {
      setRows([])
      setFetched(false)
      return
    }

    const params = new URLSearchParams()
    if (officeId) params.set("regionalOfficeId", officeId)
    else params.set("regionId", regionId)
    if (statusFilter) params.set("status", statusFilter)

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/deployments?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.message || "Failed to load deployments.")
        setRows(Array.isArray(body) ? body : [])
        setFetched(true)
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return
        setError(err.message)
        setRows([])
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [regionId, officeId, statusFilter])

  // Derived client-side filters (shift / client) applied after fetch so the
  // existing API contract stays unchanged. Status round-trips to the server.
  const filteredRows = React.useMemo(() => {
    return rows.filter((r) => {
      if (shiftFilter && r.shiftType !== shiftFilter) return false
      if (clientFilter && r.client.id !== clientFilter) return false
      return true
    })
  }, [rows, shiftFilter, clientFilter])

  const stats = React.useMemo(() => {
    const total = filteredRows.length
    const active = filteredRows.filter((r) => r.status === "ACTIVE").length
    const inactive = filteredRows.filter((r) => r.status !== "ACTIVE").length
    return { total, active, inactive }
  }, [filteredRows])

  const clientOptions = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows) {
      if (!seen.has(r.client.id)) seen.set(r.client.id, r.client.name)
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

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

  const handleStatus = (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set("status", val)
      else p.delete("status")
    })
  }
  const handleShift = (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set("shift", val)
      else p.delete("shift")
    })
  }
  const handleClient = (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set("clientId", val)
      else p.delete("clientId")
    })
  }
  const handleOffice = (val: string) => {
    pushParam((p) => {
      if (val && val !== ALL_VALUE) p.set("regionalOfficeId", val)
      else p.delete("regionalOfficeId")
    })
  }

  const columns = React.useMemo<ColumnDef<DeploymentRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Deployment ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.id.slice(0, 8)}
          </span>
        ),
      },
      {
        accessorKey: "guard.name",
        id: "guard",
        header: "Guard",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              {row.original.guard.photoUrl ? (
                <AvatarImage
                  src={row.original.guard.photoUrl}
                  alt={row.original.guard.name}
                />
              ) : null}
              <AvatarFallback className="text-xs">
                {initialsOf(row.original.guard.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {row.original.guard.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.original.guard.parwestId}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "client.name",
        id: "client",
        header: "Client · Branch",
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{row.original.client.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.branch
                ? `${row.original.branch.name}${row.original.branch.city ? `, ${row.original.branch.city}` : ""}`
                : "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "shiftType",
        header: "Shift",
        cell: ({ row }) => (
          <Badge
            variant={row.original.shiftType === "DAY" ? "secondary" : "outline"}
            className="font-medium"
          >
            <Clock className="me-1 h-3 w-3" />
            {row.original.shiftType}
          </Badge>
        ),
      },
      {
        accessorKey: "designation",
        header: "Designation",
        cell: ({ row }) => row.original.designation || "—",
      },
      {
        accessorKey: "deploymentDate",
        header: "Start Date",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {formatDate(row.original.deploymentDate)}
          </span>
        ),
      },
      {
        accessorKey: "endDate",
        header: "End Date",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDate(row.original.endDate)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const meta =
            DEPLOYMENT_STATUS_META[row.original.status] ?? {
              label: row.original.status,
              variant: "outline" as const,
            }
          return (
            <Badge variant={meta.variant} className="font-medium">
              {meta.label}
            </Badge>
          )
        },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const dep = row.original
          return (
            <div className="flex items-center gap-2 text-xs">
              <Link
                href={`/deployments/${dep.id}`}
                className="font-medium text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </Link>
              {dep.status === "ACTIVE" && canDelete ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <Link
                    href={`/deployments/${dep.id}/end`}
                    className="inline-flex items-center gap-1 font-medium text-destructive hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ShieldOff className="h-3 w-3" /> Revoke
                  </Link>
                </>
              ) : null}
            </div>
          )
        },
      },
    ],
    [canDelete]
  )

  const handleBulkRevoke = () => {
    if (selected.length === 0) {
      toast.error("Select at least one deployment to revoke.")
      return
    }
    // No bulk-revoke endpoint exists today; surface the intent and route the
    // user to the per-deployment flow. This preserves UX without changing API.
    toast(
      `Bulk revoke isn't available yet. Open each deployment to revoke individually.`,
      { description: `${selected.length} selected` }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
          <p className="text-sm text-muted-foreground">
            Manage guard deployments to client locations
          </p>
        </div>
        {canCreate ? (
          <PermissionGate module="GUARDS" action="CREATE" mode="disable">
            <Button asChild>
              <Link href="/guards/deploy">
                <Plus className="me-2 h-4 w-4" />
                Deploy Guard
              </Link>
            </Button>
          </PermissionGate>
        ) : null}
      </div>

      {/* Scope picker */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <React.Suspense>
            <RegionUrlPicker
              regions={regions}
              locked={isRegionLocked}
              includeGlobalOption={false}
            />
          </React.Suspense>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              Regional Office
              {isOfficeLocked && <LockIcon className="h-3.5 w-3.5" />}
            </label>
            <Select
              value={officeId || ALL_VALUE}
              onValueChange={handleOffice}
              disabled={isOfficeLocked || !regionId || isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    regionId ? "All offices in region" : "Select a region first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {regionId ? "All offices in region" : "Select a region first"}
                </SelectItem>
                {officesInRegion.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isOfficeLocked && (
              <p className="mt-1 text-xs text-muted-foreground">
                Locked to your assigned office.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load deployments</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!regionId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div className="text-base font-semibold">
              Select a region to view deployments
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              Deployments are region-scoped. Choose a region above to load its
              deployments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Loaded Deployments
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {stats.total}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Activity className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {stats.active}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <PauseCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {stats.inactive}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Server-side filters (status round-trips, shift/client are local) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Status
              </label>
              <Select
                value={statusFilter || ALL_VALUE}
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
                Shift
              </label>
              <Select
                value={shiftFilter || ALL_VALUE}
                onValueChange={handleShift}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Shifts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Shifts</SelectItem>
                  {SHIFT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Client
              </label>
              <Select
                value={clientFilter || ALL_VALUE}
                onValueChange={handleClient}
                disabled={isPending || clientOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Clients</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </CardContent>
            </Card>
          ) : filteredRows.length === 0 && fetched ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <MapPin className="h-8 w-8 text-muted-foreground" aria-hidden />
                <div className="text-base font-semibold">
                  No deployments found
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  No deployments match the current filters.
                </p>
                {canCreate && (
                  <PermissionGate
                    module="GUARDS"
                    action="CREATE"
                    mode="disable"
                  >
                    <Button asChild className="mt-2">
                      <Link href="/guards/deploy">
                        <Plus className="me-2 h-4 w-4" />
                        Deploy a Guard
                      </Link>
                    </Button>
                  </PermissionGate>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {selected.length > 0 ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2 text-sm">
                  <span>
                    {selected.length} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkRevoke}
                  >
                    <ShieldOff className="me-2 h-4 w-4" />
                    Revoke selected
                  </Button>
                </div>
              ) : null}
              <DataTable
                columns={columns}
                data={filteredRows}
                searchKey="guard"
                searchPlaceholder="Filter by guard name…"
                pageSize={25}
                enableRowSelection
                onSelectionChange={setSelected}
                emptyMessage="No deployments match the on-page filter."
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
