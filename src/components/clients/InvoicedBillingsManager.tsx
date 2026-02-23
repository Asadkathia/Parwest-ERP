"use client"

import { type ReactNode, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import FilterBar from "@/components/ui/filter-bar"
import SectionTitle from "@/components/ui/section-title"
import DataTable from "@/components/shared/DataTable"
import StatusChip from "@/components/ui/status-chip"
import InlineAlert from "@/components/ui/inline-alert"

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

const CLIENT_OPTIONS = [
  "National Bank of Pakistan",
  "Standard Chartered Bank Limited Pakistan",
  "United Bank Limited",
  "MCB Bank Ltd",
  "Meezan Bank Limited",
]

const BRANCH_OPTIONS = [
  "NBP Head Office",
  "NBP Jail Road",
  "Meezan Bank Tanner Cotton",
  "Bhatti e Wali Model Town",
  "MCB Gulberg",
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
  const [entries, setEntries] = useState("10")
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState("")
  const [selectedToPost, setSelectedToPost] = useState<string[]>([])
  const [confirmPostOpen, setConfirmPostOpen] = useState(false)
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")

  const filteredInvoices = useMemo(() => {
    return invoiceRows.filter((row) => {
      if (client && !row.client.toLowerCase().includes(client.toLowerCase())) return false
      if (branch && !row.branch.toLowerCase().includes(branch.toLowerCase())) return false
      if (invoiceMonth && row.month !== invoiceMonth) return false
      if (invoiceStatus && row.status.toLowerCase() !== invoiceStatus.toLowerCase()) return false
      if (invoicesFrom && new Date(row.month + "-01") < new Date(invoicesFrom)) return false
      if (invoicesTo && new Date(row.month + "-01") > new Date(invoicesTo)) return false
      if (search && !`${row.invoiceNumber} ${row.client} ${row.branch}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [client, branch, invoiceMonth, invoiceStatus, invoicesFrom, invoicesTo, search])

  const filteredErrors = useMemo(() => {
    return errorRows.filter((row) => {
      if (client && !row.client.toLowerCase().includes(client.toLowerCase())) return false
      if (branch && !row.branch.toLowerCase().includes(branch.toLowerCase())) return false
      if (invoiceMonth && !row.month.toLowerCase().includes(invoiceMonth.slice(0, 4))) return false
      if (search && !`${row.client} ${row.branch} ${row.reason}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [client, branch, invoiceMonth, search])

  const clearFilters = () => {
    setClient("")
    setBranch("")
    setInvoiceMonth("")
    setInvoicesFrom("")
    setInvoicesTo("")
    setInvoiceDueDate("")
    setInvoiceStatus("")
    setEntries("10")
    setSearch("")
    setSelectedToPost([])
    setNotice("Filters cleared.")
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
            <select value={client} onChange={(e) => setClient(e.target.value)} className="ui-select">
              <option value="">--Select Client--</option>
              {CLIENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Select Branch</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="ui-select">
              <option value="">--Select Branch--</option>
              {BRANCH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Show 102550100200 entries</label>
            <select value={entries} onChange={(e) => setEntries(e.target.value)} className="ui-select">
              {["10", "25", "50", "100", "200"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Search:</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input" placeholder="Search:" />
          </div>
          <div className="flex items-end">
            <ActionButton variant="secondary" onClick={() => setPaymentModalOpen(true)}>Add Payment</ActionButton>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => setNotice("Search applied.")}>Search</ActionButton>
          <ActionButton variant="secondary" onClick={clearFilters}>Clear</ActionButton>
          {activeTab === "Invoiced Billings" ? (
            <ActionButton variant="secondary" onClick={() => setConfirmPostOpen(true)}>
              Post
            </ActionButton>
          ) : null}
        </div>
      </FilterBar>
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      {activeTab === "Invoiced Billings" ? (
        <DataTable
          rows={filteredInvoices.slice(0, Number.parseInt(entries, 10) || 10)}
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
            {
              key: "view",
              header: "View",
              render: () => (
                <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => setNotice("View invoice opened.")}>
                  View
                </button>
              ),
            },
            {
              key: "download",
              header: "Download",
              render: () => (
                <button type="button" className="text-emerald-700 hover:underline" onClick={() => setNotice("Invoice download simulated.")}>
                  Download
                </button>
              ),
            },
            {
              key: "action",
              header: "Action",
              render: () => (
                <button type="button" className="text-emerald-700 hover:underline" onClick={() => setConfirmUpdateOpen(true)}>
                  Update
                </button>
              ),
            },
          ]}
          getRowKey={(row) => row.id}
          emptyText="No invoice records found."
          searchable={false}
          stickyHeader
        />
      ) : (
        <DataTable
          rows={filteredErrors.slice(0, Number.parseInt(entries, 10) || 10)}
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

      {confirmPostOpen ? (
        <ConfirmDialog
          title="Post Invoices"
          message={`Are you sure you want to post ${selectedToPost.length} selected invoice(s)?`}
          yesLabel="Yes"
          noLabel="No"
          onNo={() => setConfirmPostOpen(false)}
          onYes={() => {
            setNotice(`Post action simulated for ${selectedToPost.length} invoice(s).`)
            setConfirmPostOpen(false)
          }}
        />
      ) : null}

      {confirmUpdateOpen ? (
        <ConfirmDialog
          title="Update Invoice"
          message="Apply update to selected invoice?"
          yesLabel="Yes"
          noLabel="No"
          onNo={() => setConfirmUpdateOpen(false)}
          onYes={() => {
            setNotice("Update action applied.")
            setConfirmUpdateOpen(false)
          }}
        />
      ) : null}

      {paymentModalOpen ? (
        <FormDialog title="Add Payment" onClose={() => setPaymentModalOpen(false)}>
          <div className="space-y-3">
            <label className="block text-sm text-[var(--text-muted)]">Amount</label>
            <input
              type="number"
              className="ui-input"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Payment amount"
            />
            <div className="flex justify-end gap-2">
              <ActionButton variant="secondary" onClick={() => setPaymentModalOpen(false)}>
                CLOSE
              </ActionButton>
              <ActionButton
                onClick={() => {
                  setNotice(`Payment submitted (${paymentAmount || "0"}).`)
                  setPaymentModalOpen(false)
                  setPaymentAmount("")
                }}
              >
                SUBMIT
              </ActionButton>
            </div>
          </div>
        </FormDialog>
      ) : null}
    </div>
  )
}

function ConfirmDialog({
  title,
  message,
  onYes,
  onNo,
  yesLabel,
  noLabel,
}: {
  title: string
  message: string
  onYes: () => void
  onNo: () => void
  yesLabel: string
  noLabel: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
        <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <ActionButton variant="secondary" onClick={onNo}>
            {noLabel}
          </ActionButton>
          <ActionButton onClick={onYes}>{yesLabel}</ActionButton>
        </div>
      </div>
    </div>
  )
}

function FormDialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
