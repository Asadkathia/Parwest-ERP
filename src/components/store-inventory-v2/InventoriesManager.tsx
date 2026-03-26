"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string }
type InventoryCategoryScope = "NON_WEAPON" | "WEAPON" | "AMMO"

type Row = {
  id: string
  quantityOnHand: number
  quantityHeld: number
  quantityIssued: number
  avgUnitCost?: number | null
  updatedAt: string
  store: { id: string; name: string }
  product: {
    id: string
    sku: string
    name: string
    variation?: { id: string; name: string } | null
    category?: { id: string; name: string } | null
  }
}

export default function InventoriesManager({ categoryScope = "NON_WEAPON" }: { categoryScope?: InventoryCategoryScope }) {
  const [rows, setRows] = useState<Row[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Option[]>([])
  const [variants, setVariants] = useState<Option[]>([])
  const [storeId, setStoreId] = useState("")
  const [productId, setProductId] = useState("")
  const [variantId, setVariantId] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const params = new URLSearchParams()
      if (storeId) params.set("storeId", storeId)
      if (productId) params.set("productId", productId)
      if (variantId) params.set("variationId", variantId)
      if (query.trim()) params.set("search", query.trim())
      params.set("categoryScope", categoryScope)

      params.set("includeZero", "true")

      const [data, storeRows, productRows] = await Promise.all([
        apiGet<Row[]>(`/api/store-inventory/v2/inventories?${params.toString()}`),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<
          Array<{
            id: string
            sku: string
            name: string
            category?: { id: string; name: string } | null
            variation?: { id: string; name: string } | null
          }>
        >("/api/store-inventory/v2/products"),
      ])
      setRows(data)
      setStores(storeRows)
      const filteredProducts = productRows.filter((row) => {
        const category = String(row.category?.name ?? "").toLowerCase()
        if (categoryScope === "WEAPON") return category.includes("weapon")
        if (categoryScope === "AMMO") return category.includes("ammo")
        return !category.includes("weapon") && !category.includes("ammo")
      })
      setProducts(filteredProducts.map((row) => ({ id: row.id, name: `${row.sku} - ${row.name}` })))

      const uniqueVariants = new Map<string, string>()
      for (const row of filteredProducts) {
        if (row.variation?.id && row.variation?.name) uniqueVariants.set(row.variation.id, row.variation.name)
      }
      setVariants(Array.from(uniqueVariants.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load balances."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [categoryScope, productId, query, storeId, variantId])

  useEffect(() => {
    void load()
  }, [load])
  
  const visible = useMemo(() => rows, [rows])

  const clearFilters = () => {
    setStoreId("")
    setProductId("")
    setVariantId("")
    setQuery("")
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={categoryScope === "WEAPON" ? "Weapon Inventories" : categoryScope === "AMMO" ? "Ammo Inventories" : "Inventories"}
        subtitle="Store-wise quantity view for available/reusable/issued stock."
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Store</label>
            <select className="ui-select" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Select Store</option>
              {stores.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Product</label>
            <select className="ui-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select Product</option>
              {products.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Product Variant</label>
            <select className="ui-select" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Select Variant</option>
              {variants.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
            <input className="ui-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product/store" />
          </div>
        </div>
        <div className="mt-4">
          <button className="ui-btn ui-btn-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </FilterBar>

      <DataTable
        rows={visible}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading inventory balances..." : "No inventory balances found."}
        columns={[
          { key: "store", header: "Store", render: (row) => row.store.name, sortable: true },
          { key: "product", header: "Product", render: (row) => `${row.product.name}`, sortable: true },
          { key: "variant", header: "Product Variant", render: (row) => row.product.variation?.name || "—" },
          { key: "category", header: "Category", render: (row) => row.product.category?.name || "—" },
          { key: "quantityOnHand", header: "Available Qty", sortable: true },
          { key: "quantityHeld", header: "Reusable Qty", sortable: true },
          { key: "quantityIssued", header: "Assigned Qty", sortable: true },
          {
            key: "totalQty",
            header: "Total Qty",
            render: (row) => row.quantityOnHand + row.quantityHeld + row.quantityIssued,
          },
          { key: "avgUnitCost", header: "Avg Cost", render: (row) => (row.avgUnitCost == null ? "—" : row.avgUnitCost.toFixed(2)) },
          { key: "updatedAt", header: "Updated", render: (row) => new Date(row.updatedAt).toLocaleDateString("en-US") },
        ]}
      />
    </div>
  )
}
