/**
 * Parwest ERP — Payroll: Extra Hours (canonical reskin)
 * ─────────────────────────────────────────────────────
 * Reskinned to match the canonical payroll-loans template:
 *  - List → `<DataTable>` with `<ParwestCurrency>` for amounts
 *  - Form → shadcn `<Form>` (RHF + zodResolver) inside a `<Dialog>`
 *  - Permission gates around Add buttons
 *  - Toasts via sonner reading `data.message`
 *
 * Behaviour, API endpoints, and URL contract are preserved exactly.
 * Shared widgets (GuardAutocomplete, GuardContextFields, RegionUrlPicker)
 * are kept as-is per migration policy.
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
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import { DataTable } from "@/components/shadcn/data-table"
import {
  Dialog,
  DialogContent,
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
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"

import type { GuardCurrentContext } from "@/lib/guards/currentContext"
import {
  payrollExtraHoursCreateSchema,
  type PayrollExtraHoursCreateInput,
} from "@/lib/schemas/payroll-extra-hours"

type Row = {
  id: string
  month: string
  extraHours: number
  extraHoursAmount: number
  guard: { id: string; name: string; parwestId: string }
}

type Client = { id: string; name: string }
type Branch = { id: string; name: string; clientId: string }
type Region = { id: string; name: string }

type PayrollExtraHoursManagerProps = {
  canCreate?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}

const ALL_VALUE = "__ALL__"

export default function PayrollExtraHoursManager({
  canCreate = false,
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: PayrollExtraHoursManagerProps = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [saving, setSaving] = useState(false)

  const form = useForm<PayrollExtraHoursCreateInput>({
    resolver: zodResolver(payrollExtraHoursCreateSchema),
    defaultValues: {
      guardId: "",
      month,
      hours: undefined as unknown as number,
      rate: undefined as unknown as number,
      selectClientId: "",
      selectBranchId: "",
    },
    mode: "onChange",
  })

  // Keep RHF month synced with local state (drives context/list fetches).
  useEffect(() => {
    form.setValue("month", month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const selectClientId = form.watch("selectClientId") ?? ""

  const loadRows = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    if (search) params.set("search", search)
    if (effectiveRegionId) params.set("regionId", effectiveRegionId)
    try {
      const res = await fetch(`/api/payroll/extra-hours?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRows(await res.json())
    } catch (e) {
      setFetchError((e as Error).message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [month, search, effectiveRegionId])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  useEffect(() => {
    if (!formOpen) return
    // Scope clients to the gate-selected region for SuperAdmin; REGIONAL
    // users are scoped server-side already.
    const url = effectiveRegionId
      ? `/api/clients?regionId=${encodeURIComponent(effectiveRegionId)}`
      : "/api/clients"
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.clients ?? data.rows ?? []
        setClients(
          list.map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          }))
        )
      })
      .catch(() => {})
  }, [formOpen, effectiveRegionId])

  useEffect(() => {
    if (!selectClientId) {
      setBranches([])
      return
    }
    fetch(`/api/branches?clientId=${selectClientId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches ?? data.rows ?? []
        setBranches(list)
      })
      .catch(() => {})
  }, [selectClientId])

  const handleGuardSelect = async (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    const res = await fetch(
      `/api/guards/${opt.id}/current-context?month=${month}`
    )
    if (res.ok) {
      const ctx = (await res.json()) as GuardCurrentContext
      setContext(ctx)
      form.setValue("guardId", ctx.guardId)
    } else {
      setContext(null)
      form.setValue("guardId", "")
    }
  }

  const resetForm = () => {
    setParwestIdInput("")
    setContext(null)
    form.reset({
      guardId: "",
      month,
      hours: undefined as unknown as number,
      rate: undefined as unknown as number,
      selectClientId: "",
      selectBranchId: "",
    })
  }

  const onSubmit = async (values: PayrollExtraHoursCreateInput) => {
    if (!context) {
      toast.error("Select a guard first.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/payroll/extra-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: context.guardId,
          month: `${values.month}-01`,
          hours: Number(values.hours),
          rate: Number(values.rate),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Saved for ${context.name}.`)
        resetForm()
        setFormOpen(false)
        loadRows()
      } else {
        toast.error(data?.message ?? "Failed to save extra hours.")
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
        header: "Parwest ID",
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
        id: "hours",
        accessorFn: (r) => r.extraHours,
        header: () => <span className="block text-end">Hours</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums">
            {row.original.extraHours}
          </div>
        ),
      },
      {
        id: "amount",
        accessorFn: (r) => r.extraHoursAmount,
        header: () => <span className="block text-end">Amount</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency value={Number(row.original.extraHoursAmount ?? 0)} />
          </div>
        ),
      },
    ],
    []
  )

  return (
    <PayrollPageShell
      title="Payroll — Extra Hours"
      subtitle="Record monthly extra-hour adjustments per guard."
      actions={
        canCreate ? (
          <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
            <Button onClick={() => setFormOpen(true)}>+ Add Extra Hours</Button>
          </PermissionGate>
        ) : undefined
      }
    >
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-[200px_200px_1fr] gap-3 items-end">
            <div>
              <RegionUrlPicker
                regions={regions}
                locked={locked}
                includeGlobalOption={!locked}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Month
              </label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Search
              </label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Parwest ID or name"
              />
            </div>
          </div>

          {fetchError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
              Failed to load extra-hours records: {fetchError}
            </div>
          )}

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
                  No extra-hour entries for this month/region.
                </p>
                {canCreate && (
                  <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                    <Button variant="outline" onClick={() => setFormOpen(true)}>
                      + Add Extra Hours
                    </Button>
                  </PermissionGate>
                )}
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              searchKey="guardName"
              searchPlaceholder="Filter visible rows by name…"
              pageSize={25}
              emptyMessage="No extra-hour records match the on-page filter."
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Extra Hours</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Secure Ops ID *
                  </label>
                  <GuardAutocomplete
                    value={parwestIdInput}
                    onChange={setParwestIdInput}
                    onSelect={handleGuardSelect}
                    regionId={effectiveRegionId}
                  />
                  {context ? (
                    <Badge variant="secondary" className="mt-2">
                      {context.name}
                    </Badge>
                  ) : null}
                </div>
                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours *</FormLabel>
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
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate *</FormLabel>
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

              <GuardContextFields
                context={context}
                showRows={["name", "status", "type", "location"]}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="selectClientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Client</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || ALL_VALUE}
                          onValueChange={(v) => {
                            const next = v === ALL_VALUE ? "" : v
                            field.onChange(next)
                            form.setValue("selectBranchId", "")
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="--Select Client--" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_VALUE}>
                              --Select Client--
                            </SelectItem>
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
                <FormField
                  control={form.control}
                  name="selectBranchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Branch</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || ALL_VALUE}
                          onValueChange={(v) =>
                            field.onChange(v === ALL_VALUE ? "" : v)
                          }
                          disabled={!selectClientId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="--Select Branch--" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_VALUE}>
                              --Select Branch--
                            </SelectItem>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Month
                  </label>
                  <Input type="month" value={month} readOnly />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                  <Button type="submit" disabled={saving || !context}>
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
