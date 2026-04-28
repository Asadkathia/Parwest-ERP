/**
 * Parwest ERP — Payroll: Unpaid Salaries (canonical-template reskin)
 * ────────────────────────────────────────────────────────────────────
 * Mirrors the canonical loans manager template:
 *   - List → `<DataTable>` with `<ParwestCurrency>` for amounts and
 *     status `<Badge>` (with PayrollStateBadge retained as a shared
 *     widget for the `state` column)
 *   - Update form → shadcn `<Form>` (RHF + zodResolver)
 *   - Toasts via sonner; reads `data.message` per the API envelope
 *   - Permission gating via `<PermissionGate>` around update button
 *   - Empty state rendered via shadcn `<Card>`
 *
 * Reskin only — data flow and API endpoints are unchanged.
 *
 * Region picker: this manager round-trips `?regionId` to
 * /api/payroll/unpaid server-side. The global topbar picker is the
 * canonical source of `?regionId`, so the inline `RegionUrlPicker` was
 * removed.
 *
 * Shared widgets retained as-is (out of scope): `GuardAutocomplete`,
 * `PayrollStateBadge`.
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import GuardAutocomplete from "@/components/payroll/shared/GuardAutocomplete"
import PayrollStateBadge from "@/components/payroll/PayrollStateBadge"

import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
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
import { Label } from "@/components/shadcn/label"
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"

import {
  PAYROLL_UNPAID_SALARY_STATUSES,
  payrollUnpaidSalaryUpdateSchema,
  type PayrollUnpaidSalaryUpdateInput,
} from "@/lib/schemas/payroll-unpaid-salary"

type Row = {
  id: string
  month: string
  netSalary: number
  paymentStatus: string
  paymentRemarks: string | null
  paymentUpdatedAt: string | null
  state?: string | null
  holdReason?: string | null
  emergencyReleaseReason?: string | null
  guard: { id: string; parwestId: string; name: string }
}

type Region = { id: string; name: string }

type PayrollUnpaidSalariesManagerProps = {
  canUpdate?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}

const STATUS_FILTER_ALL = "all"

export default function PayrollUnpaidSalariesManager({
  canUpdate = false,
  effectiveRegionId = null,
}: PayrollUnpaidSalariesManagerProps = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL)

  const [parwestIdInput, setParwestIdInput] = useState("")
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)

  const form = useForm<PayrollUnpaidSalaryUpdateInput>({
    resolver: zodResolver(payrollUnpaidSalaryUpdateSchema),
    defaultValues: {
      payrollId: "",
      date: "",
      paymentStatus: undefined as unknown as PayrollUnpaidSalaryUpdateInput["paymentStatus"],
      paymentRemarks: "",
    },
    mode: "onChange",
  })

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("month", `${month}-01`)
      if (search) params.set("search", search)
      if (effectiveRegionId) params.set("regionId", effectiveRegionId)
      const res = await fetch(`/api/payroll/unpaid?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [month, search, effectiveRegionId])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  const handleGuardSelect = async (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    // Look up unpaid row for this guard in current month
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    params.set("guardId", opt.id)
    if (effectiveRegionId) params.set("regionId", effectiveRegionId)
    const res = await fetch(`/api/payroll/salary?${params}`)
    if (res.ok) {
      const all: Row[] = await res.json()
      const row = all.find((r) => r.paymentStatus !== "PAID") ?? all[0] ?? null
      setSelectedRow(row)
      if (row) form.setValue("payrollId", row.id)
    }
  }

  const onSubmit = async (values: PayrollUnpaidSalaryUpdateInput) => {
    if (!selectedRow) {
      toast.error("Select a guard with an unpaid salary first.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/payroll/salary/${selectedRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: values.paymentStatus,
          paymentRemarks: values.paymentRemarks,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Updated salary for ${selectedRow.guard.name}.`)
        setParwestIdInput("")
        setSelectedRow(null)
        form.reset({
          payrollId: "",
          date: "",
          paymentStatus: undefined as unknown as PayrollUnpaidSalaryUpdateInput["paymentStatus"],
          paymentRemarks: "",
        })
        loadRows()
      } else {
        toast.error(data?.message ?? "Failed to update salary.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const filteredRows = useMemo(() => {
    if (statusFilter === STATUS_FILTER_ALL) return rows
    return rows.filter((r) => r.paymentStatus === statusFilter)
  }, [rows, statusFilter])

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: "parwestId",
        accessorFn: (r) => r.guard.parwestId,
        header: "Secure Ops ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.guard.parwestId}
          </span>
        ),
      },
      {
        id: "guardName",
        accessorFn: (r) => r.guard.name,
        header: "Name",
        cell: ({ row }) => row.original.guard.name,
      },
      {
        id: "month",
        accessorFn: (r) => r.month.slice(0, 7),
        header: "Salary Month",
        cell: ({ row }) => row.original.month.slice(0, 7),
      },
      {
        id: "netSalary",
        accessorFn: (r) => r.netSalary,
        header: () => <span className="block text-end">Net</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency value={Number(row.original.netSalary ?? 0)} />
          </div>
        ),
      },
      {
        id: "paymentUpdatedAt",
        accessorFn: (r) => r.paymentUpdatedAt ?? "",
        header: "Dated",
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.paymentUpdatedAt
              ? row.original.paymentUpdatedAt.slice(0, 10)
              : "—"}
          </span>
        ),
      },
      {
        id: "paymentStatus",
        accessorFn: (r) => r.paymentStatus,
        header: "Status",
        cell: ({ row }) => {
          const s = row.original.paymentStatus
          return (
            <Badge
              variant={
                s === "PAID"
                  ? "default"
                  : s === "UNPAID"
                    ? "destructive"
                    : "secondary"
              }
            >
              {s}
            </Badge>
          )
        },
      },
      {
        id: "state",
        accessorFn: (r) => r.state ?? "",
        header: "State",
        cell: ({ row }) =>
          row.original.state ? (
            <PayrollStateBadge
              state={row.original.state}
              reason={
                row.original.holdReason ??
                row.original.emergencyReleaseReason ??
                null
              }
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "remarks",
        accessorFn: (r) => r.paymentRemarks ?? "",
        header: "Remarks",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.paymentRemarks ?? ""}</span>
        ),
      },
    ],
    []
  )

  return (
    <PayrollPageShell
      title="Payroll — Unpaid Salaries"
      subtitle="Update unpaid salary status for a guard and record remarks."
    >
      <Card>
        <CardContent className="space-y-4 p-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/*
                 * Shared widget — kept as-is (out of scope). Drives the
                 * `payrollId` RHF field via `handleGuardSelect`.
                 */}
                <div>
                  <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Parwest ID *
                  </Label>
                  <GuardAutocomplete
                    value={parwestIdInput}
                    onChange={setParwestIdInput}
                    onSelect={handleGuardSelect}
                  />
                  {form.formState.errors.payrollId && (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.payrollId.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Name
                  </Label>
                  <Input
                    value={selectedRow?.guard.name ?? ""}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Salary Status
                  </Label>
                  <Input
                    value={selectedRow?.paymentStatus ?? ""}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Change Status *</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(v) => field.onChange(v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYROLL_UNPAID_SALARY_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
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
                  name="paymentRemarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-end">
                {canUpdate && (
                  <PermissionGate module="PAYROLL" action="UPDATE" mode="hide">
                    <Button type="submit" disabled={!selectedRow || saving}>
                      {saving ? "Updating…" : "Update"}
                    </Button>
                  </PermissionGate>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_200px] gap-3 items-end">
            <div>
              <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Month
              </Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div>
              <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Search
              </Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Parwest ID or name"
              />
            </div>
            <div>
              <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_FILTER_ALL}>All</SelectItem>
                  {PAYROLL_UNPAID_SALARY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Loading…
              </CardContent>
            </Card>
          ) : filteredRows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="text-base font-semibold">
                  No unpaid salaries
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  No unpaid salary records for this month/region.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={filteredRows}
              searchKey="guardName"
              searchPlaceholder="Filter visible rows by name…"
              pageSize={25}
              emptyMessage="No salaries match the on-page filter."
            />
          )}
        </CardContent>
      </Card>
    </PayrollPageShell>
  )
}
