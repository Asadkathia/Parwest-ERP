"use client"

import { useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import StatusChip from "@/components/ui/status-chip"
import InvoiceModeSwitcher from "@/components/invoicing/InvoiceModeSwitcher"
import InlineAlert from "@/components/ui/inline-alert"

type InvoiceMode = "CLIENT_WISE" | "BRANCH_WISE"
type ApiClientRow = { id: string; name?: string | null }

type ClientRow = {
  id: string
  name: string
}

type InvoiceRow = {
  id: string
  invoiceNumber: string
  month: string
  amount: number
  status: string
  client?: {
    id: string
    name: string
  }
}

export default function ClientInvoicingManager() {
  const [mode, setMode] = useState<InvoiceMode>("CLIENT_WISE")
  const [period, setPeriod] = useState("2026-02")
  const [clientId, setClientId] = useState("")
  const [amount, setAmount] = useState("0")
  const [statusMessage, setStatusMessage] = useState("Ready to generate invoice draft.")
  const [clients, setClients] = useState<ClientRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true
    const loadClients = async () => {
      try {
        const response = await fetch("/api/clients", { cache: "no-store" })
        const data = await response.json()
        if (!response.ok) {
          if (isMounted) setError(data?.message || "Failed to load clients.")
          return
        }
        const rows = Array.isArray(data)
          ? (data as ApiClientRow[]).map((row) => ({ id: String(row.id), name: String(row.name || row.id) }))
          : []
        if (isMounted) {
          setClients(rows)
          if (!clientId && rows[0]) setClientId(rows[0].id)
        }
      } catch {
        if (isMounted) setError("Failed to load clients.")
      }
    }
    loadClients()
    return () => {
      isMounted = false
    }
  }, [clientId])

  useEffect(() => {
    let isMounted = true
    const loadInvoices = async () => {
      if (!clientId) return
      try {
        const response = await fetch(`/api/invoices?clientId=${encodeURIComponent(clientId)}&month=${encodeURIComponent(period)}`, {
          cache: "no-store",
        })
        const data = await response.json()
        if (!response.ok) {
          if (isMounted) setError(data?.message || "Failed to load invoices.")
          return
        }
        if (isMounted) {
          setInvoices(Array.isArray(data) ? data : [])
        }
      } catch {
        if (isMounted) setError("Failed to load invoices.")
      }
    }
    loadInvoices()
    return () => {
      isMounted = false
    }
  }, [clientId, period])

  const activeInvoice = useMemo(() => invoices[0] || null, [invoices])

  const generateInvoice = async () => {
    if (!clientId) {
      setError("Select a client.")
      return
    }
    setError("")
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError("Enter a valid non-negative amount.")
      return
    }

    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        month: period,
        amount: parsedAmount,
        status: "PENDING",
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data?.message || "Failed to generate invoice.")
      return
    }

    setInvoices((prev) => [data, ...prev])
    setStatusMessage(`Invoice generated for ${period} in ${mode === "CLIENT_WISE" ? "client-wise" : "branch-wise"} mode.`)
  }

  const markPosted = async () => {
    if (!activeInvoice) return
    setError("")
    const response = await fetch(`/api/invoices/${activeInvoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString() }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data?.message || "Failed to update invoice.")
      return
    }
    setInvoices((prev) => prev.map((row) => (row.id === data.id ? data : row)))
    setStatusMessage("Invoice marked as posted/paid.")
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Client Invoicing" subtitle="Generate branch-wise or client-wise invoices with database-backed records." />
      {error ? <InlineAlert type="error" message={error} /> : null}

      <section className="ui-card p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Mode</label>
            <InvoiceModeSwitcher mode={mode} onChange={setMode} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Period</label>
            <input className="ui-input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Client</label>
            <select className="ui-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Amount</label>
            <input className="ui-input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActionButton onClick={generateInvoice}>Generate Invoice</ActionButton>
          <ActionButton variant="secondary" onClick={markPosted} disabled={!activeInvoice}>Mark Posted</ActionButton>
          <StatusChip label={activeInvoice?.status || "PENDING"} variant={activeInvoice?.status === "PAID" ? "success" : "warning"} />
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{statusMessage}</p>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[640px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Invoice #</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Client</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Month</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Amount</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-[var(--text-muted)]">No invoices found for selected criteria.</td>
              </tr>
            ) : (
              invoices.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 text-sm text-[var(--text)]">{row.invoiceNumber}</td>
                  <td className="px-4 py-2 text-sm text-[var(--text)]">{row.client?.name || "-"}</td>
                  <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{new Date(row.month).toISOString().slice(0, 7)}</td>
                  <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{Number(row.amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm">
                    <StatusChip label={row.status} variant={row.status === "PAID" ? "success" : "warning"} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
