"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet } from "@/components/store-inventory-v2/api"

type Row = {
  id: string
  quantityOnHand: number
  quantityHeld: number
  quantityIssued: number
  avgUnitCost?: number | null
  updatedAt: string
  store: { id: string; name: string }
  product: { id: string; sku: string; name: string }
}

export default function InventoriesManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const data = await apiGet<Row[]>("/api/store-inventory/v2/inventories")
      setRows(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load balances."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase().trim()
    return rows.filter((row) => `${row.store.name} ${row.product.sku} ${row.product.name}`.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <div className="space-y-6">
      <SectionTitle title="Inventories" subtitle="Live v2 inventory balances per store/product." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
          <input className="ui-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by store/product" />
        </div>
      </FilterBar>

      <DataTable
        rows={visible}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading inventory balances..." : "No inventory balances found."}
        columns={[
          { key: "store", header: "Store", render: (row) => row.store.name, sortable: true },
          { key: "product", header: "Product", render: (row) => `${row.product.sku} - ${row.product.name}`, sortable: true },
          { key: "quantityOnHand", header: "On Hand", sortable: true },
          { key: "quantityHeld", header: "Held", sortable: true },
          { key: "quantityIssued", header: "Issued", sortable: true },
          { key: "avgUnitCost", header: "Avg Cost", render: (row) => (row.avgUnitCost == null ? "—" : row.avgUnitCost.toFixed(2)) },
          { key: "updatedAt", header: "Updated", render: (row) => new Date(row.updatedAt).toLocaleDateString("en-US") },
        ]}
      />
    </div>
  )
}
