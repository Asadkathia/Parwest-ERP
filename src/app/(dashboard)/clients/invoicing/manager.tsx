"use client"

import { useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import StatusChip from "@/components/ui/status-chip"
import InvoiceModeSwitcher from "@/components/invoicing/InvoiceModeSwitcher"
import InvoicePreviewTable from "@/components/invoicing/InvoicePreviewTable"
import { InvoiceDraft, InvoiceMode, getMockInvoiceDrafts, mockClientsList } from "@/lib/mockData"

export default function ClientInvoicingManager() {
  const [mode, setMode] = useState<InvoiceMode>("CLIENT_WISE")
  const [period, setPeriod] = useState("2026-02")
  const [clientId, setClientId] = useState(mockClientsList[0]?.id || "")
  const [statusMessage, setStatusMessage] = useState("Ready to generate invoice draft.")
  const [drafts, setDrafts] = useState<InvoiceDraft[]>(getMockInvoiceDrafts())

  const filtered = useMemo(
    () => drafts.filter((draft) => draft.mode === mode && draft.clientId === clientId),
    [drafts, mode, clientId]
  )

  const activeDraft = filtered[0] || drafts[0]

  const generateInvoice = () => {
    setStatusMessage(`Draft generated for ${period} in ${mode === "CLIENT_WISE" ? "client-wise" : "branch-wise"} mode.`)
  }

  const markPosted = () => {
    if (!activeDraft) return
    setDrafts((prev) => prev.map((draft) => (draft.id === activeDraft.id ? { ...draft, status: "POSTED" } : draft)))
    setStatusMessage("Invoice marked as posted.")
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Client Invoicing" subtitle="Generate branch-wise or client-wise invoices with mock preview and totals" />

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
              {mockClientsList.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActionButton onClick={generateInvoice}>Generate Invoice</ActionButton>
          <ActionButton variant="secondary" onClick={markPosted}>Mark Posted</ActionButton>
          <ActionButton variant="secondary">View History</ActionButton>
          <StatusChip label={activeDraft?.status || "DRAFT"} variant={activeDraft?.status === "POSTED" ? "success" : "warning"} />
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{statusMessage}</p>
      </section>

      {activeDraft ? <InvoicePreviewTable draft={activeDraft} /> : null}
    </div>
  )
}
