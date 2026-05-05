"use client"

/**
 * Auto-accruing drafts panel.
 *
 * Lists DRAFT invoices in the user's scope (server-side scoping via /api/invoices).
 * Admins / Super Users can finalize a draft → PENDING (calls /api/invoices/[id]/finalize).
 * Non-admins can preview only (read-only).
 */

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/shadcn/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
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
import { ParwestCurrency } from "@/components/shadcn/parwest-currency"
import { Badge } from "@/components/shadcn/badge"
import type { InvoiceRow } from "./types"
import InvoiceDetailModal from "./InvoiceDetailModal"

type ApiOk<T> = { success: true; data: T } | { success: false; message: string }

type Props = {
  isAdmin: boolean
}

export default function DraftsPanel({ isAdmin }: Props) {
  const searchParams = useSearchParams()
  const urlRegionId = searchParams?.get("regionId") || ""
  const focusedInvoiceId = searchParams?.get("invoiceId") || ""

  const [rows, setRows] = React.useState<InvoiceRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [confirmId, setConfirmId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<InvoiceRow | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: "DRAFT" })
      if (urlRegionId) params.set("regionId", urlRegionId)
      const res = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.message || "Failed to load drafts.")
        return
      }
      setRows(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to load drafts.")
    } finally {
      setLoading(false)
    }
  }, [urlRegionId])

  React.useEffect(() => {
    void load()
  }, [load])

  // Auto-open invoice when arrived from a notification deep-link
  React.useEffect(() => {
    if (!focusedInvoiceId || rows.length === 0 || detail) return
    const target = rows.find((r) => r.id === focusedInvoiceId)
    if (target) void openDetail(target.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedInvoiceId, rows])

  const openDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.message || "Failed to load invoice.")
        return
      }
      setDetail(data)
    } catch {
      toast.error("Failed to load invoice.")
    }
  }

  const finalize = async (id: string) => {
    setConfirmId(null)
    setBusyId(id)
    try {
      const res = await fetch(`/api/invoices/${id}/finalize`, { method: "POST" })
      const data: ApiOk<unknown> = await res.json()
      if (!res.ok || !data.success) {
        toast.error(("message" in data && data.message) || "Failed to finalize invoice.")
        return
      }
      toast.success("Invoice finalized.")
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Auto-accruing drafts</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              The system accrues these draft invoices daily from contract rates and recorded
              deployments. {isAdmin
                ? "Review the breakdown, then finalize to bill the client."
                : "Preview-only — only Admin / Super User can finalize."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "No draft invoices in scope."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Invoice</th>
                    <th className="px-4 py-2 text-left">Client / Branch</th>
                    <th className="px-4 py-2 text-left">Month</th>
                    <th className="px-4 py-2 text-right">Accrued</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{row.invoiceNumber}</td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{row.client?.name ?? "—"}</div>
                        {row.branch?.name ? (
                          <div className="text-xs text-muted-foreground">{row.branch.name}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">{row.month?.slice(0, 7)}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        <ParwestCurrency value={Number(row.amount || 0)} />
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">DRAFT</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void openDetail(row.id)}
                          >
                            Preview
                          </Button>
                          {isAdmin ? (
                            <AlertDialog
                              open={confirmId === row.id}
                              onOpenChange={(v) => setConfirmId(v ? row.id : null)}
                            >
                              <AlertDialogTrigger asChild>
                                <Button size="sm" disabled={busyId === row.id}>
                                  {busyId === row.id ? "Finalizing…" : "Finalize"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Finalize {row.invoiceNumber}?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will move the draft to <strong>PENDING</strong> and apply
                                    any available client advances. Daily accrual will stop touching
                                    this invoice. This cannot be undone except by voiding.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.preventDefault()
                                      void finalize(row.id)
                                    }}
                                  >
                                    Finalize
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {detail ? (
        <InvoiceDetailModal
          invoice={detail}
          onClose={() => setDetail(null)}
          onUpdated={(next) => {
            setDetail(next)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}
