/**
 * Parwest ERP — Payroll: Loans (canonical payroll-manager migration template)
 * ─────────────────────────────────────────────────────────────────────────
 * This file is the reference migration for all subsequent payroll managers
 * (Salary V2, Holidays, Extra Hours, Allowances, Penalties, Advances, etc.).
 *
 * Canonical pieces:
 *  - List/table → `<DataTable>` from `@/components/shadcn/data-table` with
 *    column-defs in `useMemo`, `searchKey` for in-memory filtering, server-
 *    side filters threaded via URL contract (region/month/etc.).
 *  - Create/edit form → shadcn `<Form>` (RHF + zodResolver), with each field
 *    wrapped FormField → FormItem → FormLabel → FormControl → FormMessage.
 *    Schemas live under `src/lib/schemas/` and MUST mirror the existing API
 *    validations exactly — no tightening or loosening on reskin.
 *  - Destructive operations (finalize, revert, delete) → shadcn `AlertDialog`
 *    instead of native `confirm()`, with destructive-variant action button.
 *  - Toast feedback via sonner; reads `data.message` per the API envelope
 *    contract (`{ success, message, code }`) — never `data.error`.
 *  - Permission gating via `<PermissionGate module="PAYROLL" action="…">`
 *    around create/update buttons (mode="hide" in toolbars).
 *  - Currency rendered via `<ParwestCurrency>` for any displayed amounts.
 *
 * Reskin scope only — data flow, API endpoints, and URL contracts are
 * preserved exactly. Sub-components (GuardAutocomplete, GuardContextFields,
 * AttendanceDetailsTable, Base64FileUpload, RegionUrlPicker) are kept since
 * they're shared across the payroll suite and out of scope for this pass.
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
import GuardInfoCard from "@/components/payroll/shared/GuardInfoCard"
import AttendanceDetailsTable from "@/components/payroll/shared/AttendanceDetailsTable"
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
import { parseCsvToLoanRows, type BulkLoanDraftRow } from "@/lib/payroll/loans-bulk"
import { cn } from "@/lib/utils"
import {
  PAYROLL_LOAN_PAYMENT_METHODS,
  payrollLoanCreateSchema,
  type PayrollLoanCreateInput,
} from "@/lib/schemas/payroll-loan"

type TabId = "add" | "finalize" | "history"

type PayrollLoansClientProps = {
  canCreate?: boolean
  canUpdate?: boolean
  canView?: boolean
  /**
   * Effective region filter from the region gate. Non-null when a SuperAdmin
   * has picked a region or when the caller is region-scoped. The server-side
   * API enforces this, but we pass the value through so list fetches can
   * include it up front and avoid a flicker with global data.
   */
  effectiveRegionId?: string | null
  /**
   * Region options pre-filtered by the region gate (already scoped to the
   * caller's regional access). Threaded through so we don't re-fetch
   * `/api/regions` on the client and accidentally show every region to a
   * regional admin.
   */
  regions?: Region[]
  /** True when the caller is region-locked (REGIONAL scope). */
  locked?: boolean
}

type LoanRow = {
  id: string
  amount: number
  status: string
  paymentMethod: string | null
  slipNumber: string | null
  bankName: string | null
  accountNumber: string | null
  paymentDate: string | null
  supervisor: string | null
  manager: string | null
  createdAt: string
  finalizedAt: string | null
  month: string
  regionId?: string | null
  guard: {
    parwestId: string
    name: string
    phone?: string | null
    designation?: string | null
    regionId?: string | null
  }
}

type Region = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string; clientId: string }
type Supervisor = { id: string; name: string }
type HistoryRow = {
  id: string
  finalizedAt: string
  finalizedByName: string
  regionName: string | null
  month: string
  loanCount: number
  totalAmount: number
}

const ALL_VALUE = "__ALL__"

export default function PayrollLoansClient({
  canCreate = false,
  canUpdate = false,
  canView = false,
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: PayrollLoansClientProps = {}) {
  const initialTab: TabId = canCreate
    ? "add"
    : canUpdate
      ? "finalize"
      : canView
        ? "history"
        : "add"
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  const tabs = [
    ...(canCreate ? [{ id: "add" as const, label: "Add Loans" }] : []),
    { id: "finalize" as const, label: "Finalize Loans" },
    ...(canView
      ? [{ id: "history" as const, label: "Export Finalised History" }]
      : []),
  ]

  return (
    <PayrollPageShell
      title="Payroll — Loans"
      subtitle="Add loans, finalize bank-confirmed batches, and export finalised history."
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(t) => setActiveTab(t as TabId)}
    >
      {activeTab === "add" && canCreate && (
        <AddLoansTab
          effectiveRegionId={effectiveRegionId}
          regions={regions}
          locked={locked}
        />
      )}
      {activeTab === "finalize" && (
        <FinalizeLoansTab
          canCreate={canCreate}
          effectiveRegionId={effectiveRegionId}
          regions={regions}
          locked={locked}
        />
      )}
      {activeTab === "history" &&
        (canView ? (
          <HistoryTab />
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No access — you don&apos;t have permission to view finalisation history.
            </CardContent>
          </Card>
        ))}
    </PayrollPageShell>
  )
}

// ───────────────────────────── ADD LOANS TAB ─────────────────────────────

function AddLoansTab({
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: {
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
} = {}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [parwestIdInput, setParwestIdInput] = useState("")
  const [context, setContext] = useState<GuardCurrentContext | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [saving, setSaving] = useState(false)

  const [bulkRows, setBulkRows] = useState<BulkLoanDraftRow[]>([])
  const [bulkCommitting, setBulkCommitting] = useState(false)

  // RHF + zod form. Mirrors legacy validation exactly — see schema for notes.
  const form = useForm<PayrollLoanCreateInput>({
    resolver: zodResolver(payrollLoanCreateSchema),
    defaultValues: {
      guardId: "",
      month,
      amount: undefined as unknown as number,
      paymentDate: "",
      slipNumber: "",
      paymentMethod: undefined as unknown as PayrollLoanCreateInput["paymentMethod"],
      selectClientId: "",
      selectBranchId: "",
      supervisorUserId: "",
      imageBase64: null,
    },
    mode: "onChange",
  })

  // Keep the RHF `month` in sync with the local state (drives context fetch).
  useEffect(() => {
    form.setValue("month", month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const selectClientId = form.watch("selectClientId") ?? ""

  useEffect(() => {
    // Scope clients + supervisors to the gate-selected region. The server
    // enforces REGIONAL scope regardless; for SuperAdmin we forward the
    // selected regionId so dropdown options match what the rest of the page
    // will accept.
    const clientsUrl = effectiveRegionId
      ? `/api/clients?regionId=${encodeURIComponent(effectiveRegionId)}`
      : "/api/clients"
    const usersUrl = effectiveRegionId
      ? `/api/users?regionId=${encodeURIComponent(effectiveRegionId)}`
      : "/api/users"
    fetch(clientsUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.clients ?? data.rows ?? []
        setClients(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
    fetch(usersUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.users ?? data.rows ?? []
        setSupervisors(
          list
            .filter((u: { role?: { name?: string } }) => u.role?.name?.toLowerCase().includes("supervisor"))
            .map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))
        )
      })
      .catch(() => {})
  }, [effectiveRegionId])

  useEffect(() => {
    if (!selectClientId) {
      setBranches([])
      return
    }
    fetch(`/api/branches?clientId=${selectClientId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches ?? data.rows ?? []
        setBranches(
          list.map((b: { id: string; name: string; clientId: string }) => ({
            id: b.id,
            name: b.name,
            clientId: b.clientId,
          }))
        )
      })
      .catch(() => {})
  }, [selectClientId])

  const loadContext = useCallback(
    async (guardIdOrParwest: string) => {
      if (!guardIdOrParwest) return
      const res = await fetch(
        `/api/guards/${encodeURIComponent(guardIdOrParwest)}/current-context?month=${month}`
      )
      if (res.ok) {
        const ctx = (await res.json()) as GuardCurrentContext
        setContext(ctx)
        form.setValue("guardId", ctx.guardId)
      } else {
        setContext(null)
        form.setValue("guardId", "")
      }
    },
    [month, form]
  )

  useEffect(() => {
    if (context) loadContext(context.guardId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const handleGuardSelect = (opt: { id: string; parwestId: string }) => {
    setParwestIdInput(opt.parwestId)
    loadContext(opt.id)
  }

  const payableAmount = useMemo(() => context?.currentUnpaidLoan ?? 0, [context])

  // Prefer the canonical `lifecycleStatus` for the displayed status, falling
  // back to the legacy `status` shadow when absent. Additive + safe: the
  // legacy field is preserved on the underlying context object.
  const displayContext = useMemo<GuardCurrentContext | null>(
    () =>
      context
        ? { ...context, status: context.lifecycleStatus ?? context.status }
        : null,
    [context]
  )

  const onSubmit = async (values: PayrollLoanCreateInput) => {
    if (!context) {
      toast.error("Select a guard first.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/payroll/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: context.guardId,
          month: `${values.month}-01`,
          amount: Number(values.amount),
          deploymentDays: context.deploymentDays,
          supervisor: context.currentSupervisor?.name ?? null,
          manager: context.currentManager?.name ?? null,
          supervisorUserId:
            values.supervisorUserId || context.currentSupervisor?.id || null,
          managerUserId: context.currentManager?.id ?? null,
          clientId: values.selectClientId || null,
          branchId: values.selectBranchId || null,
          slipNumber: values.slipNumber,
          paymentDate: values.paymentDate,
          paymentMethod: values.paymentMethod,
          imageBase64: values.imageBase64,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Loan saved for ${context.name}.`)
        form.reset({
          ...form.getValues(),
          amount: undefined as unknown as number,
          slipNumber: "",
          paymentDate: "",
          paymentMethod: undefined as unknown as PayrollLoanCreateInput["paymentMethod"],
          imageBase64: null,
        })
        loadContext(context.guardId)
      } else {
        toast.error(data?.message ?? "Failed to save loan.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleBulkUpload = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== "string") return
      setBulkRows(parseCsvToLoanRows(text))
    }
    reader.readAsText(file)
  }

  const commitBulk = async () => {
    const ready = bulkRows.filter((r) => r.status === "READY" && r.guardId)
    if (ready.length === 0) return
    setBulkCommitting(true)
    try {
      const res = await fetch("/api/payroll/loans/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: ready.map((r) => ({
            guardId: r.guardId,
            amount: r.amount,
            loanDate: r.loanDate,
            notes: r.notes,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Committed ${data.committed}/${data.total} loans.`)
        setBulkRows((prev) =>
          prev.map((r) => (r.status === "READY" ? { ...r, status: "COMMITTED" } : r))
        )
      } else {
        toast.error(data?.message ?? "Bulk commit failed.")
      }
    } catch {
      toast.error("Network error.")
    } finally {
      setBulkCommitting(false)
    }
  }

  const downloadTemplate = () => {
    const csv = "guardId,amount,loanDate,notes\n,0,2026-04-01,\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bulk-loans-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <RegionUrlPicker
                      regions={regions}
                      locked={locked}
                      includeGlobalOption={!locked}
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Month *
                    </label>
                    <Input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Parwest ID *
                    </label>
                    <GuardAutocomplete
                      value={parwestIdInput}
                      onChange={setParwestIdInput}
                      onSelect={handleGuardSelect}
                      regionId={effectiveRegionId}
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Payable Amount
                    </label>
                    <div className="flex h-9 items-center rounded-md border bg-muted px-3">
                      <ParwestCurrency value={payableAmount} compact={false} />
                    </div>
                  </div>
                </div>

                <GuardContextFields
                  context={context}
                  showRows={[
                    "name",
                    "phone",
                    "client",
                    "branch",
                    "days",
                    "doubleDuty",
                    "supervisor",
                    "manager",
                  ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Paid *</FormLabel>
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
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Payment *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slipNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slip Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="Loan slip number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                              <SelectItem value={ALL_VALUE}>--Select Client--</SelectItem>
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
                              <SelectItem value={ALL_VALUE}>--Select Branch--</SelectItem>
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
                  <FormField
                    control={form.control}
                    name="supervisorUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supervisor</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value || ALL_VALUE}
                            onValueChange={(v) =>
                              field.onChange(v === ALL_VALUE ? "" : v)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  context?.currentSupervisor
                                    ? `Default — ${context.currentSupervisor.name}`
                                    : "--Select supervisor--"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL_VALUE}>
                                {context?.currentSupervisor
                                  ? `Default — ${context.currentSupervisor.name}`
                                  : "--Select supervisor--"}
                              </SelectItem>
                              {supervisors.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method *</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(v) => field.onChange(v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Payment Method" />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYROLL_LOAN_PAYMENT_METHODS.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
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
                    name="imageBase64"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Upload Image</FormLabel>
                        <FormControl>
                          <Base64FileUpload
                            value={field.value ?? null}
                            onChange={(v) => field.onChange(v)}
                            accept="image/*"
                            label="Choose File"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center justify-end pt-2">
                  <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                    <Button
                      type="submit"
                      variant="default"
                      disabled={saving || !context}
                    >
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </PermissionGate>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <AttendanceDetailsTable
          guardId={context?.guardId ?? null}
          month={month}
          totalLoanPaid={0}
          payableLoan={payableAmount}
        />

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-semibold">Bulk Upload</h3>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={downloadTemplate}>
                  Download Template
                </Button>
                <label
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "cursor-pointer"
                  )}
                >
                  Upload CSV
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={(e) => handleBulkUpload(e.target.files?.[0] || null)}
                  />
                </label>
                <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                  <Button
                    onClick={commitBulk}
                    disabled={bulkCommitting || bulkRows.length === 0}
                  >
                    {bulkCommitting ? "Committing…" : "Commit Batch"}
                  </Button>
                </PermissionGate>
              </div>
            </div>
            {bulkRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Guard ID</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-t",
                          r.status === "ERROR" && "bg-destructive/10"
                        )}
                      >
                        <td className="px-3 py-2 font-mono">
                          {r.guardId || (
                            <span className="text-destructive">missing</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{r.amount}</td>
                        <td className="px-3 py-2">{r.loanDate}</td>
                        <td className="px-3 py-2">{r.notes}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              r.status === "COMMITTED" && "text-green-600 font-medium",
                              r.status === "ERROR" && "text-destructive",
                              r.status === "READY" && "text-muted-foreground"
                            )}
                          >
                            {r.status}
                            {r.error ? ` — ${r.error}` : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <GuardInfoCard context={displayContext} />
      </div>
    </div>
  )
}

// ─────────────────────────── FINALIZE LOANS TAB ───────────────────────────

function FinalizeLoansTab({
  canCreate = false,
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: {
  canCreate?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  // Region is fully driven by the page-level gate (URL or REGIONAL scope).
  const regionId = effectiveRegionId ?? ""
  const [rows, setRows] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")

  // AlertDialog open state for the two destructive actions.
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)

  const loadLoans = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    if (search) params.set("search", search)
    if (regionId) params.set("regionId", regionId)
    const res = await fetch(`/api/payroll/loans?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      const list: LoanRow[] = Array.isArray(data) ? data : []
      setRows(list)
    }
    setLoading(false)
  }, [month, regionId, search])

  useEffect(() => {
    loadLoans()
  }, [loadLoans])

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === "PENDING").length,
    [rows]
  )
  const finalizedCount = useMemo(
    () => rows.filter((r) => r.status === "FINALIZED").length,
    [rows]
  )

  const finalizeAll = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/payroll/loans/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: `${month}-01`, regionId: regionId || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(
          `Finalized ${data.finalized} loans. Total: ${data.totalAmount?.toFixed(0) ?? 0}`
        )
      } else {
        toast.error(data?.message ?? "Failed to finalize loans.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setBusy(false)
      setFinalizeOpen(false)
      loadLoans()
    }
  }

  const undoFinalize = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/payroll/loans/unfinalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: `${month}-01`, regionId: regionId || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Reverted ${data.reverted} loans.`)
      } else {
        toast.error(data?.message ?? "Failed to revert loans.")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setBusy(false)
      setRevertOpen(false)
      loadLoans()
    }
  }

  const exportAll = () => {
    const header = [
      "Payment Month",
      "Secure Ops ID",
      "Name",
      "Designation",
      "Phone",
      "Current Supervisor",
      "Amount",
      "Date of Payment",
      "Payment Method",
      "Bank Name",
      "Account Number",
      "Supervisor",
      "Slip Number",
      "Status",
      "Created At",
    ]
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [header.map(escape).join(",")]
      .concat(
        rows.map((r) =>
          [
            new Date(r.month).toISOString().slice(0, 7),
            r.guard.parwestId,
            r.guard.name,
            r.guard.designation ?? "",
            r.guard.phone ?? "",
            r.supervisor ?? "",
            r.amount,
            r.paymentDate?.slice(0, 10) ?? "",
            r.paymentMethod ?? "",
            r.bankName ?? "",
            r.accountNumber ?? "",
            r.supervisor ?? "",
            r.slipNumber ?? "",
            r.status,
            r.createdAt.slice(0, 19).replace("T", " "),
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
    a.download = `loans-${month}${regionId ? `-${regionId}` : ""}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns = useMemo<ColumnDef<LoanRow>[]>(
    () => [
      {
        id: "paymentMonth",
        accessorFn: (r) => r.month.slice(0, 7),
        header: "Payment Month",
        cell: ({ row }) => row.original.month.slice(0, 7),
      },
      {
        id: "parwestId",
        accessorFn: (r) => r.guard.parwestId,
        header: "Secure Ops ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.guard.parwestId}</span>
        ),
      },
      {
        id: "guardName",
        accessorFn: (r) => r.guard.name,
        header: "Name",
        cell: ({ row }) => row.original.guard.name,
      },
      {
        id: "phone",
        accessorFn: (r) => r.guard.phone ?? "",
        header: "Phone",
        cell: ({ row }) => row.original.guard.phone ?? "—",
      },
      {
        id: "supervisor",
        accessorFn: (r) => r.supervisor ?? "",
        header: "Current Supervisor",
        cell: ({ row }) => row.original.supervisor ?? "—",
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
        id: "paymentDate",
        accessorFn: (r) => r.paymentDate ?? "",
        header: "Date",
        cell: ({ row }) => row.original.paymentDate?.slice(0, 10) ?? "—",
      },
      {
        id: "paymentMethod",
        accessorFn: (r) => r.paymentMethod ?? "",
        header: "Method",
        cell: ({ row }) => row.original.paymentMethod ?? "—",
      },
      {
        id: "bank",
        accessorFn: (r) => r.bankName ?? "",
        header: "Bank",
        cell: ({ row }) => row.original.bankName ?? "—",
      },
      {
        id: "account",
        accessorFn: (r) => r.accountNumber ?? "",
        header: "Account",
        cell: ({ row }) => row.original.accountNumber ?? "—",
      },
      {
        id: "slip",
        accessorFn: (r) => r.slipNumber ?? "",
        header: "Slip",
        cell: ({ row }) => row.original.slipNumber ?? "—",
      },
      {
        id: "createdAt",
        accessorFn: (r) => r.createdAt,
        header: "Created At",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.createdAt.slice(0, 10)}</span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "FINALIZED" ? "default" : "secondary"}
          >
            {row.original.status}
          </Badge>
        ),
      },
    ],
    []
  )

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-1 md:grid-cols-[200px_200px_1fr_auto_auto_auto] gap-3 items-end">
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
              placeholder="Name or Parwest ID"
            />
          </div>
          {canCreate && (
            <PermissionGate module="PAYROLL" action="UPDATE" mode="hide">
              <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
                <AlertDialogTrigger asChild>
                  <Button disabled={busy || pendingCount === 0}>
                    Finalize All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Finalize loans for {month}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {pendingCount} pending loan{pendingCount !== 1 ? "s" : ""}{" "}
                      will be locked
                      {regionId ? " in the selected region" : ""}. This action
                      records a finalisation history entry.
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
                        void finalizeAll()
                      }}
                      disabled={busy}
                    >
                      {busy ? "Finalizing…" : "Finalize"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PermissionGate>
          )}
          {canCreate && (
            <PermissionGate module="PAYROLL" action="UPDATE" mode="hide">
              <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={busy || finalizedCount === 0}
                  >
                    Undo Finalize
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revert finalization?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {finalizedCount} finalized loan
                      {finalizedCount !== 1 ? "s" : ""} for {month} will be
                      unlocked back to PENDING
                      {regionId ? " in the selected region" : ""}.
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
                        void undoFinalize()
                      }}
                      disabled={busy}
                    >
                      {busy ? "Reverting…" : "Revert"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PermissionGate>
          )}
          <Button variant="outline" onClick={exportAll}>
            Export All
          </Button>
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
              <div className="text-base font-semibold">No loans found</div>
              <p className="max-w-md text-sm text-muted-foreground">
                No loans for this month/region. Switch to the Add Loans tab to
                record one.
              </p>
              <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                <Button variant="outline" disabled>
                  Add Loan (use the Add Loans tab)
                </Button>
              </PermissionGate>
            </CardContent>
          </Card>
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            searchKey="guardName"
            searchPlaceholder="Filter visible rows by name…"
            pageSize={25}
            emptyMessage="No loans match the on-page filter."
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────── HISTORY TAB ───────────────────────────

function HistoryTab() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data fetch; loading flag + rows reflect server state
    setLoading(true)
    fetch("/api/payroll/loans/finalize-history")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const columns = useMemo<ColumnDef<HistoryRow>[]>(
    () => [
      {
        id: "finalizedAt",
        accessorFn: (r) => r.finalizedAt,
        header: "Dated",
        cell: ({ row }) =>
          new Date(row.original.finalizedAt).toLocaleString(),
      },
      {
        id: "month",
        accessorFn: (r) => r.month.slice(0, 7),
        header: "Month",
        cell: ({ row }) => row.original.month.slice(0, 7),
      },
      {
        id: "region",
        accessorFn: (r) => r.regionName ?? "All",
        header: "Region",
        cell: ({ row }) => row.original.regionName ?? "All",
      },
      {
        id: "loanCount",
        accessorFn: (r) => r.loanCount,
        header: () => <span className="block text-end">Loans</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums">{row.original.loanCount}</div>
        ),
      },
      {
        id: "totalAmount",
        accessorFn: (r) => r.totalAmount,
        header: () => <span className="block text-end">Total</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <ParwestCurrency value={Number(row.original.totalAmount)} />
          </div>
        ),
      },
      {
        id: "finalizedBy",
        accessorFn: (r) => r.finalizedByName,
        header: "Finalised By",
        cell: ({ row }) => row.original.finalizedByName,
      },
      {
        id: "download",
        header: "Download",
        cell: ({ row }) => (
          <a
            href={`/api/payroll/loans/finalize-history/${row.original.id}/download`}
            className="text-primary underline"
          >
            Download Report
          </a>
        ),
      },
    ],
    []
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="text-base font-semibold">No history yet</div>
          <p className="max-w-md text-sm text-muted-foreground">
            No finalization history yet. Finalising a batch on the Finalize
            Loans tab will record an entry here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <DataTable
          columns={columns}
          data={rows}
          searchKey="finalizedBy"
          searchPlaceholder="Filter by finaliser…"
          pageSize={25}
          emptyMessage="No history matches the on-page filter."
        />
      </CardContent>
    </Card>
  )
}
