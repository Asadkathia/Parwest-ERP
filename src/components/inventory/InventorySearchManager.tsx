"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"

type Option = { id: string; name: string }
type ItemRow = {
  id: string
  uniqueNumber: string
  serialNumber: string | null
  status: string
  quantity: number
  category: { id: string; name: string }
  vendor: { id: string; name: string } | null
  createdAt: string
}

export default function InventorySearchManager() {
  const [rows, setRows] = useState<ItemRow[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    categoryId: "",
    vendorId: "",
  })

  useEffect(() => {
    fetch("/api/inventory/categories").then((r) => r.json()).then((d) => setCategories(d || [])).catch(() => null)
    fetch("/api/inventory/vendors").then((r) => r.json()).then((d) => setVendors(d || [])).catch(() => null)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.search) params.set("search", filters.search)
    if (filters.status) params.set("status", filters.status)
    if (filters.categoryId) params.set("categoryId", filters.categoryId)
    if (filters.vendorId) params.set("vendorId", filters.vendorId)
    fetch(`/api/inventory/items?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setRows(d || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [filters.categoryId, filters.search, filters.status, filters.vendorId])

  return (
    <div className="space-y-6">
      <SectionTitle title="Search Inventory" subtitle="Backend-connected inventory search and filters." />

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="ui-input" placeholder="Search by unique/serial/order" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
          <select className="ui-select" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
            <option value="">All status</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="ISSUED">ISSUED</option>
            <option value="CONDEMNED">CONDEMNED</option>
          </select>
          <select className="ui-select" value={filters.categoryId} onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="ui-select" value={filters.vendorId} onChange={(e) => setFilters((p) => ({ ...p, vendorId: e.target.value }))}>
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[980px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Unique #</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Serial #</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Category</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Vendor</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Qty</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No records found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 text-sm">{row.uniqueNumber}</td>
                  <td className="px-4 py-3 text-sm">{row.serialNumber || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.category?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.vendor?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{row.status}</td>
                  <td className="px-4 py-3 text-sm">{row.quantity}</td>
                  <td className="px-4 py-3 text-sm">{new Date(row.createdAt).toLocaleDateString("en-US")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
