/**
 * Parwest ERP — Payroll: Special Duty (canonical reskin)
 * ──────────────────────────────────────────────────────
 * Reskinned to match the canonical payroll-loans template:
 *  - List → `<DataTable>` with `<ParwestCurrency>` for amounts
 *  - Form → shadcn `<Form>` (RHF + zodResolver) inside a `<Dialog>`
 *  - Cancel (delete) → `<AlertDialog>` with destructive variant
 *  - Permission gates around Add / Cancel buttons
 *  - Toasts via sonner reading `data.message`
 *
 * Behaviour, API endpoints, and URL contract are preserved exactly.
 * Shared widgets (GuardAutocomplete, GuardContextFields, Base64FileUpload,
 * RegionUrlPicker) are kept as-is per migration policy.
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
import Base64FileUpload from "@/components/payroll/shared/Base64FileUpload"
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
import { Textarea } from "@/components/shadcn/textarea"

import { cn } from "@/lib/utils"
import type { GuardCurrentContext } from "@/lib/guards/currentContext"
import {
  payrollSpecialDutyCreateSchema,
  type PayrollSpecialDutyCreateInput,
} from "@/lib/schemas/payroll-special-duty"

type Row = {
  id: string
  dateFrom: string
  dateTo: string
  hours: number
  hourRate: number
  amount: number
  comments: string | null
  attachmentBase64: string | null
  status: string
  clientId: string | null
  branchId: string | null
  guard: { id: string; parwestId: string; name: string }
}

type ClientOption = { id: string; name: string }
type BranchOption = { id: string; name: string; city?: string | null }
type Region = { id: string; name: string }

type PayrollSpecialDutyManagerProps = {
  canCreate?: boolean
  canDelete?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}

const ALL_VALUE = "__ALL__"

export default function PayrollSpecialDutyManager({
  canCreate = false,
  canDelete = false,
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: PayrollSpecialDutyManagerProps = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE)
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)

  // Cancel (destructive) dialog state.
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  const form = useForm<PayrollSpecialDutyCreateInput>({
    resolver: zodResolver(payrollSpecialDutyCreateSchema),
    defaultValues: {
      guardId: "",
      dateFrom: "",
      dateTo: "",
      hours: undefined as unknown as number,
      hourRate: undefined as unknown as number,
      comments: "",
      attachmentBase64: null,
      clientId: "",
      branchId: "",
    },
    mode: "onChange",
  })

  const clientId = form.watch("clientId") ?? ""
  const watchedHours = form.watch("hours")
  const watchedRate = form.watch("hourRate")

  const loadRows = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (effectiveRegionId) params.set("regionId", effectiveRegionId)
    const res = await fetch(`/api/payroll/special-duty-records?${params}`)
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [search, effectiveRegionId])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  useEffect(() => {
    // Scope clients to the gate-selected region for SuperAdmin; for REGIONAL
    // users the server applies their scope regardless.
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
      .catch(() => setClients([]))
    form.setValue("clientId", "")
    form.setValue("branchId", "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRegionId])

  useEffect(() => {
    if (!clientId) {
      setBranches([])
      form.setValue("branchId", "")
      return
    }
    setBranchesLoading(true)
    form.setValue("branchId", "")
    fetch(`/api/clients/${clientId}/branches`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setBranches(
          list.map((b: { id: string; name: string; city?: string | null }) => ({
            id: b.id,
            name: b.name,
            city: b.city ?? null,
          }))
        )
      })
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const handleGuardSelect = async (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    const res = await fetch(`/api/guards/${opt.id}/current-context`)
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
    setBranches([])
    form.reset({
      guardId: "",
      dateFrom: "",
      dateTo: "",
      hours: undefined as unknown as number,
      hourRate: undefined as unknown as number,
      comments: "",
      attachmentBase64: null,
      clientId: "",
      branchId: "",
    })
  }

  const onSubmit = async (values: PayrollSpecialDutyCreateInput) => {
    if (!context) {
      toast.error("Select a guard first.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/payroll/special-duty-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: context.guardId,
          dateFrom: values.dateFrom,
          dateTo: values.dateTo,
          hours: Number(values.hours),
          hourRate: Number(values.hourRate),
          comments: values.comments || null,
          attachmentBase64: values.attachmentBase64,
          clientId: values.clientId || null,
          branchId: values.branchId || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success("Special duty record saved.")
        resetForm()
        setFormOpen(false)
        loadRows()
      } else {
        toast.error(data?.message ?? "Failed to save special duty record.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const performCancel = async () => {
    if (!cancelTarget) return
    setCancelBusy(true)
    try {
      const res = await fetch(
        `/api/payroll/special-duty-records/${cancelTarget.id}`,
        { method: "DELETE" }
      )
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success("Special duty record cancelled.")
        loadRows()
      } else {
        toast.error(data?.message ?? "Failed to cancel record.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setCancelBusy(false)
      setCancelOpen(false)
      setCancelTarget(null)
    }
  }

  const filteredRows = useMemo(() => {
    if (statusFilter === ALL_VALUE) return rows
    return rows.filter((r) => r.status === statusFilter)
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
        id: "dateFrom",
        accessorFn: (r) => r.dateFrom,
        header: "Date From",
        cell: ({ row }) => row.original.dateFrom.slice(0, 10),
      },
      {
        id: "dateTo",
        accessorFn: (r) => r.dateTo,
        header: "Date To",
        cell: ({ row }) => row.original.dateTo.slice(0, 10),
      },
      {
        id: "hours",
        accessorFn: (r) => r.hours,
        header: () => <span className="block text-end">Hours</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums">{row.original.hours}</div>
        ),
      },
      {
        id: "rate",
        accessorFn: (r) => r.hourRate,
        header: () => <span className="block text-end">Rate</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums">{row.original.hourRate}</div>
        ),
      },
      {
        id: "amount",
        accessorFn: (r) => r.amount,
        header: () => <span className="block text-end">Amount</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency value={Number(row.original.amount)} />
          </div>
        ),
      },
      {
        id: "comments",
        accessorFn: (r) => r.comments ?? "",
        header: "Comments",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.comments ?? ""}</span>
        ),
      },
      {
        id: "file",
        accessorFn: (r) => r.attachmentBase64 ?? "",
        header: "File",
        cell: ({ row }) =>
          row.original.attachmentBase64 ? (
            <a
              href={row.original.attachmentBase64}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline text-xs"
            >
              View
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "CANCELLED" ? "destructive" : "secondary"
            }
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) =>
          canDelete && row.original.status !== "CANCELLED" ? (
            <PermissionGate module="PAYROLL" action="DELETE" mode="hide">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setCancelTarget(row.original)
                  setCancelOpen(true)
                }}
              >
                Cancel
              </Button>
            </PermissionGate>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [canDelete]
  )

  return (
    <PayrollPageShell
      title="Payroll — Special Duty"
      subtitle="Record date-range special duty with attachment."
      actions={
        canCreate ? (
          <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
            <Button onClick={() => setFormOpen(true)}>+ Add Special Duty</Button>
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
                Status
              </label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="APPROVED">APPROVED</SelectItem>
                  <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Search
              </label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Parwest ID or name"
              />
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
                <div className="text-base font-semibold">No records</div>
                <p className="max-w-md text-sm text-muted-foreground">
                  No special-duty records match the current filters.
                </p>
                {canCreate && (
                  <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                    <Button variant="outline" onClick={() => setFormOpen(true)}>
                      + Add Special Duty
                    </Button>
                  </PermissionGate>
                )}
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={filteredRows}
              searchKey="guardName"
              searchPlaceholder="Filter visible rows by name…"
              pageSize={25}
              emptyMessage="No special-duty records match the on-page filter."
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
            <DialogTitle>Add Special Duty</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
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
              </div>

              <GuardContextFields
                context={context}
                showRows={["name", "type", "status"]}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="dateFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date From *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date To *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hour *</FormLabel>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hourRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hour Rate *</FormLabel>
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
                <div>
                  <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Amount
                  </label>
                  <Input
                    className="bg-muted"
                    value={
                      watchedHours && watchedRate
                        ? (Number(watchedHours) * Number(watchedRate)).toFixed(0)
                        : "0"
                    }
                    readOnly
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
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
                name="attachmentBase64"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attachment</FormLabel>
                    <FormControl>
                      <Base64FileUpload
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v)}
                        accept="image/*,.pdf"
                        label="Choose File"
                        previewMode="link"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || ALL_VALUE}
                          onValueChange={(v) => {
                            const next = v === ALL_VALUE ? "" : v
                            field.onChange(next)
                            form.setValue("branchId", "")
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="— None —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_VALUE}>— None —</SelectItem>
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Optional. Link this special duty to a client (and branch)
                        so it can be added to that client&apos;s invoice.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || ALL_VALUE}
                          onValueChange={(v) =>
                            field.onChange(v === ALL_VALUE ? "" : v)
                          }
                          disabled={!clientId || branchesLoading}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                !clientId
                                  ? "Select client first"
                                  : branchesLoading
                                    ? "Loading branches…"
                                    : branches.length === 0
                                      ? "No branches for this client"
                                      : "— None —"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_VALUE}>— None —</SelectItem>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.city ? `${b.name} - ${b.city}` : b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

      <AlertDialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open)
          if (!open) setCancelTarget(null)
        }}
      >
        <AlertDialogTrigger asChild>
          <span className="hidden" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel special duty record?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget ? (
                <>
                  This will cancel the special duty for{" "}
                  <strong>{cancelTarget.guard.name}</strong> from{" "}
                  {cancelTarget.dateFrom.slice(0, 10)} to{" "}
                  {cancelTarget.dateTo.slice(0, 10)}.
                </>
              ) : (
                "This will cancel the special duty record."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>
              Keep open
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={(e) => {
                e.preventDefault()
                void performCancel()
              }}
              disabled={cancelBusy}
            >
              {cancelBusy ? "Cancelling…" : "Cancel record"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PayrollPageShell>
  )
}
