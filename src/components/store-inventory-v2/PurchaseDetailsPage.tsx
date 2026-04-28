"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import { useSearchParams } from "next/navigation"
import { apiGet } from "@/components/store-inventory-v2/api"

type Purchase = {
  id: string
  status: string
  referenceNo?: string | null
  invoiceNo?: string | null
  notes?: string | null
  purchasedAt: string
  store: { id: string; name: string; type?: string | null }
  vendor?: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  lines: Array<{
    id: string
    quantity: number
    unitCost?: number | null
    product: { id: string; name: string; sku: string; category?: { name?: string | null } | null; calibre?: { name?: string | null } | null; weaponType?: { name?: string | null } | null; variation?: { name?: string | null } | null }
  }>
  workflow?: {
    transport?: {
      transportType: "SELF" | "COURIER"
      driverName?: string | null
      driverPhone?: string | null
      vehicleNumber?: string | null
      courierCompany?: string | null
      courierTrackingId?: string | null
      courierBy?: string | null
      courierDate?: string | null
    } | null
    history: Array<{
      status: "PENDING" | "RECEIVED" | "CANCELLED"
      changedByName?: string | null
      changedAt: string
      remarks?: string | null
      lines?: Array<{
        purchaseLineId?: string
        productId?: string
        productName?: string | null
        variant?: string | null
        newReceivedQty: number
        damagedQty: number
        okQty: number
        reusableQty: number
        remarks?: string | null
      }>
    }>
  } | null
  purchaseOrder?: {
    approvalReference?: string | null
    invoiceDate?: string | null
    deliveryChallanNumber?: string | null
  } | null
}

function toStatusLabel(value: string): string {
  const raw = String(value || "").toUpperCase()
  if (raw === "RECEIVED") return "Confirmed"
  if (raw === "CANCELLED") return "Rejected"
  if (raw === "DRAFT") return "Pending"
  return value
}

function statusBadgeClass(value: string): string {
  const raw = String(value || "").toUpperCase()
  if (raw === "RECEIVED") return "bg-emerald-100 text-emerald-700"
  if (raw === "CANCELLED") return "bg-rose-100 text-rose-700"
  return "bg-amber-100 text-amber-700"
}

export default function PurchaseDetailsPage({ purchaseId }: { purchaseId: string }) {
  const [row, setRow] = useState<Purchase | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setNotice(null)
      try {
        const data = await apiGet<Purchase>(`/api/store-inventory/v2/purchases/${purchaseId}`)
        if (!cancelled) setRow(data)
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load purchase details."
          setNotice({ type: "error", message })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [purchaseId])

  useEffect(() => {
    if (!row) return
    if (searchParams.get("print") !== "1") return
    const t = setTimeout(() => {
      window.print()
    }, 200)
    return () => clearTimeout(t)
  }, [row, searchParams])

  const receivedByLine = useMemo(() => {
    const map = new Map<string, number>()
    for (const history of row?.workflow?.history || []) {
      for (const line of history.lines || []) {
        const key = line.purchaseLineId || line.productId || ""
        if (!key) continue
        map.set(key, (map.get(key) || 0) + (line.newReceivedQty + line.okQty))
      }
    }
    return map
  }, [row])

  const terminal = useMemo(() => {
    const entry = [...(row?.workflow?.history || [])]
      .reverse()
      .find((item) => item.status === "RECEIVED" || item.status === "CANCELLED")
    return {
      by: entry?.changedByName || "N/A",
      at: entry?.changedAt ? new Date(entry.changedAt).toLocaleString() : "N/A",
      rejectReason: entry?.status === "CANCELLED" ? entry.remarks || "N/A" : "N/A",
    }
  }, [row])

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Purchase Details"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Lifecycle details, transport details, and status history."}</p></div></div>
      {notice ? (
        notice.type === "success" ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice.message}</AlertDescription></Alert>
        ) : (
          <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{notice.message}</AlertDescription></Alert>
        )
      ) : null}
      {!row && loading ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{"Loading purchase details..."}</AlertDescription></Alert> : null}
      {row ? (
        <>
          <Card>
        <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-[var(--text-muted)]">
                Purchase Status:{" "}
                <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                  {toStatusLabel(row.status)}
                </span>
              </div>
              <Button onClick={() => window.print()}>Print PO</Button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Store/Warehouse:</span> {row.store.name}</div>
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Vendor:</span> {row.vendor?.name || "—"}</div>
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Purchase Date:</span> {new Date(row.purchasedAt).toLocaleDateString("en-CA")}</div>
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Approval Reference:</span> {row.purchaseOrder?.approvalReference || row.referenceNo || "—"}</div>
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Invoice Number:</span> {row.invoiceNo || "—"}</div>
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Invoice Date:</span> {row.purchaseOrder?.invoiceDate || "—"}</div>
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Delivery Challan:</span> {row.purchaseOrder?.deliveryChallanNumber || "—"}</div>
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Confirmed/Rejected By:</span> {terminal.by}</div>
              <div className="rounded border border-[var(--border)] p-2"><span className="text-[var(--text-muted)]">Confirmed/Rejected At:</span> {terminal.at}</div>
            </div>
            <div className="rounded border border-[var(--border)] p-2 text-sm">
              <span className="text-[var(--text-muted)]">Reject Reason:</span> {terminal.rejectReason}
            </div>
            <div className="rounded border border-[var(--border)] p-2 text-sm">
              <span className="text-[var(--text-muted)]">Note:</span> {row.notes || "—"}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                    <th className="p-2">Product</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Calibre</th>
                    <th className="p-2">Weapon Type</th>
                    <th className="p-2">Product Variant</th>
                    <th className="p-2">Total Quantity</th>
                    <th className="p-2">Received Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((line) => (
                    <tr key={line.id} className="border-b border-[var(--border)]">
                      <td className="p-2">{line.product.name} ({line.product.sku})</td>
                      <td className="p-2">{line.product.category?.name || "—"}</td>
                      <td className="p-2">{line.product.calibre?.name || "—"}</td>
                      <td className="p-2">{line.product.weaponType?.name || "—"}</td>
                      <td className="p-2">{line.product.variation?.name || "—"}</td>
                      <td className="p-2">{line.quantity}</td>
                      <td className="p-2">{receivedByLine.get(line.id) || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
      </Card>

          <Card>
        <CardContent className="p-5">
            <div className="mb-2 font-medium text-[var(--text-muted)]">Transportation Details</div>
            {row.workflow?.transport ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                      <th className="p-2">Transportation Type</th>
                      <th className="p-2">Driver Name</th>
                      <th className="p-2">Driver Phone</th>
                      <th className="p-2">Vehicle Number</th>
                      <th className="p-2">Courier Company</th>
                      <th className="p-2">Tracking ID</th>
                      <th className="p-2">Courier By</th>
                      <th className="p-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border)]">
                      <td className="p-2">{row.workflow.transport.transportType}</td>
                      <td className="p-2">{row.workflow.transport.driverName || "N/A"}</td>
                      <td className="p-2">{row.workflow.transport.driverPhone || "N/A"}</td>
                      <td className="p-2">{row.workflow.transport.vehicleNumber || "N/A"}</td>
                      <td className="p-2">{row.workflow.transport.courierCompany || "N/A"}</td>
                      <td className="p-2">{row.workflow.transport.courierTrackingId || "N/A"}</td>
                      <td className="p-2">{row.workflow.transport.courierBy || "N/A"}</td>
                      <td className="p-2">{row.workflow.transport.courierDate || "N/A"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-[var(--text-muted)]">No transport details.</div>
            )}
          </CardContent>
      </Card>

          <Card>
        <CardContent className="p-5">
            <div className="mb-2 font-medium text-[var(--text-muted)]">Status History</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                    <th className="p-2">Status</th>
                    <th className="p-2">Changed By</th>
                    <th className="p-2">Remarks</th>
                    <th className="p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(row.workflow?.history || []).map((entry, idx) => (
                    <tr key={`${entry.changedAt}-${idx}`} className="border-b border-[var(--border)]">
                      <td className="p-2">{entry.status}</td>
                      <td className="p-2">{entry.changedByName || "admin"}</td>
                      <td className="p-2">
                        <div>{entry.remarks || "N/A"}</div>
                        {entry.lines?.length ? (
                          <div className="mt-2 overflow-x-auto rounded border border-[var(--border)]">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                                  <th className="p-1">Product</th>
                                  <th className="p-1">Variant</th>
                                  <th className="p-1">New Received</th>
                                  <th className="p-1">Damaged</th>
                                  <th className="p-1">Ok Qty</th>
                                  <th className="p-1">Reusable Qty</th>
                                  <th className="p-1">Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.lines.map((line, lineIdx) => (
                                  <tr key={`${line.purchaseLineId || lineIdx}`} className="border-b border-[var(--border)]">
                                    <td className="p-1">{line.productName || "—"}</td>
                                    <td className="p-1">{line.variant || "—"}</td>
                                    <td className="p-1">{line.newReceivedQty}</td>
                                    <td className="p-1">{line.damagedQty}</td>
                                    <td className="p-1">{line.okQty}</td>
                                    <td className="p-1">{line.reusableQty}</td>
                                    <td className="p-1">{line.remarks || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2">{new Date(entry.changedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
      </Card>
        </>
      ) : null}
    </div>
  )
}
