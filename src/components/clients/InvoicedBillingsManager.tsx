"use client"

import { useMemo, useState } from "react"

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invoiced Billings</h1>
        <p className="text-gray-600 mt-1">Invoice billing management with error invoice tracking.</p>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {["Invoiced Billings", "Error Invoices"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab as "Invoiced Billings" | "Error Invoices")}
              className={`px-3 py-1.5 text-sm rounded-full border ${activeTab === tab ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Select Client</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="--Select Client--" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Select Branch</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="--Select Branch--" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Select Invoice Month</label>
            <input type="month" value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)} className="w-full border rounded-md px-3 py-2" />
          </div>

          {activeTab === "Invoiced Billings" ? (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Select Invoices From</label>
                <input type="date" value={invoicesFrom} onChange={(e) => setInvoicesFrom(e.target.value)} className="w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Select Invoices To</label>
                <input type="date" value={invoicesTo} onChange={(e) => setInvoicesTo(e.target.value)} className="w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Invoice Due Date</label>
                <input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} className="w-full border rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Select Invoice Status</label>
                <select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} className="w-full border rounded-md px-3 py-2">
                  <option value="">--Select Invoice Status--</option>
                  <option value="Pending">Pending</option>
                  <option value="Posted">Posted</option>
                </select>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">SEARCH</button>
          <button onClick={clearFilters} className="border px-3 py-2 rounded-md text-sm hover:bg-gray-50">Clear</button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        {activeTab === "Invoiced Billings" ? (
          <table className="w-full min-w-[1100px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Invoice Number</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Client</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Branch</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Total</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Paid</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Balance</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">View</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Download</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">No invoice records found.</td></tr>
              ) : (
                filteredInvoices.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{row.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm">{row.client}</td>
                    <td className="px-4 py-3 text-sm">{row.branch}</td>
                    <td className="px-4 py-3 text-sm">{row.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{row.paid.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{row.balance.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{row.status}</td>
                    <td className="px-4 py-3 text-sm text-blue-600">View</td>
                    <td className="px-4 py-3 text-sm text-green-600">Download</td>
                    <td className="px-4 py-3 text-sm text-emerald-600">Edit</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Client</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Branch</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Reason</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-gray-600">Month</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredErrors.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No error invoices found.</td></tr>
              ) : (
                filteredErrors.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{row.client}</td>
                    <td className="px-4 py-3 text-sm">{row.branch}</td>
                    <td className="px-4 py-3 text-sm">{row.reason}</td>
                    <td className="px-4 py-3 text-sm">{row.month}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
