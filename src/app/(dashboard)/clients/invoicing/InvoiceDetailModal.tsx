"use client"

import { useState } from "react"
import ActionButton from "@/components/ui/action-button"
import StatusChip from "@/components/ui/status-chip"
import { round2, statusVariant, type InvoiceRow } from "./types"

type Props = {
  invoice: InvoiceRow
  onClose: () => void
  onUpdated: (next: InvoiceRow) => void
  setError: (msg: string) => void
  setNotice: (msg: string) => void
}

export default function InvoiceDetailModal({ invoice, onClose, onUpdated, setError, setNotice }: Props) {
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")

  const outstanding = round2(invoice.amount - invoice.paidAmount)
  const isVoid = invoice.status === "VOID"

  const submitPayment = async () => {
    const amt = Number(paymentAmount)
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a positive amount."); return }
    setError("")
    const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt, method: paymentMethod, notes: paymentNotes || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data?.message || "Payment failed."); return }
    onUpdated(data)
    setPaymentOpen(false); setPaymentAmount(""); setPaymentNotes("")
    setNotice(`Recorded payment of ${amt.toLocaleString()} on ${data.invoiceNumber}.`)
  }

  const markPaid = async () => {
    if (outstanding <= 0) {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || "Update failed."); return }
      onUpdated(data); return
    }
    const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: outstanding, method: "CASH", notes: "Mark as PAID quick action" }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data?.message || "Failed to mark paid."); return }
    onUpdated(data)
  }

  const submitVoid = async () => {
    if (!voidReason.trim()) { setError("Void reason required."); return }
    setError("")
    const res = await fetch(`/api/invoices/${invoice.id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: voidReason.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data?.message || "Void failed."); return }
    onUpdated(data); setVoidOpen(false); setVoidReason("")
    setNotice(`Invoice ${data.invoiceNumber} voided.`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ui-card w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{invoice.invoiceNumber}</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {invoice.client?.name}{invoice.branch ? ` • ${invoice.branch.name}` : ""} • {new Date(invoice.month).toISOString().slice(0, 7)}
            </p>
          </div>
          <button type="button" className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)]" onClick={onClose}>×</button>
        </div>

        {isVoid ? (
          <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-semibold">Voided</div>
            {invoice.voidReason ? <div>Reason: {invoice.voidReason}</div> : null}
            {invoice.voidedAt ? <div className="text-xs opacity-80">at {new Date(invoice.voidedAt).toLocaleString()}</div> : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Subtotal" value={Number(invoice.subtotal || 0).toLocaleString()} />
          <Stat label="Tax" value={Number(invoice.taxAmount || 0).toLocaleString()} />
          <Stat label="Total" value={Number(invoice.amount || 0).toLocaleString()} bold />
          <Stat label="Paid / Outstanding" value={`${Number(invoice.paidAmount || 0).toLocaleString()} / ${outstanding.toLocaleString()}`} />
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Line items</h3>
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <Th>Kind</Th><Th>Description</Th>
                <Th className="text-right">Qty</Th><Th className="text-right">Unit</Th><Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lineItems || []).length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-3 text-[var(--text-muted)]">No line items.</td></tr>
              ) : (invoice.lineItems || []).map((li) => (
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

        {invoice.advanceApplications && invoice.advanceApplications.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold mb-2">Advances applied</h3>
            <ul className="text-sm space-y-1">
              {invoice.advanceApplications.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-[var(--border)] py-1">
                  <span className="text-[var(--text-muted)]">advance {a.advance.id.slice(-6)} ({new Date(a.advance.paymentDate).toISOString().slice(0, 10)})</span>
                  <span className="tabular-nums">{Number(a.amount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <StatusChip label={invoice.status} variant={statusVariant(invoice.status)} />
          <div className="flex-1" />
          {!isVoid ? (
            <>
              <ActionButton variant="secondary" onClick={() => setPaymentOpen(true)} disabled={outstanding <= 0}>Record Payment</ActionButton>
              <ActionButton onClick={markPaid} disabled={invoice.status === "PAID"}>Mark as PAID</ActionButton>
              <button
                type="button"
                className="text-sm text-red-600 hover:text-red-800 underline"
                onClick={() => setVoidOpen(true)}
                disabled={invoice.paidAmount > 0}
                title={invoice.paidAmount > 0 ? "Cannot void an invoice with payments" : "Void invoice"}
              >
                Void
              </button>
            </>
          ) : null}
        </div>

        {paymentOpen ? (
          <div className="ui-card p-3 mt-2 space-y-2">
            <h4 className="text-sm font-semibold">Record Payment</h4>
            <div className="grid gap-2 md:grid-cols-3">
              <Field label="Amount">
                <input className="ui-input" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              </Field>
              <Field label="Method">
                <select className="ui-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                  <option value="MOBILE">MOBILE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </Field>
              <Field label="Notes">
                <input className="ui-input" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <ActionButton variant="secondary" onClick={() => setPaymentOpen(false)}>Cancel</ActionButton>
              <ActionButton onClick={submitPayment}>Save payment</ActionButton>
            </div>
          </div>
        ) : null}

        {voidOpen ? (
          <div className="ui-card p-3 mt-2 space-y-2 border border-red-200">
            <h4 className="text-sm font-semibold text-red-700">Void invoice</h4>
            <Field label="Reason (required)">
              <input className="ui-input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. issued in error" />
            </Field>
            <div className="flex justify-end gap-2">
              <ActionButton variant="secondary" onClick={() => setVoidOpen(false)}>Cancel</ActionButton>
              <ActionButton onClick={submitVoid}>Confirm void</ActionButton>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Stat({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      {children}
    </div>
  )
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-1 text-left text-xs uppercase text-[var(--text-muted)] ${className}`}>{children}</th>
}
