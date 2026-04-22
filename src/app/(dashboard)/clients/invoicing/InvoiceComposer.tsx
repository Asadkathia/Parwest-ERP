"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import {
  STATUS_OPTIONS,
  newItemId,
  round2,
  type AutofillItem,
  type ComposerLineItem,
} from "./types"

type BranchRow = { id: string; name: string }
type ClientRow = { id: string; name: string }

type Props = {
  clients: ClientRow[]
  branches: BranchRow[]
  clientId: string
  branchId: string
  period: string
  onChangeClient: (id: string) => void
  onChangeBranch: (id: string) => void
  onChangePeriod: (m: string) => void
  onCreated: (msg: string) => void
  setError: (msg: string) => void
}

export default function InvoiceComposer({
  clients, branches, clientId, branchId, period,
  onChangeClient, onChangeBranch, onChangePeriod,
  onCreated, setError,
}: Props) {
  const [taxRatePct, setTaxRatePct] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<string>("DRAFT")
  const [dueDate, setDueDate] = useState("")
  const [items, setItems] = useState<ComposerLineItem[]>([])
  const [busy, setBusy] = useState(false)

  const [autoFillOpen, setAutoFillOpen] = useState(false)
  const [autoFillLoading, setAutoFillLoading] = useState(false)
  const [autoFillItems, setAutoFillItems] = useState<AutofillItem[]>([])
  const [autoFillSelected, setAutoFillSelected] = useState<Record<number, boolean>>({})
  const [autoFillWarnings, setAutoFillWarnings] = useState<string[]>([])

  const subtotal = useMemo(
    () => round2(items.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)),
    [items],
  )
  const taxRateDecimal = useMemo(() => {
    const n = Number(taxRatePct)
    return Number.isFinite(n) && n >= 0 ? n / 100 : 0
  }, [taxRatePct])
  const tax = useMemo(() => round2(subtotal * taxRateDecimal), [subtotal, taxRateDecimal])
  const total = useMemo(() => round2(subtotal + tax), [subtotal, tax])

  const reset = () => {
    setItems([]); setNotes(""); setTaxRatePct(""); setDueDate(""); setStatus("DRAFT")
  }

  const submit = async () => {
    if (!clientId) { setError("Select a client."); return }
    if (!period) { setError("Select a period."); return }
    setError("")
    setBusy(true)
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, branchId: branchId || undefined, month: period, status,
          dueDate: dueDate || undefined,
          taxRate: taxRatePct ? taxRateDecimal : undefined,
          notes: notes || undefined,
          lineItems: items.map((i) => ({
            kind: i.kind, refId: i.refId, description: i.description,
            quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || "Failed to create invoice."); return }
      onCreated(`Invoice ${data.invoiceNumber} created (total ${Number(data.amount).toLocaleString()}).`)
      reset()
    } finally {
      setBusy(false)
    }
  }

  const openAutoFill = async () => {
    if (!clientId || !period) { setError("Select client and period first."); return }
    setError("")
    setAutoFillOpen(true)
    setAutoFillLoading(true)
    setAutoFillItems([]); setAutoFillSelected({}); setAutoFillWarnings([])
    try {
      const res = await fetch("/api/invoices/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, branchId: branchId || undefined, month: period }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || "Auto-fill failed."); setAutoFillOpen(false); return }
      setAutoFillItems(data.items || [])
      const sel: Record<number, boolean> = {}
      ;(data.items || []).forEach((_: AutofillItem, i: number) => { sel[i] = true })
      setAutoFillSelected(sel)
      setAutoFillWarnings(data.warnings || [])
    } finally {
      setAutoFillLoading(false)
    }
  }

  const applyAutoFill = () => {
    const picks = autoFillItems
      .filter((_, i) => autoFillSelected[i])
      .map<ComposerLineItem>((it) => ({
        id: newItemId(), kind: it.kind, refId: it.refId,
        description: it.description, quantity: it.quantity, unitPrice: it.unitPrice,
        rateSource: it.rateSource,
      }))
    setItems((prev) => [...prev, ...picks])
    setAutoFillOpen(false)
  }

  return (
    <section className="ui-card p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Client">
          <select className="ui-select" value={clientId} onChange={(e) => onChangeClient(e.target.value)}>
            <option value="">Select client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Branch (optional)">
          <select
            className="ui-select"
            value={branchId}
            onChange={(e) => onChangeBranch(e.target.value)}
            disabled={!clientId || branches.length === 0}
          >
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Period">
          <input className="ui-input" type="month" value={period} onChange={(e) => onChangePeriod(e.target.value)} />
        </Field>
        <Field label="Tax rate (%)">
          <input
            className="ui-input" type="number" min="0" max="100" step="0.01" placeholder="e.g. 17"
            value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)}
          />
        </Field>
        <Field label="Due date">
          <input className="ui-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Status">
          <select className="ui-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.filter((s) => s !== "VOID").map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Notes" className="md:col-span-2">
          <textarea
            className="ui-input" rows={1} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes shown on the invoice"
          />
        </Field>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Line items</h3>
          <div className="flex gap-2">
            <ActionButton type="button" variant="secondary" onClick={openAutoFill} disabled={!clientId || !period}>
              Auto-fill
            </ActionButton>
            <ActionButton
              type="button"
              variant="secondary"
              onClick={() => setItems((p) => [...p, { id: newItemId(), kind: "MANUAL", refId: null, description: "", quantity: 1, unitPrice: 0 }])}
            >
              Add line item
            </ActionButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <Th>Kind</Th>
                <Th>Description</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Unit Price</Th>
                <Th className="text-right">Total</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-[var(--text-muted)]">No line items yet. Use Auto-fill or Add line item.</td></tr>
              ) : items.map((item) => {
                const lineTotal = round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))
                return (
                  <tr key={item.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <select
                          className="ui-select"
                          value={item.kind}
                          onChange={(e) => setItems((prev) => prev.map((i) => i.id === item.id
                            ? { ...i, kind: e.target.value as ComposerLineItem["kind"], refId: e.target.value === "MANUAL" ? null : i.refId }
                            : i))}
                        >
                          <option value="MANUAL">MANUAL</option>
                          <option value="GUARD_SALARY">GUARD_SALARY</option>
                          <option value="SPECIAL_DUTY">SPECIAL_DUTY</option>
                        </select>
                        {item.rateSource && item.rateSource !== "NONE" ? (
                          <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{item.rateSource.toLowerCase()}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input className="ui-input" value={item.description}
                        onChange={(e) => setItems((p) => p.map((i) => i.id === item.id ? { ...i, description: e.target.value } : i))} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input className="ui-input text-right" type="number" min="0.01" step="0.01" value={item.quantity}
                        onChange={(e) => setItems((p) => p.map((i) => i.id === item.id ? { ...i, quantity: Number(e.target.value) } : i))} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input className="ui-input text-right" type="number" min="0" step="0.01" value={item.unitPrice}
                        onChange={(e) => setItems((p) => p.map((i) => i.id === item.id ? { ...i, unitPrice: Number(e.target.value) } : i))} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{lineTotal.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-red-600 hover:text-red-800"
                        onClick={() => setItems((p) => p.filter((i) => i.id !== item.id))}>Remove</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2 text-sm text-[var(--text-muted)]" />
        <div className="ui-card p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Tax ({taxRatePct || 0}%)</span><span className="tabular-nums">{tax.toLocaleString()}</span></div>
          <div className="flex justify-between font-semibold border-t border-[var(--border)] pt-1">
            <span>Total</span><span className="tabular-nums">{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={submit} disabled={busy || !clientId}>Save Invoice</ActionButton>
        <ActionButton variant="secondary" onClick={reset}>Reset</ActionButton>
      </div>

      {autoFillOpen ? (
        <Modal onClose={() => setAutoFillOpen(false)} title="Auto-fill suggestions">
          {autoFillLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading suggestions…</p>
          ) : (
            <>
              {autoFillWarnings.length > 0 ? (
                <div className="rounded-[var(--radius-md)] border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  <div className="font-semibold mb-1">Warnings</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {autoFillWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              ) : null}
              {autoFillItems.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No suggestions for this client/branch/month.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-muted)]">
                    <tr>
                      <Th />
                      <Th>Kind</Th>
                      <Th>Description</Th>
                      <Th className="text-right">Qty</Th>
                      <Th className="text-right">Unit</Th>
                      <Th className="text-right">Total</Th>
                      <Th>Source</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoFillItems.map((it, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-2 py-1">
                          <input type="checkbox" checked={!!autoFillSelected[i]}
                            onChange={(e) => setAutoFillSelected((p) => ({ ...p, [i]: e.target.checked }))} />
                        </td>
                        <td className="px-2 py-1">{it.kind}</td>
                        <td className="px-2 py-1">{it.description}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{it.quantity}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{it.unitPrice.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{it.lineTotal.toLocaleString()}</td>
                        <td className="px-2 py-1 text-xs uppercase text-[var(--text-muted)]">{(it.rateSource || "").toLowerCase()}</td>
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
        </Modal>
      ) : null}
    </section>
  )
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</label>
      {children}
    </div>
  )
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)] ${className}`}>{children}</th>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ui-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
