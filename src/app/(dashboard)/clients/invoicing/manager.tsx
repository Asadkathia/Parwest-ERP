"use client"

import { useCallback, useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import InvoiceComposer from "./InvoiceComposer"
import InvoiceList from "./InvoiceList"
import InvoiceDetailModal from "./InvoiceDetailModal"
import InvoiceSummaryTiles from "./InvoiceSummaryTiles"
import AdvancesPanel from "./AdvancesPanel"
import { currentMonth, type InvoiceRow } from "./types"

type ApiClientRow = { id: string; name?: string | null }
type BranchRow = { id: string; name: string }

export default function ClientInvoicingManager() {
  const [period, setPeriod] = useState(currentMonth())
  const [clientId, setClientId] = useState("")
  const [branchId, setBranchId] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])

  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [detail, setDetail] = useState<InvoiceRow | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Load clients
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch("/api/clients", { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) { if (alive) setError(data?.message || "Failed to load clients."); return }
        const rows = Array.isArray(data)
          ? (data as ApiClientRow[]).map((r) => ({ id: String(r.id), name: String(r.name || r.id) }))
          : []
        if (alive) {
          setClients(rows)
          if (!clientId && rows[0]) setClientId(rows[0].id)
        }
      } catch {
        if (alive) setError("Failed to load clients.")
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load branches when client changes
  useEffect(() => {
    let alive = true
    setBranchId("")
    if (!clientId) { setBranches([]); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/branches`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) return
        if (alive) setBranches(Array.isArray(data) ? data.map((b) => ({ id: String(b.id), name: String(b.name) })) : [])
      } catch { /* ignore */ }
    })()
    return () => { alive = false }
  }, [clientId])

  const loadInvoices = useCallback(async () => {
    if (!clientId) { setInvoices([]); return }
    try {
      const params = new URLSearchParams({ clientId, month: period })
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || "Failed to load invoices."); return }
      setInvoices(Array.isArray(data) ? data : [])
    } catch {
      setError("Failed to load invoices.")
    }
  }, [clientId, period, statusFilter])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const openDetail = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || "Failed to load invoice."); return }
      setDetail(data)
    } catch {
      setError("Failed to load invoice.")
    }
  }

  const runBulkGenerate = async () => {
    if (!period) { setError("Select a period."); return }
    if (!confirm(`Generate draft invoices for all clients in your scope for ${period}?`)) return
    setError(""); setNotice("")
    setBulkBusy(true)
    try {
      const res = await fetch("/api/invoices/generate-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: period }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || "Bulk generation failed."); return }
      setNotice(`Bulk generate: created ${data.summary.created}, skipped ${data.summary.skipped}, errors ${data.summary.errors}.`)
      loadInvoices()
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Client Invoicing"
        subtitle="Compose, auto-fill and track invoices. Advances are auto-applied on creation."
        action={
          <ActionButton onClick={runBulkGenerate} disabled={bulkBusy || !period}>
            {bulkBusy ? "Generating…" : "Bulk generate (period)"}
          </ActionButton>
        }
      />

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

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
        onCreated={(msg) => { setNotice(msg); loadInvoices() }}
        setError={setError}
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
        setError={setError}
        setNotice={setNotice}
      />

      {detail ? (
        <InvoiceDetailModal
          invoice={detail}
          onClose={() => setDetail(null)}
          onUpdated={(next) => { setDetail(next); loadInvoices() }}
          setError={setError}
          setNotice={setNotice}
        />
      ) : null}
    </div>
  )
}
