/**
 * Parwest ERP — Payroll Salary V2 (reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * Migrated from the bespoke `ui-card` / `ui-input` legacy markup to the
 * shadcn primitives + DataTable canon defined by PayrollLoansClient.
 *
 * Reskin only — no behavior changes:
 *   - Same fetch contracts (/api/payroll/salary-v2/summary GET,
 *     /api/payroll/salary POST for "Calculate Salary").
 *   - Same URL params: `regionId`, `regionalOfficeId`, `clientId`, `month`.
 *   - Same CSV "Export Index" output.
 *   - Same client-side dropdown scoping by `effectiveRegionId`.
 *   - RegionUrlPicker is preserved (mirrors the canonical loans template;
 *     the picker round-trips `?regionId=` and the page-level
 *     `renderPayrollRegionGate` still relies on it).
 *
 * Sub-components shared across the payroll suite (RegionUrlPicker) are kept
 * untouched, per the migration policy.
 */

"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/shadcn/alert-dialog"
import { Badge } from "@/components/shadcn/badge"
import { Button, buttonVariants } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/form"
import { Input } from "@/components/shadcn/input"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"

import { cn } from "@/lib/utils"
import {
  payrollSalaryV2FilterSchema,
  type PayrollSalaryV2FilterInput,
} from "@/lib/schemas/payroll-salary-v2"

type Client = { id: string; name: string }
type Office = { id: string; name: string }
type Region = { id: string; name: string }
type BranchRow = {
  sr: number
  branchId: string | null
  branchCode: string | null
  branchName: string
  clientId: string | null
  clientName: string
  region: string
  deployGuards: number
  extraGuards: number
  totalSalary: number
  managerId: string | null
}
type Summary = {
  month: string
  summary: {
    activeClients: number
    totalLocations: number
    totalGuards: number
    totalSalary: number
  }
  guardsByType: { Civilian: number; Army: number; Other: number }
  avgSalaryRates: { Civilian: number; Army: number }
  attendanceStats: {
    totalDays: number
    extraDays: number
  }
  branches: BranchRow[]
}

const ALL_VALUE = "__ALL__"

// CSV header column set — preserved verbatim from the legacy export so that
// downstream consumers of the exported file see the same columns/labels.
const CSV_COLUMNS = [
  { id: "sr", label: "Sr" },
  { id: "branchCode", label: "Branch Code" },
  { id: "branchName", label: "Branch Name" },
  { id: "clientName", label: "Client" },
  { id: "region", label: "Region" },
  { id: "deployGuards", label: "Deploy Guards" },
  { id: "extraGuards", label: "Extra Guards" },
  { id: "totalSalary", label: "Total Salary" },
] as const

type PayrollSalaryV2ManagerProps = {
  canCreate?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}

export default function PayrollSalaryV2Manager({
  canCreate = false,
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: PayrollSalaryV2ManagerProps = {}) {
  const [offices, setOffices] = useState<Office[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [calculateOpen, setCalculateOpen] = useState(false)

  // RHF + zod filter form. Mirrors legacy filter validations exactly.
  const form = useForm<PayrollSalaryV2FilterInput>({
    resolver: zodResolver(payrollSalaryV2FilterSchema),
    defaultValues: {
      month: new Date().toISOString().slice(0, 7),
      regionalOfficeId: "",
      clientId: "",
    },
    mode: "onChange",
  })

  const month = form.watch("month")
  const regionalOfficeId = form.watch("regionalOfficeId") ?? ""
  const clientId = form.watch("clientId") ?? ""

  useEffect(() => {
    // Scope option lists to the gate-selected region. For REGIONAL users the
    // server enforces scope regardless; for SuperAdmin we forward `?regionId=`
    // so the dropdowns only contain offices/clients for the picked region.
    const officesUrl = effectiveRegionId
      ? `/api/regional-offices?regionId=${encodeURIComponent(effectiveRegionId)}`
      : "/api/regional-offices"
    const clientsUrl = effectiveRegionId
      ? `/api/clients?regionId=${encodeURIComponent(effectiveRegionId)}`
      : "/api/clients"
    fetch(officesUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.offices ?? data.rows ?? []
        setOffices(list.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })))
      })
      .catch(() => {})
    fetch(clientsUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.clients ?? data.rows ?? []
        setClients(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
    // Reset stale selections that may not exist in the new region.
    form.setValue("regionalOfficeId", "")
    form.setValue("clientId", "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRegionId])

  const generate = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    if (regionalOfficeId) params.set("regionalOfficeId", regionalOfficeId)
    if (clientId) params.set("clientId", clientId)
    if (effectiveRegionId) params.set("regionId", effectiveRegionId)
    try {
      const res = await fetch(`/api/payroll/salary-v2/summary?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSummary(await res.json())
    } catch (e) {
      setFetchError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [month, regionalOfficeId, clientId, effectiveRegionId])

  useEffect(() => {
    generate()
  }, [generate])

  const calculateSalary = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/payroll/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: `${month}-01`,
          regionalOfficeId: regionalOfficeId || undefined,
          clientId: clientId || undefined,
          regionId: effectiveRegionId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const warningSuffix = data.warnings?.length
          ? ` ${data.warnings.length} zero-salary warning(s).`
          : ""
        toast.success(`Calculated ${data.calculated} rows.${warningSuffix}`)
        generate()
      } else {
        toast.error(data?.message ?? "Failed to calculate salary.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setBusy(false)
      setCalculateOpen(false)
    }
  }

  const exportIndex = () => {
    if (!summary) return
    const header = CSV_COLUMNS.map((c) => c.label)
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [header.join(",")]
      .concat(
        summary.branches.map((b) =>
          [
            b.sr,
            b.branchCode,
            b.branchName,
            b.clientName,
            b.region,
            b.deployGuards,
            b.extraGuards,
            b.totalSalary,
          ]
            .map(escape)
            .join(",")
        )
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `salary-v2-index-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const branches = summary?.branches ?? []

  const columns = useMemo<ColumnDef<BranchRow>[]>(
    () => [
      {
        id: "sr",
        accessorFn: (r) => r.sr,
        header: "Sr",
        cell: ({ row }) => row.original.sr,
      },
      {
        id: "branchCode",
        accessorFn: (r) => r.branchCode ?? "",
        header: "Branch Code",
        cell: ({ row }) => row.original.branchCode ?? "—",
      },
      {
        id: "branchName",
        accessorFn: (r) => r.branchName,
        header: "Branch Name",
        cell: ({ row }) => row.original.branchName,
      },
      {
        id: "clientName",
        accessorFn: (r) => r.clientName,
        header: "Client",
        cell: ({ row }) => row.original.clientName,
      },
      {
        id: "region",
        accessorFn: (r) => r.region,
        header: "Region",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.region || "—"}</Badge>
        ),
      },
      {
        id: "deployGuards",
        accessorFn: (r) => r.deployGuards,
        header: () => <span className="block text-end">Deploy Guards</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums">{row.original.deployGuards}</div>
        ),
      },
      {
        id: "extraGuards",
        accessorFn: (r) => r.extraGuards,
        header: () => <span className="block text-end">Extra Guards</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums">{row.original.extraGuards}</div>
        ),
      },
      {
        id: "totalSalary",
        accessorFn: (r) => r.totalSalary,
        header: () => <span className="block text-end">Total Salary</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency value={Number(row.original.totalSalary)} />
          </div>
        ),
      },
      {
        id: "action",
        header: "Action",
        enableHiding: false,
        cell: ({ row }) =>
          row.original.branchId ? (
            <Link
              href={`/payroll/salary-v2/branch/${row.original.branchId}?month=${month}`}
              className="text-primary text-xs underline"
            >
              Details
            </Link>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
    ],
    [month]
  )

  return (
    <PayrollPageShell
      title="Payroll — Salary V2"
      subtitle="Salary dashboard and per-branch rollup."
    >
      <Card>
        <CardContent className="space-y-4 p-4">
          <Form {...form}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void generate()
              }}
              className="grid grid-cols-1 md:grid-cols-[200px_200px_1fr_1fr_auto_auto_auto] gap-3 items-end"
            >
              <div>
                <RegionUrlPicker
                  regions={regions}
                  locked={locked}
                  includeGlobalOption={!locked}
                />
              </div>
              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                      Salary Month *
                    </FormLabel>
                    <FormControl>
                      <Input type="month" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="regionalOfficeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                      Regional Office
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || ALL_VALUE}
                        onValueChange={(v) =>
                          field.onChange(v === ALL_VALUE ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Regions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_VALUE}>All Regions</SelectItem>
                          {offices.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                      Client
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || ALL_VALUE}
                        onValueChange={(v) =>
                          field.onChange(v === ALL_VALUE ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Clients" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_VALUE}>All Clients</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading}>
                {loading ? "Loading…" : "Generate"}
              </Button>
              {canCreate && (
                <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                  <AlertDialog
                    open={calculateOpen}
                    onOpenChange={setCalculateOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <Button type="button" disabled={busy}>
                        {busy ? "Calculating…" : "Calculate Salary"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Calculate salary for {month}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This recomputes payroll rows for every guard matching
                          the current filters
                          {effectiveRegionId
                            ? " in the selected region"
                            : ""}
                          {regionalOfficeId ? ", regional office," : ""}
                          {clientId ? " and client" : ""}. Existing payroll rows
                          for this month will be overwritten.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>
                          Keep open
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className={cn(
                            buttonVariants({ variant: "destructive" })
                          )}
                          onClick={(e) => {
                            e.preventDefault()
                            void calculateSalary()
                          }}
                          disabled={busy}
                        >
                          {busy ? "Calculating…" : "Calculate"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </PermissionGate>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={exportIndex}
                disabled={!summary}
              >
                Export Index
              </Button>
            </form>
          </Form>
          {fetchError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Failed to load summary: {fetchError}
            </div>
          )}
        </CardContent>
      </Card>

      {summary && (
        <>
          <Card>
            <CardContent className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-md p-4 text-center font-semibold text-white">
              Salary Summary Dashboard — {summary.month}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Active Clients"
              value={summary.summary.activeClients}
            />
            <StatCard
              label="Total Locations"
              value={summary.summary.totalLocations}
            />
            <StatCard label="Total Guards" value={summary.summary.totalGuards} />
            <StatCard
              label="Total Salary"
              value={
                <ParwestCurrency
                  value={Number(summary.summary.totalSalary)}
                  compact
                />
              }
              highlight
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InfoCard title="Guards by Type">
              <KV
                k="Civilian"
                v={summary.guardsByType.Civilian.toLocaleString()}
              />
              <KV k="Army" v={summary.guardsByType.Army.toLocaleString()} />
              {summary.guardsByType.Other > 0 && (
                <KV
                  k="Other"
                  v={summary.guardsByType.Other.toLocaleString()}
                />
              )}
            </InfoCard>
            <InfoCard title="Avg Salary Rates">
              <KV
                k="Civilian"
                v={
                  <ParwestCurrency
                    value={Number(summary.avgSalaryRates.Civilian)}
                    compact={false}
                  />
                }
              />
              <KV
                k="Army"
                v={
                  <ParwestCurrency
                    value={Number(summary.avgSalaryRates.Army)}
                    compact={false}
                  />
                }
              />
            </InfoCard>
            <InfoCard title="Attendance Stats">
              <KV
                k="Total Days"
                v={summary.attendanceStats.totalDays.toLocaleString()}
              />
              <KV
                k="Extra Days"
                v={summary.attendanceStats.extraDays.toLocaleString()}
              />
            </InfoCard>
          </div>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-semibold">Salary Report Data</h3>
              </div>
              {branches.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <div className="text-base font-semibold">
                      No branches for this selection
                    </div>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Adjust the filters above and click Generate to refresh the
                      branch rollup.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <DataTable
                  columns={columns}
                  data={branches}
                  searchKey="branchName"
                  searchPlaceholder="Filter branches by name…"
                  pageSize={25}
                  emptyMessage="No branches match the on-page filter."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PayrollPageShell>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Card className={cn(highlight && "border-primary bg-primary/5")}>
      <CardContent className="p-4 text-center">
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function InfoCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 text-sm font-semibold text-primary">{title}</div>
        <div className="space-y-1 text-sm">{children}</div>
      </CardContent>
    </Card>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}:</span>
      <span className="font-semibold">{v}</span>
    </div>
  )
}
