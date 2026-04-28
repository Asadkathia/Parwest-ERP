"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"
import type { AdvanceRow } from "./types"

type Props = {
  clientId: string
  branches: { id: string; name: string }[]
  setError: (msg: string) => void
  setNotice: (msg: string) => void
}

export default function AdvancesPanel({ clientId, branches, setError, setNotice }: Props) {
  const [rows, setRows] = useState<AdvanceRow[]>([])
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [branchId, setBranchId] = useState("")
  const [method, setMethod] = useState("BANK")
  const [reference, setReference] = useState("")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    if (!clientId) return
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/advance-payments`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || "Failed to load advances."); return }
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setError("Failed to load advances.")
    }
  }, [clientId, setError])

  useEffect(() => {
    if (!clientId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on client change
    void load()
  }, [clientId, load])

  const submit = async () => {
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a positive amount."); return }
    setError("")
    const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/advance-payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amt,
        branchId: branchId || undefined,
        method,
        reference: reference || undefined,
        paymentDate,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data?.message || "Failed to record advance."); return }
    setNotice(`Recorded advance of ${amt.toLocaleString()}.`)
    setOpen(false); setAmount(""); setReference("")
    load()
  }

  if (!clientId) return null

  return (
    <section className="ui-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Client advance payments</h3>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Record advance"}
        </Button>
      </div>

      {open ? (
        <div className="ui-card p-3 mb-3 space-y-2 bg-[var(--surface-muted)]">
          <div className="grid gap-2 md:grid-cols-5">
            <Field label="Amount">
              <input className="ui-input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Date">
              <input className="ui-input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </Field>
            <Field label="Branch (optional)">
              <select className="ui-select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Method">
              <select className="ui-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="BANK">BANK</option>
                <option value="CASH">CASH</option>
                <option value="MOBILE">MOBILE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </Field>
            <Field label="Reference">
              <input className="ui-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="cheque #, txn id…" />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button onClick={submit}>Save advance</Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <Th>Date</Th>
              <Th>Branch</Th>
              <Th>Method</Th>
              <Th>Reference</Th>
              <Th className="text-right">Amount</Th>
              <Th className="text-right">Applied</Th>
              <Th className="text-right">Available</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-sm text-[var(--text-muted)]">No advance payments on file.</td></tr>
            ) : rows.map((r) => {
              const available = Math.max(0, (r.amount || 0) - (r.appliedAmount || 0))
              return (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{new Date(r.paymentDate).toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{r.branch?.name || "All"}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{r.method || "-"}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{r.reference || "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(r.amount || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(r.appliedAmount || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{available.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
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
  return <th className={`px-3 py-2 text-left text-xs uppercase text-[var(--text-muted)] ${className}`}>{children}</th>
}
