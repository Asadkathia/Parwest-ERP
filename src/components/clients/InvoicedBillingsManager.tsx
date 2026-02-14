"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"

type InvoiceRow = {
  id: string
  invoiceNumber: string
  client: string
  branch: string
  total: number
  paid: number
  balance: number
  status: "Pending" | "Posted"
  month: string
}

type ErrorInvoiceRow = {
  id: string
  client: string
  branch: string
  reason: string
  month: string
}

const invoiceRows: InvoiceRow[] = [
  { id: "1", invoiceNumber: "INV-6368", client: "Bhatti e Wali Model Town", branch: "Bhatti e Wali Model Town", total: 35000, paid: 0, balance: 35000, status: "Pending", month: "2026-02" },
  { id: "2", invoiceNumber: "INV-6364", client: "Meezan Bank Limited", branch: "Meezan Bank Tanner Cotton", total: 177480, paid: 0, balance: 177480, status: "Posted", month: "2026-02" },
]

const errorRows: ErrorInvoiceRow[] = [
  { id: "1", client: "National Bank of Pakistan", branch: "NBP Head Office", reason: "No active guards detail detected against the branch!", month: "Jul 2022" },
  { id: "2", client: "National Bank of Pakistan", branch: "NBP Jail Road", reason: "No active guards detail detected against the branch!", month: "Jul 2022" },
]

export default function InvoicedBillingsManager() {
  const [activeTab, setActiveTab] = useState<"Invoiced Billings" | "Error Invoices">("Invoiced Billings")
  const [client, setClient] = useState("")
  const [branch, setBranch] = useState("")
  const [invoiceMonth, setInvoiceMonth] = useState("")
  const [invoicesFrom, setInvoicesFrom] = useState("")
  const [invoicesTo, setInvoicesTo] = useState("")
  const [invoiceDueDate, setInvoiceDueDate] = useState("")
  const [invoiceStatus, setInvoiceStatus] = useState("")

  const filteredInvoices = useMemo(() => {
    return invoiceRows.filter((row) => {
      if (client && !row.client.toLowerCase().includes(client.toLowerCase())) return false
      if (branch && !row.branch.toLowerCase().includes(branch.toLowerCase())) return false
      if (invoiceMonth && row.month !== invoiceMonth) return false
      if (invoiceStatus && row.status.toLowerCase() !== invoiceStatus.toLowerCase()) return false
      if (invoicesFrom && new Date(row.month + "-01") < new Date(invoicesFrom)) return false
      if (invoicesTo && new Date(row.month + "-01") > new Date(invoicesTo)) return false
      return true
    })
  }, [client, branch, invoiceMonth, invoiceStatus, invoicesFrom, invoicesTo])

  const filteredErrors = useMemo(() => {
    return errorRows.filter((row) => {
      if (client && !row.client.toLowerCase().includes(client.toLowerCase())) return false
      if (branch && !row.branch.toLowerCase().includes(branch.toLowerCase())) return false
      if (invoiceMonth && !row.month.toLowerCase().includes(invoiceMonth.slice(0, 4))) return false
      return true
    })
  }, [client, branch, invoiceMonth])

  const clearFilters = () => {
    setClient("")
    setBranch("")
    setInvoiceMonth("")
    setInvoicesFrom("")
    setInvoicesTo("")
    setInvoiceDueDate("")
    setInvoiceStatus("")
  }

  const tabClass = (tab: "Invoiced Billings" | "Error Invoices") =>
    `px-3 py-1.5 text-sm rounded-full border transition ${
      activeTab === tab
        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
        : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]"
    }`

  return (
    <div className="space-y-6">
      <SectionTitle title="Invoiced Billings" subtitle="Invoice billing management with error invoice tracking." />

      <FilterBar className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab("Invoiced Billings")} className={tabClass("Invoiced Billings")}>Invoiced Billings</button>
          <button type="button" onClick={() => setActiveTab("Error Invoices")} className={tabClass("Error Invoices")}>Error Invoices</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Client</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} className="ui-input" placeholder="--Select Client--" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Branch</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} className="ui-input" placeholder="--Select Branch--" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Invoice Month</label>
            <input type="month" value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)} className="ui-input" />
          </div>

          {activeTab === "Invoiced Billings" ? (
            <>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Invoices From</label>
                <input type="date" value={invoicesFrom} onChange={(e) => setInvoicesFrom(e.target.value)} className="ui-input" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Invoices To</label>
                <input type="date" value={invoicesTo} onChange={(e) => setInvoicesTo(e.target.value)} className="ui-input" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Invoice Due Date</label>
                <input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} className="ui-input" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Select Invoice Status</label>
                <select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className="ui-select">
                  <option value="">--Select Invoice Status--</option>
                  <option value="Pending">Pending</option>
                  <option value="Posted">Posted</option>
                </select>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton>SEARCH</ActionButton>
          <ActionButton variant="secondary" onClick={clearFilters}>Clear</ActionButton>
        </div>
      </FilterBar>

      {activeTab === "Invoiced Billings" ? (
        <DataTable
          rows={filteredInvoices}
          columns={[
            { key: "invoiceNumber", header: "Invoice Number", sortable: true },
            { key: "client", header: "Client", sortable: true },
            { key: "branch", header: "Branch", sortable: true },
            { key: "total", header: "Total", render: (row) => row.total.toLocaleString(), sortable: true },
            { key: "paid", header: "Paid", render: (row) => row.paid.toLocaleString(), sortable: true },
            { key: "balance", header: "Balance", render: (row) => row.balance.toLocaleString(), sortable: true },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusChip label={row.status} variant={row.status === "Posted" ? "success" : "warning"} />,
            },
            { key: "view", header: "View", render: () => <span className="text-[var(--brand)]">View</span> },
            { key: "download", header: "Download", render: () => <span className="text-emerald-700">Download</span> },
            { key: "action", header: "Action", render: () => <span className="text-emerald-700">Edit</span> },
          ]}
          getRowKey={(row) => row.id}
          emptyText="No invoice records found."
          searchable={false}
          stickyHeader
        />
      ) : (
        <DataTable
          rows={filteredErrors}
          columns={[
            { key: "client", header: "Client", sortable: true },
            { key: "branch", header: "Branch", sortable: true },
            { key: "reason", header: "Reason" },
            { key: "month", header: "Month", sortable: true },
          ]}
          getRowKey={(row) => row.id}
          emptyText="No error invoices found."
          searchable={false}
          stickyHeader
        />
      )}
    </div>
  )
}
