/**
 * Parwest ERP — Payroll: Other Deductions (canonical-template reskin)
 * ────────────────────────────────────────────────────────────────────
 * Mirrors the canonical loans manager template:
 *   - List → `<DataTable>` with `<ParwestCurrency>` for amounts
 *   - Create form → shadcn `<Form>` (RHF + zodResolver) inside `<Dialog>`
 *   - Toasts via sonner; reads `data.message` per the API envelope
 *   - Permission gating via `<PermissionGate>` around create button
 *   - Empty state rendered via shadcn `<Card>`
 *
 * Reskin only — data flow and API endpoints are unchanged.
 *
 * Region picker: this manager round-trips `?regionId` to
 * /api/payroll/other-deductions server-side. The global topbar picker
 * is the canonical source of `?regionId`, so the inline
 * `RegionUrlPicker` was removed.
 *
 * Shared widgets retained as-is (out of scope): `GuardAutocomplete`,
 * `GuardContextFields`.
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import GuardAutocomplete from "@/components/payroll/shared/GuardAutocomplete"
import GuardContextFields from "@/components/payroll/shared/GuardContextFields"
import type { GuardCurrentContext } from "@/lib/guards/currentContext"

import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog"
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
  payrollOtherDeductionCreateSchema,
  type PayrollOtherDeductionCreateInput,
} from "@/lib/schemas/payroll-other-deduction"

type Row = {
  id: string
  month: string
  otherDeductions: number
  guard: { id: string; name: string; parwestId: string }
}

type Region = { id: string; name: string }

type PayrollOtherDeductionsManagerProps = {
  canCreate?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}

export default function PayrollOtherDeductionsManager({
  canCreate = false,
  effectiveRegionId = null,
}: PayrollOtherDeductionsManagerProps = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [saving, setSaving] = useState(false)

  const form = useForm<PayrollOtherDeductionCreateInput>({
    resolver: zodResolver(payrollOtherDeductionCreateSchema),
    defaultValues: {
      guardId: "",
      month,
      amount: undefined as unknown as number,
      dated: "",
      notes: "",
    },
    mode: "onChange",
  })

  // Keep RHF month in sync with the local filter month while the form is
  // open (matches legacy: month is shared between filter and form).
  useEffect(() => {
    form.setValue("month", month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  // Prefer the canonical `lifecycleStatus` for the displayed Status field,
  // falling back to the legacy `status` shadow when absent. Additive + safe.
  const displayContext = useMemo<GuardCurrentContext | null>(
    () =>
      context
        ? { ...context, status: context.lifecycleStatus ?? context.status }
        : null,
    [context]
  )

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("month", `${month}-01`)
      if (search) params.set("search", search)
      if (effectiveRegionId) params.set("regionId", effectiveRegionId)
      const res = await fetch(`/api/payroll/other-deductions?${params}`)
      if (res.ok) {
        const raw = await res.json()
        // Envelope-aware: accept both ok({ success, data: [] }) and legacy raw array.
        const data = Array.isArray(raw?.data) ? raw.data : raw
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
    const res = await fetch(
      `/api/guards/${opt.id}/current-context?month=${month}`
    )
    if (res.ok) {
      const ctx = (await res.json()) as GuardCurrentContext
      setContext(ctx)
      form.setValue("guardId", ctx.guardId)
    }
  }

  const resetForm = () => {
    setParwestIdInput("")
    setContext(null)
    form.reset({
      guardId: "",
      month,
      amount: undefined as unknown as number,
      dated: "",
      notes: "",
    })
  }

  const onSubmit = async (values: PayrollOtherDeductionCreateInput) => {
    if (!context) {
      toast.error("Select a guard first.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/payroll/other-deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: context.guardId,
          month: `${values.month}-01`,
          amount: Number(values.amount),
          notes: values.notes || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Deduction saved for ${context.name}.`)
        setFormOpen(false)
        resetForm()
        loadRows()
      } else {
        toast.error(data?.message ?? "Failed to save deduction.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

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
        header: "Month",
        cell: ({ row }) => row.original.month.slice(0, 7),
      },
      {
        id: "amount",
        accessorFn: (r) => r.otherDeductions,
        header: () => <span className="block text-end">Amount</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency
              value={Number(row.original.otherDeductions ?? 0)}
            />
          </div>
        ),
      },
    ],
    []
  )

  return (
    <PayrollPageShell
      title="Payroll — Other Deductions"
      subtitle="Record ad-hoc deductions per guard per month."
      actions={
        canCreate ? (
          <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
            <Button onClick={() => setFormOpen(true)}>+ Add Deduction</Button>
          </PermissionGate>
        ) : undefined
      }
    >
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 items-end">
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
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Loading…
              </CardContent>
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="text-base font-semibold">No records</div>
                <p className="max-w-md text-sm text-muted-foreground">
                  No other-deduction records for this month/region.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              searchKey="guardName"
              searchPlaceholder="Filter visible rows by name…"
              pageSize={25}
              emptyMessage="No deductions match the on-page filter."
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Other Deductions</DialogTitle>
            <DialogDescription>
              Record an ad-hoc deduction for a guard for the selected month.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              {/*
               * Shared widget — kept as-is (out of scope). Drives the
               * `guardId` RHF field via `handleGuardSelect`.
               */}
              <div>
                <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Secure Ops ID *
                </Label>
                <GuardAutocomplete
                  value={parwestIdInput}
                  onChange={setParwestIdInput}
                  onSelect={handleGuardSelect}
                  regionId={effectiveRegionId}
                />
                {form.formState.errors.guardId && (
                  <p className="mt-1 text-xs text-destructive">
                    {form.formState.errors.guardId.message as string}
                  </p>
                )}
              </div>

              <GuardContextFields
                context={displayContext}
                showRows={["name", "status", "type", "location"]}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dated"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dated</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          value={
                            field.value === undefined || field.value === null
                              ? ""
                              : String(field.value)
                          }
                          onChange={(e) => {
                            const v = e.target.value
                            field.onChange(v === "" ? undefined : Number(v))
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false)
                    resetForm()
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                  <Button type="submit" disabled={!context || saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </PermissionGate>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </PayrollPageShell>
  )
}
