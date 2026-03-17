"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string }
type Product = { id: string; sku: string; name: string }

type Adjustment = {
  id: string
  adjustmentType: "INCREASE" | "DECREASE" | "SET"
  reason?: string | null
  notes?: string | null
  adjustedAt: string
  store: { id: string; name: string }
  createdBy: { id: string; name: string }
  lines: Array<{ id: string; product: Product; quantityBefore: number; quantityDelta: number; quantityAfter: number }>
}

const INITIAL_FORM = {
  storeId: "",
  productId: "",
  quantity: "1",
  adjustmentType: "INCREASE",
  reason: "",
}

export default function AdjustmentsManager({ createMode = false }: { createMode?: boolean }) {
  const [rows, setRows] = useState<Adjustment[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [adjustmentRows, storeRows, productRows] = await Promise.all([
        apiGet<Adjustment[]>("/api/store-inventory/v2/adjustments"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<Product[]>("/api/store-inventory/v2/products"),
      ])
      setRows(adjustmentRows)
      setStores(storeRows)
      setProducts(productRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load adjustments."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    const quantity = Number(form.quantity)
    if (!form.storeId || !form.productId || !Number.isFinite(quantity) || quantity <= 0) {
      setNotice({ type: "error", message: "Store, product and positive quantity are required." })
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      await apiSend<Adjustment>("/api/store-inventory/v2/adjustments", "POST", {
        storeId: form.storeId,
        adjustmentType: form.adjustmentType,
        reason: form.reason.trim() || null,
        lines: [{ productId: form.productId, quantity }],
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
        title={createMode ? "Create Adjustment" : "Adjustments"}
        subtitle={createMode ? "Mutate stock with increase/decrease/set transactional logic." : "Review historical stock adjustments."}
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select label="Store *" value={form.storeId} onChange={(value) => setForm((prev) => ({ ...prev, storeId: value }))} options={stores} />
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Product *</label>
            <select className="ui-select" value={form.productId} onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}>
              <option value="">Select product</option>
              {products.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.sku} - {row.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Adjustment Type *</label>
            <select
              className="ui-select"
              value={form.adjustmentType}
              onChange={(e) => setForm((prev) => ({ ...prev, adjustmentType: e.target.value }))}
            >
              <option value="INCREASE">INCREASE</option>
              <option value="DECREASE">DECREASE</option>
              <option value="SET">SET</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Quantity *</label>
            <input className="ui-input" type="number" min={1} value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Reason</label>
            <input className="ui-input" value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Create Adjustment"}</ActionButton>
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
