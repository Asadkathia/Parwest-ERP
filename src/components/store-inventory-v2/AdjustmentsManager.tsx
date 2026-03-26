"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string }
type ProductScope = "NON_WEAPON" | "WEAPON_AMMO"
type AdjustmentType = "INCREASE" | "DECREASE"

type Product = {
  id: string
  sku: string
  name: string
  category?: { id: string; name: string } | null
  calibre?: { id: string; name: string } | null
  weaponType?: { id: string; name: string } | null
}

type InventoryBalance = {
  id: string
  storeId: string
  productId: string
  quantityOnHand: number
  quantityHeld: number
}

type Condition = { id: string; name: string }

type Adjustment = {
  id: string
  adjustmentType: "INCREASE" | "DECREASE" | "SET"
  reason?: string | null
  notes?: string | null
  adjustedAt: string
  store: { id: string; name: string }
  createdBy: { id: string; name: string }
  lines: Array<{
    id: string
    product: Product
    quantityBefore: number
    quantityDelta: number
    quantityAfter: number
  }>
}

const INITIAL_FORM = {
  storeId: "",
  notes: "",
  lines: [
    {
      productId: "",
      quantity: "1",
      conditionId: "",
      action: "INCREASE" as AdjustmentType,
    },
  ],
}

export default function AdjustmentsManager({
  createMode = false,
  productScope = "NON_WEAPON",
}: {
  createMode?: boolean
  productScope?: ProductScope
}) {
  const [rows, setRows] = useState<Adjustment[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [adjustmentRows, storeRows, productRows, conditionRows, inventoryRows] = await Promise.all([
        apiGet<Adjustment[]>(`/api/store-inventory/v2/adjustments?categoryScope=${productScope}`),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<Product[]>("/api/store-inventory/v2/products"),
        apiGet<Condition[]>("/api/store-inventory/v2/masters/conditions"),
        apiGet<Array<InventoryBalance & { store: { id: string }; product: { id: string } }>>(
          `/api/store-inventory/v2/inventories?includeZero=true&categoryScope=${productScope === "WEAPON_AMMO" ? "WEAPON" : "NON_WEAPON"}`
        ),
      ])
      setRows(adjustmentRows)
      setStores(storeRows)
      setConditions(conditionRows)
      setProducts(
        productRows.filter((product) => {
          const category = String(product.category?.name ?? "").toLowerCase()
          const isWeaponOrAmmo = category.includes("weapon") || category.includes("ammo")
          return productScope === "WEAPON_AMMO" ? isWeaponOrAmmo : !isWeaponOrAmmo
        })
      )
      setBalances(
        inventoryRows.map((row) => ({
          id: row.id,
          storeId: row.store?.id || row.storeId || "",
          productId: row.product?.id || row.productId || "",
          quantityOnHand: row.quantityOnHand,
          quantityHeld: row.quantityHeld,
        }))
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load adjustments."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [productScope])

  useEffect(() => {
    void load()
  }, [load])

  const stockFor = useCallback(
    (storeId: string, productId: string) => {
      if (!storeId || !productId) return { available: 0, reusable: 0 }
      const row = balances.find((entry) => entry.storeId === storeId && entry.productId === productId)
      return {
        available: row?.quantityOnHand ?? 0,
        reusable: row?.quantityHeld ?? 0,
      }
    },
    [balances]
  )

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { productId: "", quantity: "1", conditionId: "", action: "INCREASE" }],
    }))
  }

  const removeLine = (index: number) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }))
  }

  const updateLine = (index: number, field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    }))
  }

  const lineTotals = useMemo(
    () => form.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
    [form.lines]
  )

  const submit = async () => {
    const lines = form.lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
      conditionId: line.conditionId || null,
      adjustmentType: line.action,
      notes: line.conditionId ? `condition:${line.conditionId}` : null,
    }))

    if (!form.storeId || lines.some((line) => !line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
      setNotice({ type: "error", message: "Store and valid product lines are required." })
      return
    }

    const invalidDecrease = lines.find((line) => {
      if (line.adjustmentType !== "DECREASE") return false
      const stock = stockFor(form.storeId, line.productId)
      return line.quantity > stock.available
    })
    if (invalidDecrease) {
      const product = products.find((item) => item.id === invalidDecrease.productId)
      setNotice({ type: "error", message: `${product?.name || "Selected product"} exceeds available stock.` })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      await apiSend<Adjustment>("/api/store-inventory/v2/adjustments", "POST", {
        storeId: form.storeId,
        adjustmentType: "INCREASE",
        categoryScope: productScope,
        notes: form.notes.trim() || null,
        lines,
      })
      setNotice({ type: "success", message: "Adjustment applied successfully." })
      setForm(INITIAL_FORM)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create adjustment."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase().trim()
    return rows.filter((row) => `${row.store.name} ${row.adjustmentType} ${row.reason || ""}`.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <SectionTitle
        title={createMode ? (productScope === "WEAPON_AMMO" ? "Add Weapon Adjustment" : "Add Regular Adjustment") : "Adjustments"}
        subtitle={createMode ? "Staging-style wizard for stock increase/decrease by product line." : "Review historical stock adjustments."}
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Select Store *"
            value={form.storeId}
            onChange={(value) => setForm((prev) => ({ ...prev, storeId: value }))}
            options={stores}
          />
          <div />
        </div>

        <div className="space-y-4">
          <div className="font-medium text-[var(--text-muted)]">Products Table *</div>
          {form.lines.map((line, index) => {
            const selectedProduct = products.find((row) => row.id === line.productId) || null
            const stock = stockFor(form.storeId, line.productId)
            return (
              <div key={index} className="grid grid-cols-1 gap-3 border-b border-[var(--border)] pb-4 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">Select Product</label>
                  <select className="ui-select" value={line.productId} onChange={(e) => updateLine(index, "productId", e.target.value)}>
                    <option value="">Type product code and select</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ReadOnlyCell className="md:col-span-2" label="Product Code" value={selectedProduct?.sku || "—"} />
                <ReadOnlyCell className="md:col-span-1" label="Calibre" value={selectedProduct?.calibre?.name || "---"} />
                <ReadOnlyCell className="md:col-span-1" label="Weapon Type" value={selectedProduct?.weaponType?.name || "---"} />
                <ReadOnlyCell className="md:col-span-1" label="New Stock" value={String(stock.available)} />
                <ReadOnlyCell className="md:col-span-1" label="Reusable Stock" value={String(stock.reusable)} />
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">Product Quantity</label>
                  <input className="ui-input" type="number" min={1} value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
                </div>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">Condition</label>
                  <select className="ui-select" value={line.conditionId} onChange={(e) => updateLine(index, "conditionId", e.target.value)}>
                    <option value="">New</option>
                    {conditions.map((condition) => (
                      <option key={condition.id} value={condition.id}>
                        {condition.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs text-[var(--text-muted)]">Action</label>
                  <select className="ui-select" value={line.action} onChange={(e) => updateLine(index, "action", e.target.value)}>
                    <option value="INCREASE">Addition</option>
                    <option value="DECREASE">Subtraction</option>
                  </select>
                </div>
                <div className="md:col-span-1 flex items-end">
                  <button className="text-red-600 hover:text-red-700 p-2 disabled:opacity-30" onClick={() => removeLine(index)} disabled={form.lines.length === 1}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
          <ActionButton variant="secondary" onClick={addLine}>+ Add Product</ActionButton>
          <div className="rounded border border-[var(--border)] p-2 text-sm font-medium text-[var(--text-muted)]">Total Qty {lineTotals}</div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Note</label>
          <textarea className="ui-input min-h-24" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
        </div>

        <div className="flex gap-2">
          <ActionButton onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Apply Adjustment"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => setForm(INITIAL_FORM)}>Reset</ActionButton>
        </div>
      </FilterBar>

      {!createMode ? (
        <>
          <FilterBar>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
              <input className="ui-input" placeholder="Search by store/type/reason" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </FilterBar>

          <DataTable
            rows={visible}
            rowKey="id"
            searchable={false}
            emptyText={loading ? "Loading adjustments..." : "No adjustments found."}
            columns={[
              { key: "store", header: "Store", render: (row) => row.store.name },
              { key: "adjustmentType", header: "Type", sortable: true },
              { key: "lineCount", header: "Lines", render: (row) => row.lines.length },
              { key: "delta", header: "Total Delta", render: (row) => row.lines.reduce((sum, line) => sum + line.quantityDelta, 0) },
              { key: "reason", header: "Reason", render: (row) => row.reason || "—" },
              { key: "createdBy", header: "By", render: (row) => row.createdBy?.name || "—" },
              { key: "adjustedAt", header: "Date", render: (row) => new Date(row.adjustedAt).toLocaleDateString("en-US") },
            ]}
          />
        </>
      ) : null}
    </div>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Option[] }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function ReadOnlyCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" value={value} readOnly />
    </div>
  )
}
