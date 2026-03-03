"use client"

import { useEffect, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"

type InvoiceRow = {
  id: string
  invoiceNumber: string
  amount: number
  status: string
  month: string
  dueDate?: string | null
  client?: {
    id: string
    name: string
  }
}

type ClientRow = { id: string; name: string }
type ApiClientRow = { id: string; name?: string | null }

export default function InvoicedBillingsManager() {
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [clientId, setClientId] = useState("")
  const [invoiceMonth, setInvoiceMonth] = useState("")
  const [invoiceStatus, setInvoiceStatus] = useState("")
  const [entries, setEntries] = useState("10")
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [selectedToPost, setSelectedToPost] = useState<string[]>([])

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      try {
        const response = await fetch("/api/clients", { cache: "no-store" })
        const data = await response.json()
        if (!response.ok) {
          if (isMounted) setError(data?.message || "Failed to load clients.")
          return
        }
        if (isMounted) {
          setClients(
            Array.isArray(data)
              ? (data as ApiClientRow[]).map((row) => ({ id: String(row.id), name: String(row.name || row.id) }))
              : []
          )
        }
      } catch {
        if (isMounted) setError("Failed to load clients.")
      }
    }
    run()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      const params = new URLSearchParams()
      if (clientId) params.set("clientId", clientId)
      if (invoiceMonth) params.set("month", invoiceMonth)
      if (invoiceStatus) params.set("status", invoiceStatus)
      if (search) params.set("search", search)

      try {
        const response = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" })
        const data = await response.json()
        if (!response.ok) {
          if (isMounted) setError(data?.message || "Failed to load invoices.")
          return
        }
        if (isMounted) setRows(Array.isArray(data) ? data : [])
      } catch {
        if (isMounted) setError("Failed to load invoices.")
      }
    }
    run()
    return () => {
      isMounted = false
    }
  }, [clientId, invoiceMonth, invoiceStatus, search])

  const visibleRows = useMemo(() => rows.slice(0, Number.parseInt(entries, 10) || 10), [rows, entries])

  const clearFilters = () => {
    setClientId("")
    setInvoiceMonth("")
    setInvoiceStatus("")
    setEntries("10")
    setSearch("")
    setSelectedToPost([])
    setNotice("Filters cleared.")
  }

  const postSelected = async () => {
    if (selectedToPost.length === 0) {
      setNotice("No invoices selected.")
      return
    }
    setError("")
    const updatedIds: string[] = []
    for (const id of selectedToPost) {
      const response = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString() }),
      })
      if (response.ok) updatedIds.push(id)
    }

    if (updatedIds.length > 0) {
      setRows((prev) => prev.map((row) => (updatedIds.includes(row.id) ? { ...row, status: "PAID" } : row)))
      setSelectedToPost([])
      setNotice(`Posted ${updatedIds.length} invoice(s).`)
    } else {
      setError("Failed to post selected invoices.")
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Invoiced Billings" subtitle="Invoice billing management with database-backed records." />
      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="ui-select">
              <option value="">--All Clients--</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Invoice Month</label>
            <input type="month" value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)} className="ui-input" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Status</label>
            <select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className="ui-select">
              <option value="">--All--</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input" placeholder="Invoice number or client" />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Entries</label>
            <select value={entries} onChange={(e) => setEntries(e.target.value)} className="ui-select">
              {["10", "25", "50", "100"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <ActionButton onClick={postSelected}>Post Selected</ActionButton>
          <ActionButton variant="secondary" onClick={clearFilters}>Clear</ActionButton>
        </div>
      </FilterBar>

      <DataTable
        rows={visibleRows}
        columns={[
          {
            key: "select",
            header: "",
            render: (row) => (
              <input
                type="checkbox"
                checked={selectedToPost.includes(row.id)}
                onChange={(e) =>
                  setSelectedToPost((prev) => (e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id)))
                }
              />
            ),
          },
          { key: "invoiceNumber", header: "Invoice Number", sortable: true },
          { key: "client", header: "Client", render: (row) => row.client?.name || "-", sortable: true },
          { key: "month", header: "Month", render: (row) => new Date(row.month).toISOString().slice(0, 7), sortable: true },
          { key: "amount", header: "Amount", render: (row) => Number(row.amount || 0).toLocaleString(), sortable: true },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusChip label={row.status} variant={row.status === "PAID" ? "success" : "warning"} />,
          },
          { key: "dueDate", header: "Due Date", render: (row) => (row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : "-") },
        ]}
        getRowKey={(row) => row.id}
        emptyText="No invoice records found."
        searchable={false}
      />
    </div>
  )
}
