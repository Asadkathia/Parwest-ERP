"use client"

/**
 * Parwest ERP — Client Invoicing manager (Phase 5B reskin)
 * ─────────────────────────────────────────────────────────────────────────
 * The legacy in-page `RegionUrlPicker` is removed: the global topbar region
 * filter (post-Phase 4) drives `?regionId=` for all dashboard pages, so the
 * inline picker is redundant. Server-side scoping in the API route is
 * untouched — `deriveManagerScope` + `buildManagerScopeWhere` continue to
 * filter by region.
 *
 * Inline `InlineAlert` + `setError`/`setNotice` are replaced by sonner
 * toasts. The only remaining local error surface is the bulk-generate
 * confirm flow.
 */

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/shadcn/button"
import { PermissionGate } from "@/components/shadcn/permission-gate"
import InvoiceComposer from "./InvoiceComposer"
import InvoiceList from "./InvoiceList"
import InvoiceDetailModal from "./InvoiceDetailModal"
import InvoiceSummaryTiles from "./InvoiceSummaryTiles"
import AdvancesPanel from "./AdvancesPanel"
import { currentMonth, type InvoiceRow } from "./types"

type ApiClientRow = { id: string; name?: string | null }
type BranchRow = { id: string; name: string }

// `regions` and `locked` are retained in the prop signature so that the
// server `page.tsx` does not need to change in this PR. Both are unused in
// the body — the global topbar picker drives `?regionId=` instead.
export default function ClientInvoicingManager(_props: {
  regions?: { id: string; name: string }[]
  locked?: boolean
} = {}) {
  const searchParams = useSearchParams()
  const urlRegionId = searchParams?.get("regionId") || ""
  const [period, setPeriod] = useState(currentMonth())
  const [clientId, setClientId] = useState("")
  const [branchId, setBranchId] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])

  const [detail, setDetail] = useState<InvoiceRow | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Load clients (scoped to URL regionId for SuperAdmin; REGIONAL users are
  // auto-scoped server-side).
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const url = urlRegionId
          ? `/api/clients?regionId=${encodeURIComponent(urlRegionId)}`
          : "/api/clients"
        const res = await fetch(url, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) {
          if (alive) toast.error(data?.message || "Failed to load clients.")
          return
        }
        const rows = Array.isArray(data)
          ? (data as ApiClientRow[]).map((r) => ({
              id: String(r.id),
              name: String(r.name || r.id),
            }))
          : []
        if (alive) {
          setClients(rows)
          // Reset selection if previously chosen client is no longer in scope.
          if (rows.length === 0) setClientId("")
          else if (!rows.some((r) => r.id === clientId)) setClientId(rows[0].id)
        }
      } catch {
        if (alive) toast.error("Failed to load clients.")
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRegionId])

  // Load branches when client changes
  useEffect(() => {
    let alive = true
    setBranchId("")
    if (!clientId) {
      setBranches([])
      return
    }
    ;(async () => {
      try {
        const res = await fetch(
          `/api/clients/${encodeURIComponent(clientId)}/branches`,
          { cache: "no-store" }
        )
        const data = await res.json()
        if (!res.ok) return
        if (alive)
          setBranches(
            Array.isArray(data)
              ? data.map((b) => ({ id: String(b.id), name: String(b.name) }))
              : []
          )
      } catch {
        /* ignore */
      }
    })()
    return () => {
      alive = false
    }
  }, [clientId])

  const loadInvoices = useCallback(async () => {
    if (!clientId) {
      setInvoices([])
      return
    }
    try {
      const params = new URLSearchParams({ clientId, month: period })
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/invoices?${params.toString()}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.message || "Failed to load invoices.")
        return
      }
      setInvoices(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to load invoices.")
    }
  }, [clientId, period, statusFilter])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const openDetail = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        cache: "no-store",
      })
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

  const runBulkGenerate = async () => {
    if (!period) {
      toast.error("Select a period.")
      return
    }
    if (
      !confirm(
        `Generate draft invoices for all clients in your scope for ${period}?`
      )
    )
      return
    setBulkBusy(true)
    try {
      const res = await fetch("/api/invoices/generate-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: period }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.message || "Bulk generation failed.")
        return
      }
      toast.success(
        `Bulk generate: created ${data.summary.created}, skipped ${data.summary.skipped}, errors ${data.summary.errors}.`
      )
      loadInvoices()
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Client Invoicing"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Compose, auto-fill and track invoices. Advances are auto-applied on creation."}</p></div><div className="flex shrink-0 items-center gap-2">{(<PermissionGate module="CLIENTS" action="CREATE" mode="hide">
            <Button onClick={runBulkGenerate} disabled={bulkBusy || !period}>
              {bulkBusy ? "Generating…" : "Bulk generate (period)"}
            </Button>
          </PermissionGate>)}</div></div>

      <InvoiceSummaryTiles rows={invoices} />

      <InvoiceComposer
        clients={clients}
        branches={branches}
        clientId={clientId}
        branchId={branchId}
        period={period}
        onChangeClient={setClientId}
        onChangeBranch={setBranchId}
        onChangePeriod={setPeriod}
        onCreated={(msg) => {
          toast.success(msg)
          loadInvoices()
        }}
        setError={(msg) => {
          if (msg) toast.error(msg)
        }}
      />

      <InvoiceList
        rows={invoices}
        statusFilter={statusFilter}
        onChangeStatusFilter={setStatusFilter}
        onOpenDetail={openDetail}
      />

      <AdvancesPanel
        clientId={clientId}
        branches={branches}
        setError={(msg) => {
          if (msg) toast.error(msg)
        }}
        setNotice={(msg) => {
          if (msg) toast.success(msg)
        }}
      />

      {detail ? (
        <InvoiceDetailModal
          invoice={detail}
          onClose={() => setDetail(null)}
          onUpdated={(next) => {
            setDetail(next)
            loadInvoices()
          }}
        />
      ) : null}
    </div>
  )
}
