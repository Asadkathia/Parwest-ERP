"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string }

type PurchaseLine = { id: string; quantity: number; unitCost?: number | null; product: { id: string; name: string; sku: string } }
type Purchase = {
  id: string
  referenceNo?: string | null
  invoiceNo?: string | null
  attachmentUrl?: string | null
  supplierName?: string | null
  vendor?: Option | null
  status: string
  purchasedAt: string
  store: { id: string; name: string }
  lines: PurchaseLine[]
  createdBy: { id: string; name: string }
}

const INITIAL_FORM = {
  storeId: "",
  referenceNo: "",
  invoiceNo: "",
  attachmentUrl: "",
  supplierName: "",
  vendorId: "",
  purchasedAt: new Date().toISOString().split("T")[0],
  lines: [{ productId: "", quantity: "1", unitCost: "", notes: "" }],
}

export default function PurchasesManager({ createMode = false }: { createMode?: boolean }) {
  const [rows, setRows] = useState<Purchase[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string }>>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [purchaseRows, storeRows, productRows, vendorRows] = await Promise.all([
        apiGet<Purchase[]>("/api/store-inventory/v2/purchases"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<Array<{ id: string; name: string; sku: string }>>("/api/store-inventory/v2/products"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/vendors"),
      ])
      setRows(purchaseRows)
      setStores(storeRows)
      setProducts(productRows)
      setVendors(vendorRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load purchases."
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
    const lines = form.lines.map((l) => ({
      productId: l.productId,
      quantity: Number(l.quantity),
      unitCost: l.unitCost.trim() ? Number(l.unitCost) : null,
      notes: l.notes.trim() || null,
    }))

    if (!form.storeId || lines.some((l) => !l.productId || !Number.isFinite(l.quantity) || l.quantity <= 0)) {
      setNotice({ type: "error", message: "Store and valid products/quantities are required." })
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      await apiSend<Purchase>("/api/store-inventory/v2/purchases", "POST", {
        storeId: form.storeId,
        referenceNo: form.referenceNo.trim() || null,
        invoiceNo: form.invoiceNo.trim() || null,
        attachmentUrl: form.attachmentUrl.trim() || null,
        supplierName: form.supplierName.trim() || null,
        vendorId: form.vendorId || null,
        purchasedAt: form.purchasedAt,
        status: "RECEIVED",
        lines,
      })

      setNotice({ type: "success", message: "Purchase created successfully." })
      setForm(INITIAL_FORM)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create purchase."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { productId: "", quantity: "1", unitCost: "", notes: "" }],
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
      lines: prev.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }))
  }

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase().trim()
    return rows.filter((row) => {
      const productNames = row.lines.map((line) => line.product.name).join(" ")
      return `${row.referenceNo || ""} ${row.store.name} ${row.supplierName || ""} ${productNames}`.toLowerCase().includes(q)
    })
  }, [rows, search])

  return (
    <div className="space-y-6">
      <SectionTitle
        title={createMode ? "Create Purchase" : "Purchases"}
        subtitle={createMode ? "Create purchase entries and mutate stock transactionally." : "View purchase history and received stock entries."}
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FieldSelect label="Store *" value={form.storeId} onChange={(value) => setForm((prev) => ({ ...prev, storeId: value }))} options={stores} />
          <FieldSelect label="Vendor" value={form.vendorId} onChange={(value) => setForm((prev) => ({ ...prev, vendorId: value }))} options={vendors} />
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Purchase Date</label>
            <input className="ui-input" type="date" value={form.purchasedAt} onChange={(e) => setForm((prev) => ({ ...prev, purchasedAt: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Supplier Name</label>
            <input className="ui-input" value={form.supplierName} onChange={(e) => setForm((prev) => ({ ...prev, supplierName: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Reference No</label>
            <input className="ui-input" value={form.referenceNo} onChange={(e) => setForm((prev) => ({ ...prev, referenceNo: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Invoice No</label>
            <input className="ui-input" value={form.invoiceNo} onChange={(e) => setForm((prev) => ({ ...prev, invoiceNo: e.target.value }))} />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Attachment URL</label>
            <input className="ui-input" value={form.attachmentUrl} onChange={(e) => setForm((prev) => ({ ...prev, attachmentUrl: e.target.value }))} placeholder="Link to document" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="font-medium text-[var(--text-muted)]">Items</div>
          {form.lines.map((line, index) => (
            <div key={index} className="grid grid-cols-1 gap-4 items-end border-b border-[var(--border)] pb-4 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Product *</label>
                <select className="ui-select" value={line.productId} onChange={(e) => updateLine(index, "productId", e.target.value)}>
                  <option value="">Select product</option>
                  {products.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.sku} - {row.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Quantity *</label>
                <input className="ui-input" type="number" min={1} value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Unit Cost</label>
                <input className="ui-input" type="number" min={0} value={line.unitCost} onChange={(e) => updateLine(index, "unitCost", e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Notes</label>
                <input className="ui-input" value={line.notes} onChange={(e) => updateLine(index, "notes", e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <button
                  className="text-red-600 hover:text-red-700 p-2 disabled:opacity-30"
                  onClick={() => removeLine(index)}
                  disabled={form.lines.length === 1}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <ActionButton variant="secondary" onClick={addLine}>+ Add Item</ActionButton>
        </div>

        <div className="flex gap-2 pt-4">
          <ActionButton onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Create Purchase"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => setForm(INITIAL_FORM)}>Reset</ActionButton>
        </div>
      </FilterBar>

      {!createMode ? (
        <>
          <FilterBar>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
              <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ref/store/supplier/product" />
            </div>
          </FilterBar>

          <DataTable
            rows={visible}
            rowKey="id"
            searchable={false}
            emptyText={loading ? "Loading purchases..." : "No purchases found."}
            columns={[
               { key: "referenceNo", header: "Reference", render: (row) => row.referenceNo || row.id.slice(0, 8) },
               { key: "invoiceNo", header: "Invoice", render: (row) => row.invoiceNo || "—" },
               { key: "store", header: "Store", render: (row) => row.store.name, sortable: true },
               { key: "vendor", header: "Vendor", render: (row) => row.vendor?.name || row.supplierName || "—" },
               { key: "lineCount", header: "Lines", render: (row) => row.lines.length },
              { key: "totalQty", header: "Total Qty", render: (row) => row.lines.reduce((sum, line) => sum + line.quantity, 0) },
              { key: "status", header: "Status", sortable: true },
              { key: "createdBy", header: "Created By", render: (row) => row.createdBy?.name || "—" },
              { key: "purchasedAt", header: "Date", render: (row) => new Date(row.purchasedAt).toLocaleDateString("en-US") },
            ]}
          />
        </>
      ) : null}
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Option[] }) {
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
