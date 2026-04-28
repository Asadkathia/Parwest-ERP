/**
 * Parwest ERP — Payroll: Holidays (canonical-template reskin)
 * ─────────────────────────────────────────────────────────────
 * Mirrors the canonical loans manager template:
 *   - List → `<DataTable>` from `@/components/shadcn/data-table`
 *   - Create/edit → shadcn `<Form>` (RHF + zodResolver) inside `<Dialog>`
 *   - Destructive delete → shadcn `<AlertDialog>` with destructive variant
 *   - Toasts via sonner; reads `data.message` per the API envelope
 *   - Permission gating via `<PermissionGate>` around action buttons
 *   - Empty state rendered via shadcn `<Card>`
 *
 * Reskin only — data flow and API endpoints are unchanged.
 *
 * Region picker: this manager does NOT thread a `regionId` query
 * parameter to /api/payroll/holidays (regional office scoping is done
 * inline via the `regionalOfficeId` field in the form). The global
 * topbar region picker covers `?regionId` URL contracts elsewhere, so
 * no inline `RegionUrlPicker` is needed here.
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import { Badge } from "@/components/shadcn/badge"
import { Button, buttonVariants } from "@/components/shadcn/button"
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
import { PermissionGate } from "@/components/shadcn/permission-gate"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select"
import { Textarea } from "@/components/shadcn/textarea"

import { cn } from "@/lib/utils"
import {
  PAYROLL_HOLIDAY_APPLIES_TO,
  PAYROLL_HOLIDAY_APPLIES_TO_LABELS,
  PAYROLL_HOLIDAY_VALUE_TYPES,
  PAYROLL_HOLIDAY_VALUE_TYPE_LABELS,
  payrollHolidayUpsertSchema,
  type PayrollHolidayUpsertInput,
} from "@/lib/schemas/payroll-holiday"

type AppliesTo = (typeof PAYROLL_HOLIDAY_APPLIES_TO)[number]
type ValueType = (typeof PAYROLL_HOLIDAY_VALUE_TYPES)[number]

type Row = {
  id: string
  name: string
  date: string
  dateFrom: string | null
  dateTo: string | null
  regionalOfficeId: string | null
  valueType: ValueType | null
  value: number | null
  status: string | null
  comments: string | null
  notes: string | null
  appliesTo: AppliesTo | null
}

type Office = { id: string; name: string }

type PayrollHolidaysManagerProps = {
  canCreate?: boolean
  canUpdate?: boolean
  canDelete?: boolean
}

const NONE_VALUE = "__NONE__"

export default function PayrollHolidaysManager({
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}: PayrollHolidaysManagerProps = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation state.
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<PayrollHolidayUpsertInput>({
    resolver: zodResolver(payrollHolidayUpsertSchema),
    defaultValues: {
      name: "",
      regionalOfficeId: "",
      dateFrom: "",
      dateTo: "",
      valueType: "MULTIPLE_OF_RATE",
      value: "",
      status: "active",
      comments: "",
      appliesTo: "WORKED_ONLY",
    },
    mode: "onChange",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/payroll/holidays")
      if (res.ok) {
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetch("/api/regional-offices")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.offices ?? data.rows ?? []
        setOffices(
          list.map((o: { id: string; name: string }) => ({
            id: o.id,
            name: o.name,
          }))
        )
      })
      .catch(() => {})
  }, [load])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && (r.status ?? "active") !== statusFilter) {
        return false
      }
      if (!search) return true
      const s = search.toLowerCase()
      return (
        r.name.toLowerCase().includes(s) ||
        (r.comments ?? "").toLowerCase().includes(s)
      )
    })
  }, [rows, search, statusFilter])

  const openCreate = () => {
    setEditingId(null)
    form.reset({
      name: "",
      regionalOfficeId: "",
      dateFrom: "",
      dateTo: "",
      valueType: "MULTIPLE_OF_RATE",
      value: "",
      status: "active",
      comments: "",
      appliesTo: "WORKED_ONLY",
    })
    setFormOpen(true)
  }

  const openEdit = useCallback((row: Row) => {
    setEditingId(row.id)
    form.reset({
      name: row.name ?? "",
      regionalOfficeId: row.regionalOfficeId ?? "",
      dateFrom: (row.dateFrom ?? row.date).slice(0, 10),
      dateTo: (row.dateTo ?? row.date).slice(0, 10),
      valueType: row.valueType ?? "MULTIPLE_OF_RATE",
      value: row.value != null ? String(row.value) : "",
      status: (row.status as "active" | "inactive") ?? "active",
      comments: row.comments ?? "",
      appliesTo: row.appliesTo ?? "WORKED_ONLY",
    })
    setFormOpen(true)
  }, [form])

  const onSubmit = async (values: PayrollHolidayUpsertInput) => {
    setSaving(true)
    const payload = {
      name: values.name || "Holiday",
      regionalOfficeId: values.regionalOfficeId || null,
      dateFrom: values.dateFrom,
      dateTo: values.dateTo || values.dateFrom,
      valueType: values.valueType,
      value:
        values.value === "" || values.value == null
          ? null
          : Number(values.value),
      status: values.status,
      comments: values.comments || null,
      appliesTo: values.appliesTo,
    }
    const url = editingId
      ? `/api/payroll/holidays/${editingId}`
      : "/api/payroll/holidays"
    try {
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(editingId ? "Holiday updated." : "Holiday added.")
        setFormOpen(false)
        load()
      } else {
        toast.error(data?.message ?? "Failed to save holiday.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/payroll/holidays/${deleteId}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success("Holiday deleted.")
        setDeleteId(null)
        load()
      } else {
        toast.error(data?.message ?? "Failed to delete holiday.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  const officeName = useCallback(
    (id: string | null) => offices.find((o) => o.id === id)?.name ?? "—",
    [offices]
  )

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: "name",
        accessorFn: (r) => r.name,
        header: "Name",
        cell: ({ row }) => row.original.name,
      },
      {
        id: "regionalOffice",
        accessorFn: (r) => officeName(r.regionalOfficeId),
        header: "Regional Office",
        cell: ({ row }) => officeName(row.original.regionalOfficeId),
      },
      {
        id: "valueType",
        accessorFn: (r) => r.valueType ?? "",
        header: "Type",
        cell: ({ row }) =>
          row.original.valueType
            ? PAYROLL_HOLIDAY_VALUE_TYPE_LABELS[row.original.valueType]
            : "—",
      },
      {
        id: "value",
        accessorFn: (r) => r.value ?? 0,
        header: () => <span className="block text-end">Value</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums">
            {row.original.value ?? "—"}
          </div>
        ),
      },
      {
        id: "from",
        accessorFn: (r) => (r.dateFrom ?? r.date).slice(0, 10),
        header: "From",
        cell: ({ row }) =>
          (row.original.dateFrom ?? row.original.date).slice(0, 10),
      },
      {
        id: "to",
        accessorFn: (r) => (r.dateTo ?? r.date).slice(0, 10),
        header: "To",
        cell: ({ row }) =>
          (row.original.dateTo ?? row.original.date).slice(0, 10),
      },
      {
        id: "comments",
        accessorFn: (r) => r.comments ?? r.notes ?? "",
        header: "Comments",
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.comments ?? row.original.notes ?? ""}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => r.status ?? "",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status ?? "active"
          return (
            <Badge variant={status === "active" ? "default" : "secondary"}>
              {status}
            </Badge>
          )
        },
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => (
          <div className="flex gap-2">
            {canUpdate && (
              <PermissionGate
                module="PAYROLL"
                action="UPDATE"
                mode="hide"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(row.original)}
                >
                  Edit
                </Button>
              </PermissionGate>
            )}
            {canDelete && (
              <PermissionGate
                module="PAYROLL"
                action="DELETE"
                mode="hide"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(row.original.id)}
                >
                  Delete
                </Button>
              </PermissionGate>
            )}
          </div>
        ),
      },
    ],
    [canDelete, canUpdate, officeName, openEdit]
  )

  return (
    <PayrollPageShell
      title="Payroll — Holidays"
      subtitle="Regional holidays with fixed or rate-multiple payouts."
      actions={
        canCreate ? (
          <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
            <Button onClick={openCreate}>+ Add Holiday</Button>
          </PermissionGate>
        ) : undefined
      }
    >
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3 items-end">
            <div>
              <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Search
              </Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or comments"
              />
            </div>
            <div>
              <Label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
                <div className="text-base font-semibold">No holidays</div>
                <p className="max-w-md text-sm text-muted-foreground">
                  No holidays match the current filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={filteredRows}
              searchKey="name"
              searchPlaceholder="Filter visible rows by name…"
              pageSize={25}
              emptyMessage="No holidays match the on-page filter."
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Holiday" : "Add Holiday"}
            </DialogTitle>
            <DialogDescription>
              Configure regional holiday payout for guards.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="regionalOfficeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regional Office</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || NONE_VALUE}
                          onValueChange={(v) =>
                            field.onChange(v === NONE_VALUE ? "" : v)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All / None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>All / None</SelectItem>
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
                  name="dateFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From *</FormLabel>
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
                      <FormLabel>To</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="valueType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value Type *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="flex gap-6 flex-wrap"
                      >
                        {PAYROLL_HOLIDAY_VALUE_TYPES.map((vt) => (
                          <Label
                            key={vt}
                            className="flex items-center gap-2 text-sm cursor-pointer font-normal"
                          >
                            <RadioGroupItem value={vt} />
                            {PAYROLL_HOLIDAY_VALUE_TYPE_LABELS[vt]}
                          </Label>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={
                            field.value === undefined || field.value === null
                              ? ""
                              : String(field.value)
                          }
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Holiday name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="appliesTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Applies To</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYROLL_HOLIDAY_APPLIES_TO.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {PAYROLL_HOLIDAY_APPLIES_TO_LABELS[opt]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Determines which guards receive holiday pay. WORKED_ONLY
                      pays only guards with a deployment on that date;
                      ALL_DEPLOYED pays all guards with any deployment that
                      month at the matching office; ALL_IN_OFFICE pays everyone
                      in the regional office.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <PermissionGate
                  module="PAYROLL"
                  action={editingId ? "UPDATE" : "CREATE"}
                  mode="hide"
                >
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </PermissionGate>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this holiday?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the holiday entry. Guards already paid
              under this holiday in finalised payroll batches will not be
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PayrollPageShell>
  )
}
