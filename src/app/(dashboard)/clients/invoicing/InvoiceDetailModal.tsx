"use client"

/**
 * Parwest ERP — Invoice Detail dialog (Phase 5B reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * Replaces the legacy fixed-overlay modal with a shadcn `Dialog`. The local
 * `setSaveResult`-style notice state is gone — success and error feedback
 * is now delivered through sonner toasts (`@/components/shadcn/sonner` is
 * already mounted by the dashboard shell).
 *
 * Behaviour parity:
 *   - Same endpoints + payload contracts.
 *   - Same actions: Record Payment, Mark as PAID, Void.
 *   - Same client/server validation. Server caps amount, rejects voids
 *     when payments exist, etc. — we do not duplicate those server-side
 *     rules in the zod schema (only the input-level checks).
 *   - Errors read `data.message` from the API envelope (the legacy already
 *     did so; nothing to fix on that front).
 */

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { Card, CardContent } from "@/components/shadcn/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog"
import { Input } from "@/components/shadcn/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/shadcn/form"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table"
import { formatPKRFull } from "@/lib/format/currency"
import {
  PAYMENT_METHODS,
  invoicePaymentSchema,
  type InvoicePaymentForm,
} from "@/lib/schemas/invoice-payment"
import { round2, type InvoiceRow } from "./types"

type Props = {
  invoice: InvoiceRow
  onClose: () => void
  onUpdated: (next: InvoiceRow) => void
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
    case "ADVANCE_PAID":
      return "default"
    case "OVERDUE":
    case "UNPAID":
    case "VOID":
      return "destructive"
    case "PARTIAL_PAID":
    case "PENDING":
      return "secondary"
    default:
      return "outline"
  }
}

export default function InvoiceDetailModal({
  invoice,
  onClose,
  onUpdated,
}: Props) {
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [voidOpen, setVoidOpen] = React.useState(false)
  const [voidReason, setVoidReason] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const outstanding = round2(invoice.amount - invoice.paidAmount)
  const isVoid = invoice.status === "VOID"

  const form = useForm<InvoicePaymentForm>({
    resolver: zodResolver(invoicePaymentSchema),
    defaultValues: {
      amount: undefined,
      method: "CASH",
      notes: "",
    },
  })

  const submitPayment = async (values: {
    amount: number
    method: (typeof PAYMENT_METHODS)[number]
    notes?: string
  }) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: values.amount,
          method: values.method,
          notes: values.notes || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          (data as { message?: string })?.message || "Payment failed."
        )
        return
      }
      onUpdated(data as InvoiceRow)
      setPaymentOpen(false)
      form.reset({ amount: undefined, method: "CASH", notes: "" })
      toast.success(
        `Recorded payment of ${formatPKRFull(values.amount)} on ${(data as InvoiceRow).invoiceNumber}.`
      )
    } catch {
      toast.error("Payment failed.")
    } finally {
      setSubmitting(false)
    }
  }

  const markPaid = async () => {
    setSubmitting(true)
    try {
      if (outstanding <= 0) {
        const res = await fetch(`/api/invoices/${invoice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "PAID" }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(
            (data as { message?: string })?.message || "Update failed."
          )
          return
        }
        onUpdated(data as InvoiceRow)
        toast.success(`Invoice ${(data as InvoiceRow).invoiceNumber} marked PAID.`)
        return
      }
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: outstanding,
          method: "CASH",
          notes: "Mark as PAID quick action",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          (data as { message?: string })?.message || "Failed to mark paid."
        )
        return
      }
      onUpdated(data as InvoiceRow)
      toast.success(
        `Recorded payment of ${formatPKRFull(outstanding)} on ${(data as InvoiceRow).invoiceNumber}.`
      )
    } catch {
      toast.error("Failed to mark paid.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitVoid = async () => {
    if (!voidReason.trim()) {
      toast.error("Void reason required.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          (data as { message?: string })?.message || "Void failed."
        )
        return
      }
      onUpdated(data as InvoiceRow)
      setVoidOpen(false)
      setVoidReason("")
      toast.success(`Invoice ${(data as InvoiceRow).invoiceNumber} voided.`)
    } catch {
      toast.error("Void failed.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="font-mono text-base">
                {invoice.invoiceNumber}
              </DialogTitle>
              <DialogDescription>
                {invoice.client?.name}
                {invoice.branch ? ` • ${invoice.branch.name}` : ""} •{" "}
                {new Date(invoice.month).toISOString().slice(0, 7)}
              </DialogDescription>
            </div>
            <Badge variant={statusBadgeVariant(invoice.status)}>
              {invoice.status}
            </Badge>
          </div>
        </DialogHeader>

        {isVoid ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="font-semibold">Voided</div>
            {invoice.voidReason ? <div>Reason: {invoice.voidReason}</div> : null}
            {invoice.voidedAt ? (
              <div className="text-xs opacity-80">
                at {new Date(invoice.voidedAt).toLocaleString()}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat
            label="Subtotal"
            value={<ParwestCurrency value={Number(invoice.subtotal || 0)} />}
          />
          <Stat
            label="Tax"
            value={<ParwestCurrency value={Number(invoice.taxAmount || 0)} />}
          />
          <Stat
            label="Total"
            value={<ParwestCurrency value={Number(invoice.amount || 0)} />}
            bold
          />
          <Stat
            label="Paid / Outstanding"
            value={
              <span className="inline-flex items-center gap-1">
                <ParwestCurrency value={Number(invoice.paidAmount || 0)} />
                <span className="text-muted-foreground">/</span>
                <ParwestCurrency value={outstanding} />
              </span>
            }
          />
        </div>

        {/* Line items */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Line items</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-end">Qty</TableHead>
                  <TableHead className="text-end">Unit</TableHead>
                  <TableHead className="text-end">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoice.lineItems || []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No line items.
                    </TableCell>
                  </TableRow>
                ) : (
                  (invoice.lineItems || []).map((li) => (
                    <TableRow key={li.id}>
                      <TableCell className="text-xs">{li.kind}</TableCell>
                      <TableCell>{li.description}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {li.quantity}
                      </TableCell>
                      <TableCell className="text-end">
                        <ParwestCurrency value={Number(li.unitPrice)} />
                      </TableCell>
                      <TableCell className="text-end">
                        <ParwestCurrency value={Number(li.lineTotal)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Advances applied */}
        {invoice.advanceApplications && invoice.advanceApplications.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Advances applied</h3>
            <ul className="space-y-1 text-sm">
              {invoice.advanceApplications.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between border-b py-1"
                >
                  <span className="text-muted-foreground">
                    advance {a.advance.id.slice(-6)} (
                    {new Date(a.advance.paymentDate)
                      .toISOString()
                      .slice(0, 10)}
                    )
                  </span>
                  <ParwestCurrency value={Number(a.amount)} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1" />
          {!isVoid ? (
            <>
              <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                <Button
                  variant="secondary"
                  onClick={() => setPaymentOpen((s) => !s)}
                  disabled={outstanding <= 0 || submitting}
                >
                  Record Payment
                </Button>
              </PermissionGate>
              <PermissionGate module="PAYROLL" action="UPDATE" mode="hide">
                <Button
                  onClick={markPaid}
                  disabled={invoice.status === "PAID" || submitting}
                >
                  Mark as PAID
                </Button>
              </PermissionGate>
              <PermissionGate module="PAYROLL" action="CREATE" mode="hide">
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setVoidOpen((s) => !s)}
                  disabled={invoice.paidAmount > 0 || submitting}
                  title={
                    invoice.paidAmount > 0
                      ? "Cannot void an invoice with payments"
                      : "Void invoice"
                  }
                >
                  Void
                </Button>
              </PermissionGate>
            </>
          ) : null}
        </div>

        {/* Inline payment form */}
        {paymentOpen && !isVoid ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <h4 className="text-sm font-semibold">Record Payment</h4>
              <Form {...form}>
                <form
                  className="space-y-3"
                  onSubmit={form.handleSubmit(submitPayment)}
                  noValidate
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={
                                field.value === undefined ||
                                Number.isNaN(field.value)
                                  ? ""
                                  : field.value
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
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Method</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PAYMENT_METHODS.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPaymentOpen(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Saving…" : "Save payment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : null}

        {/* Inline void form */}
        {voidOpen && !isVoid ? (
          <Card className="border-destructive/40">
            <CardContent className="space-y-3 p-4">
              <h4 className="text-sm font-semibold text-destructive">
                Void invoice
              </h4>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Reason (required)
                </label>
                <Input
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. issued in error"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setVoidOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={submitVoid}
                  disabled={submitting}
                >
                  {submitting ? "Voiding…" : "Confirm void"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({
  label,
  value,
  bold = false,
}: {
  label: string
  value: React.ReactNode
  bold?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={bold ? "font-semibold" : undefined}>{value}</div>
    </div>
  )
}
