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
const PAYMENT_METHODS = ["BANK", "CASH", "MOBILE"] as const
const PAYABLE_STATE_OPTIONS = [
  "REGIONAL_LOCKED",
  "GLOBAL_FINALIZED",
  "EMERGENCY_RELEASED",
] as const

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
  // F-2: marking PAID now goes through the state machine
  // (POST /api/payroll/state/mark-paid), which REQUIRES a payment method.
  // The shared zod schema (out of this lane) doesn't model paymentMethod, so
  // it's kept as local state.
  const [paymentMethod, setPaymentMethod] = useState<string>("")

  const form = useForm<PayrollUnpaidSalaryUpdateInput>({
    resolver: zodResolver(payrollUnpaidSalaryUpdateSchema),
    defaultValues: {
      payrollId: "",
      date: "",
      paymentStatus: "PAID",
      paymentRemarks: "",
    },
    mode: "onChange",
  })

  // A row is markable as PAID only from a payable state (mirrors
  // /api/payroll/state/mark-paid and /api/payroll/unpaid).
  const PAYABLE_STATES = useMemo(
    () => new Set(["REGIONAL_LOCKED", "GLOBAL_FINALIZED", "EMERGENCY_RELEASED"]),
    []
  )
  const selectedIsPayable = !!selectedRow?.state && PAYABLE_STATES.has(selectedRow.state)

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
      // Prefer a payable, not-yet-paid row; fall back to first non-paid, then first.
      const row =
        all.find(
          (r) => r.paymentStatus !== "PAID" && !!r.state && PAYABLE_STATES.has(r.state)
        ) ??
        all.find((r) => r.paymentStatus !== "PAID") ??
        all[0] ??
        null
      setSelectedRow(row)
      if (row) form.setValue("payrollId", row.id)
    }
  }

  const onSubmit = async (values: PayrollUnpaidSalaryUpdateInput) => {
    if (!selectedRow) {
      toast.error("Select a guard with a payable salary first.")
      return
    }
    if (!selectedIsPayable) {
      toast.error(
        `Cannot mark PAID from state ${selectedRow.state ?? "unknown"}. Lock or finalize the payroll first.`
      )
      return
    }
    if (!paymentMethod) {
      toast.error("Select a payment method.")
      return
    }
    setSaving(true)
    try {
      // F-2: route through the state machine so `state` and `paymentStatus`
      // stay in lock-step. This rejects (409) if the row left a payable state.
      const res = await fetch(`/api/payroll/state/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollId: selectedRow.id,
          paymentMethod,
          paymentRemarks: values.paymentRemarks,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Marked salary PAID for ${selectedRow.guard.name}.`)
        setParwestIdInput("")
        setSelectedRow(null)
        setPaymentMethod("")
        form.reset({
          payrollId: "",
          date: "",
          paymentStatus: "PAID",
          paymentRemarks: "",
        })
        loadRows()
      } else {
        // Surface the precise 400/409 from the close workflow.
        toast.error(data?.message ?? "Failed to mark salary as PAID.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // The list only returns PENDING + payable rows now, so filtering by
  // paymentStatus is meaningless. Filter by `state` (the meaningful dimension)
  // instead.
  const filteredRows = useMemo(() => {
    if (statusFilter === STATUS_FILTER_ALL) return rows
    return rows.filter((r) => r.state === statusFilter)
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
      subtitle="Mark payable salaries (locked/finalized/emergency-released) as PAID and record the payment method and remarks."
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
                    Payroll State
                  </Label>
                  <Input
                    value={selectedRow?.state ?? selectedRow?.paymentStatus ?? ""}
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
                {/*
                 * F-2: payment is a state-machine action now. The only
                 * operation this page performs is "mark PAID" via
                 * POST /api/payroll/state/mark-paid, which requires a payment
                 * method (BANK/CASH/MOBILE). The old PAID/UNPAID status select
                 * was removed — UNPAID is no longer producible by the pipeline
                 * (F-10) and PAID must go through the close workflow.
                 */}
                <FormItem>
                  <FormLabel>Payment Method *</FormLabel>
                  <FormControl>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Method" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
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

              {selectedRow && !selectedIsPayable && (
                <p className="text-xs text-destructive">
                  This payroll is in state{" "}
                  <span className="font-mono">{selectedRow.state ?? "unknown"}</span> and
                  cannot be marked PAID. It must reach REGIONAL_LOCKED,
                  GLOBAL_FINALIZED, or EMERGENCY_RELEASED via the close workflow first.
                </p>
              )}

              <div className="flex items-center justify-end">
                {canUpdate && (
                  <PermissionGate module="PAYROLL" action="UPDATE" mode="hide">
                    <Button
                      type="submit"
                      disabled={!selectedRow || !selectedIsPayable || saving}
                    >
                      {saving ? "Marking Paid…" : "Mark Paid"}
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
                State
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_FILTER_ALL}>All</SelectItem>
                  {PAYABLE_STATE_OPTIONS.map((s) => (
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
                  No payable salaries
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  No locked/finalized salaries awaiting payment for this
                  month/region. Lock or finalize a region to make its salaries
                  payable.
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
