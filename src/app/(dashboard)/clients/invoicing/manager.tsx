"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import StatusChip, { type ChipVariant } from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"

type ApiClientRow = { id: string; name?: string | null }
type BranchRow = { id: string; name: string }

type LineItemKind = "GUARD_SALARY" | "SPECIAL_DUTY" | "MANUAL"
type LineItem = {
  id: string
  kind: LineItemKind
  refId: string | null
  description: string
  quantity: number
  unitPrice: number
}

type InvoiceLineItemDTO = {
  id: string
  kind: LineItemKind
  refId: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type InvoiceRow = {
  id: string
  invoiceNumber: string
  month: string
  amount: number
  subtotal: number
  taxRate: number | null
  taxAmount: number
  paidAmount: number
  status: string
  notes?: string | null
  branchId?: string | null
  branch?: { id: string; name: string } | null
  client?: { id: string; name: string }
  lineItems?: InvoiceLineItemDTO[]
}

type AutofillItem = {
  kind: "GUARD_SALARY" | "SPECIAL_DUTY"
  refId: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

const STATUS_OPTIONS = [
  "DRAFT", "PENDING", "ADVANCE_PAID", "PARTIAL_PAID", "PAID", "UNPAID", "OVERDUE",
] as const

function statusVariant(status: string): ChipVariant {
  switch (status) {
    case "PAID":
    case "ADVANCE_PAID":
      return "success"
    case "OVERDUE":
    case "UNPAID":
      return "danger"
    case "PARTIAL_PAID":
    case "PENDING":
      return "warning"
    default:
      return "neutral"
  }
}

function round2(v: number) { return Math.round(v * 100) / 100 }
function newItemId() { return `tmp_${Math.random().toString(36).slice(2, 10)}` }

function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export default function ClientInvoicingManager() {
  const [period, setPeriod] = useState(currentMonth())
  const [clientId, setClientId] = useState("")
  const [branchId, setBranchId] = useState("")
  const [taxRatePct, setTaxRatePct] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<string>("DRAFT")
  const [dueDate, setDueDate] = useState("")
  const [items, setItems] = useState<LineItem[]>([])

  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [statusFilter, setStatusFilter] = useState("")

  const [error, setError] = useState("")
  const [statusMessage, setStatusMessage] = useState("Compose a new invoice or review existing ones below.")
  const [busy, setBusy] = useState(false)

  // Auto-fill modal state
  const [autoFillOpen, setAutoFillOpen] = useState(false)
  const [autoFillLoading, setAutoFillLoading] = useState(false)
  const [autoFillItems, setAutoFillItems] = useState<AutofillItem[]>([])
  const [autoFillSelected, setAutoFillSelected] = useState<Record<number, boolean>>({})
  const [autoFillWarnings, setAutoFillWarnings] = useState<string[]>([])

  // Detail/edit modal
  const [detail, setDetail] = useState<InvoiceRow | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [paymentNotes, setPaymentNotes] = useState("")

  // Load clients
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/clients", { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) {
          if (isMounted) setError(data?.message || "Failed to load clients.")
          return
        }
        const rows = Array.isArray(data)
          ? (data as ApiClientRow[]).map((r) => ({ id: String(r.id), name: String(r.name || r.id) }))
          : []
        if (isMounted) {
          setClients(rows)
          if (!clientId && rows[0]) setClientId(rows[0].id)
        }
      } catch {
        if (isMounted) setError("Failed to load clients.")
      }
    })()
    return () => { isMounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load branches when client changes
  useEffect(() => {
    let isMounted = true
    setBranchId("")
    if (!clientId) { setBranches([]); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/branches`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) return
        if (isMounted) {
          setBranches(Array.isArray(data) ? data.map((b) => ({ id: String(b.id), name: String(b.name) })) : [])
        }
      } catch {
        /* ignore */
      }
    })()
    return () => { isMounted = false }
  }, [clientId])

  const loadInvoices = useCallback(async () => {
    if (!clientId) return
    try {
      const params = new URLSearchParams({ clientId, month: period })
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.message || "Failed to load invoices.")
        return
      }
      setInvoices(Array.isArray(data) ? data : [])
    } catch {
      setError("Failed to load invoices.")
    }
  }, [clientId, period, statusFilter])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  // Computed totals
  const computedSubtotal = useMemo(
    () => round2(items.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)),
    [items]
  )
  const taxRateDecimal = useMemo(() => {
    const n = Number(taxRatePct)
    if (!Number.isFinite(n) || n < 0) return 0
    return n / 100
  }, [taxRatePct])
  const computedTax = useMemo(() => round2(computedSubtotal * taxRateDecimal), [computedSubtotal, taxRateDecimal])
  const computedTotal = useMemo(() => round2(computedSubtotal + computedTax), [computedSubtotal, computedTax])

  const addBlankItem = () => {
    setItems((prev) => [
      ...prev,
      { id: newItemId(), kind: "MANUAL", refId: null, description: "", quantity: 1, unitPrice: 0 },
    ])
  }
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))
  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  const resetComposer = () => {
    setItems([])
    setNotes("")
    setTaxRatePct("")
    setDueDate("")
    setStatus("DRAFT")
  }

  const submitInvoice = async () => {
    if (!clientId) { setError("Select a client."); return }
    if (!period) { setError("Select a period."); return }
    setError("")
    setBusy(true)
    try {
      const payload = {
        clientId,
        branchId: branchId || undefined,
        month: period,
        status,
        dueDate: dueDate || undefined,
        taxRate: taxRatePct ? taxRateDecimal : undefined,
        notes: notes || undefined,
        lineItems: items.map((i) => ({
          kind: i.kind,
          refId: i.refId,
          description: i.description,
          quantity: Number(i.quantity) || 0,
          unitPrice: Number(i.unitPrice) || 0,
        })),
      }
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.message || "Failed to create invoice.")
        return
      }
      setStatusMessage(`Invoice ${data.invoiceNumber} created (total ${Number(data.amount).toLocaleString()}).`)
      resetComposer()
      loadInvoices()
    } finally {
      setBusy(false)
    }
  }

  const openAutoFill = async () => {
    if (!clientId || !period) { setError("Select client and period first."); return }
    setError("")
    setAutoFillOpen(true)
    setAutoFillLoading(true)
    setAutoFillItems([])
    setAutoFillSelected({})
    setAutoFillWarnings([])
    try {
      const res = await fetch("/api/invoices/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, branchId: branchId || undefined, month: period }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.message || "Auto-fill failed.")
        setAutoFillOpen(false)
        return
      }
      setAutoFillItems(data.items || [])
      const selectedMap: Record<number, boolean> = {}
      ;(data.items || []).forEach((_: AutofillItem, i: number) => { selectedMap[i] = true })
      setAutoFillSelected(selectedMap)
      setAutoFillWarnings(data.warnings || [])
    } finally {
      setAutoFillLoading(false)
    }
  }

  const applyAutoFill = () => {
    const selected = autoFillItems
      .filter((_, i) => autoFillSelected[i])
      .map<LineItem>((it) => ({
        id: newItemId(),
        kind: it.kind,
        refId: it.refId,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }))
    setItems((prev) => [...prev, ...selected])
    setAutoFillOpen(false)
  }

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

  const submitPayment = async () => {
    if (!detail) return
    const amt = Number(paymentAmount)
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a positive amount."); return }
    setError("")
    const res = await fetch(`/api/invoices/${detail.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt, method: paymentMethod, notes: paymentNotes || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data?.message || "Payment failed."); return }
    setDetail(data)
    setPaymentOpen(false)
    setPaymentAmount("")
    setPaymentNotes("")
    setStatusMessage(`Recorded payment of ${amt.toLocaleString()} on ${data.invoiceNumber}.`)
    loadInvoices()
  }

  const markPaid = async () => {
    if (!detail) return
    const outstanding = round2(detail.amount - detail.paidAmount)
    if (outstanding <= 0) {
      const res = await fetch(`/api/invoices/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || "Update failed."); return }
      setDetail(data); loadInvoices(); return
    }
    const res = await fetch(`/api/invoices/${detail.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: outstanding, method: "CASH", notes: "Mark as PAID quick action" }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data?.message || "Failed to mark paid."); return }
    setDetail(data); loadInvoices()
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Client Invoicing" subtitle="Compose branch-level invoices with tax, line items and auto-fill." />
      {error ? <InlineAlert type="error" message={error} /> : null}

      <section className="ui-card p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Client</label>
            <select className="ui-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Branch (optional)</label>
            <select
              className="ui-select"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={!clientId || branches.length === 0}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Period</label>
            <input className="ui-input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Tax rate (%)</label>
            <input
              className="ui-input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="e.g. 17"
              value={taxRatePct}
              onChange={(e) => setTaxRatePct(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Due date</label>
            <input className="ui-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Status</label>
            <select className="ui-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Notes</label>
            <textarea
              className="ui-input"
              rows={1}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes shown on the invoice"
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Line items</h3>
            <div className="flex gap-2">
              <ActionButton type="button" variant="secondary" onClick={openAutoFill} disabled={!clientId || !period}>
                Auto-fill
              </ActionButton>
              <ActionButton type="button" variant="secondary" onClick={addBlankItem}>
                Add line item
              </ActionButton>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[var(--surface-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Kind</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Description</th>
                  <th className="px-3 py-2 text-right text-xs uppercase text-[var(--text-muted)]">Qty</th>
                  <th className="px-3 py-2 text-right text-xs uppercase text-[var(--text-muted)]">Unit Price</th>
                  <th className="px-3 py-2 text-right text-xs uppercase text-[var(--text-muted)]">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[var(--text-muted)]">
                      No line items yet. Use Auto-fill or Add line item.
                    </td>
                  </tr>
                ) : items.map((item) => {
                  const lineTotal = round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))
                  return (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">
                        <select
                          className="ui-select"
                          value={item.kind}
                          onChange={(e) => updateItem(item.id, { kind: e.target.value as LineItemKind, refId: e.target.value === "MANUAL" ? null : item.refId })}
                        >
                          <option value="MANUAL">MANUAL</option>
                          <option value="GUARD_SALARY">GUARD_SALARY</option>
                          <option value="SPECIAL_DUTY">SPECIAL_DUTY</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="ui-input"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          className="ui-input text-right"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          className="ui-input text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{lineTotal.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" className="text-red-600 hover:text-red-800" onClick={() => removeItem(item.id)}>Remove</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2 text-sm text-[var(--text-muted)]">{statusMessage}</div>
          <div className="ui-card p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{computedSubtotal.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Tax ({taxRatePct || 0}%)</span><span className="tabular-nums">{computedTax.toLocaleString()}</span></div>
            <div className="flex justify-between font-semibold border-t border-[var(--border)] pt-1"><span>Total</span><span className="tabular-nums">{computedTotal.toLocaleString()}</span></div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActionButton onClick={submitInvoice} disabled={busy || !clientId}>Save Invoice</ActionButton>
          <ActionButton variant="secondary" onClick={resetComposer}>Reset</ActionButton>
        </div>
      </section>

      <section className="ui-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Invoices for selected client/period</h3>
          <div>
            <select className="ui-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Invoice #</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Client</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Branch</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Month</th>
                <th className="px-4 py-2 text-right text-xs uppercase text-[var(--text-muted)]">Subtotal</th>
                <th className="px-4 py-2 text-right text-xs uppercase text-[var(--text-muted)]">Tax</th>
                <th className="px-4 py-2 text-right text-xs uppercase text-[var(--text-muted)]">Total</th>
                <th className="px-4 py-2 text-right text-xs uppercase text-[var(--text-muted)]">Paid</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-sm text-[var(--text-muted)]">No invoices found.</td>
                </tr>
              ) : invoices.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 text-[var(--text)]">{row.invoiceNumber}</td>
                  <td className="px-4 py-2 text-[var(--text)]">{row.client?.name || "-"}</td>
                  <td className="px-4 py-2 text-[var(--text-muted)]">{row.branch?.name || "-"}</td>
                  <td className="px-4 py-2 text-[var(--text-muted)]">{new Date(row.month).toISOString().slice(0, 7)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(row.subtotal || 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(row.taxAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{Number(row.amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(row.paidAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-2"><StatusChip label={row.status} variant={statusVariant(row.status)} /></td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className="text-[var(--text)] underline" onClick={() => openDetail(row.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Auto-fill modal */}
      {autoFillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ui-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Auto-fill suggestions</h2>
              <button type="button" className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setAutoFillOpen(false)}>×</button>
            </div>
            {autoFillLoading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading suggestions…</p>
            ) : (
              <>
                {autoFillWarnings.length > 0 && (
                  <div className="rounded-[var(--radius-md)] border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    <div className="font-semibold mb-1">Warnings</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {autoFillWarnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                {autoFillItems.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No suggestions for this client/branch/month.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-muted)]">
                      <tr>
                        <th className="px-2 py-1 w-8"></th>
                        <th className="px-2 py-1 text-left">Kind</th>
                        <th className="px-2 py-1 text-left">Description</th>
                        <th className="px-2 py-1 text-right">Qty</th>
                        <th className="px-2 py-1 text-right">Unit</th>
                        <th className="px-2 py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autoFillItems.map((it, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={!!autoFillSelected[i]}
                              onChange={(e) => setAutoFillSelected((prev) => ({ ...prev, [i]: e.target.checked }))}
                            />
                          </td>
                          <td className="px-2 py-1">{it.kind}</td>
                          <td className="px-2 py-1">{it.description}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{it.quantity}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{it.unitPrice.toLocaleString()}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{it.lineTotal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <ActionButton variant="secondary" onClick={() => setAutoFillOpen(false)}>Cancel</ActionButton>
                  <ActionButton onClick={applyAutoFill} disabled={autoFillItems.length === 0}>Apply selected</ActionButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="ui-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{detail.invoiceNumber}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {detail.client?.name}{detail.branch ? ` • ${detail.branch.name}` : ""} • {new Date(detail.month).toISOString().slice(0, 7)}
                </p>
              </div>
              <button type="button" className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setDetail(null)}>×</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-[var(--text-muted)]">Subtotal</div><div className="tabular-nums">{Number(detail.subtotal || 0).toLocaleString()}</div></div>
              <div><div className="text-xs text-[var(--text-muted)]">Tax</div><div className="tabular-nums">{Number(detail.taxAmount || 0).toLocaleString()}</div></div>
              <div><div className="text-xs text-[var(--text-muted)]">Total</div><div className="tabular-nums font-semibold">{Number(detail.amount || 0).toLocaleString()}</div></div>
              <div><div className="text-xs text-[var(--text-muted)]">Paid / Outstanding</div><div className="tabular-nums">{Number(detail.paidAmount || 0).toLocaleString()} / {round2(detail.amount - detail.paidAmount).toLocaleString()}</div></div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Line items</h3>
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-muted)]">
                  <tr>
                    <th className="px-2 py-1 text-left">Kind</th>
                    <th className="px-2 py-1 text-left">Description</th>
                    <th className="px-2 py-1 text-right">Qty</th>
                    <th className="px-2 py-1 text-right">Unit</th>
                    <th className="px-2 py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lineItems || []).length === 0 ? (
                    <tr><td colSpan={5} className="px-2 py-3 text-[var(--text-muted)]">No line items.</td></tr>
                  ) : (detail.lineItems || []).map((li) => (
                    <tr key={li.id} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">{li.kind}</td>
                      <td className="px-2 py-1">{li.description}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{li.quantity}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{Number(li.unitPrice).toLocaleString()}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{Number(li.lineTotal).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusChip label={detail.status} variant={statusVariant(detail.status)} />
              <div className="flex-1" />
              <ActionButton variant="secondary" onClick={() => setPaymentOpen(true)} disabled={detail.amount - detail.paidAmount <= 0}>Record Payment</ActionButton>
              <ActionButton onClick={markPaid} disabled={detail.status === "PAID"}>Mark as PAID</ActionButton>
            </div>

            {paymentOpen && (
              <div className="ui-card p-3 mt-2 space-y-2">
                <h4 className="text-sm font-semibold">Record Payment</h4>
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Amount</label>
                    <input className="ui-input" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Method</label>
                    <select className="ui-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="CASH">CASH</option>
                      <option value="BANK">BANK</option>
                      <option value="MOBILE">MOBILE</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Notes</label>
                    <input className="ui-input" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <ActionButton variant="secondary" onClick={() => setPaymentOpen(false)}>Cancel</ActionButton>
                  <ActionButton onClick={submitPayment}>Save payment</ActionButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
