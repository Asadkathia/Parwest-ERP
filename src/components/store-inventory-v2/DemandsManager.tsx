"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string; type?: string | null }
type Product = { id: string; sku: string; name: string }
type DemandLine = { id: string; product: Product; requestedQty: number; approvedQty?: number | null; fulfilledQty: number }
type Demand = {
  id: string
  requestNo?: string | null
  status: string
  fromStore?: Option | null
  toStore?: Option | null
  requestedBy?: { id: string; name: string } | null
  createdAt: string
  lines: DemandLine[]
  responses: Array<{ id: string; status: string; responderStore: Option; lines: Array<{ id: string; quantity: number }> }>
}

const INITIAL_FORM = {
  fromStoreId: "",
  toStoreId: "",
  reason: "",
  lines: [{ productId: "", requestedQty: "1" }],
}

export default function DemandsManager({ responseMode = false }: { responseMode?: boolean }) {
  const [rows, setRows] = useState<Demand[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const isWarehouse = (store: Option) => String(store.type ?? "").trim().toUpperCase() === "WAREHOUSE"
  const isStore = (store: Option) => !isWarehouse(store)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [demandRows, storeRows, productRows] = await Promise.all([
        apiGet<Demand[]>("/api/store-inventory/v2/demands"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<Product[]>("/api/store-inventory/v2/products"),
      ])
      setRows(demandRows)
      setStores(storeRows)
      setProducts(productRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load demands."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submitDemand = async () => {
    const lines = form.lines.map((l) => ({
      productId: l.productId,
      requestedQty: Number(l.requestedQty),
    }))

    if (lines.some((l) => !l.productId || !Number.isFinite(l.requestedQty) || l.requestedQty <= 0)) {
      setNotice({ type: "error", message: "Valid products and positive quantities are required." })
      return
    }

    if (!form.fromStoreId || !form.toStoreId) {
      setNotice({ type: "error", message: "From Store and To Warehouse are required." })
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      await apiSend<Demand>("/api/store-inventory/v2/demands", "POST", {
        fromStoreId: form.fromStoreId || null,
        toStoreId: form.toStoreId || null,
        reason: form.reason.trim() || null,
        status: "SENT",
        lines,
      })

      setNotice({ type: "success", message: "Demand created successfully." })
      setForm(INITIAL_FORM)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create demand."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { productId: "", requestedQty: "1" }],
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

  const updateDemandStatus = async (demandId: string, status: string) => {
    try {
      await apiSend<Demand>(`/api/store-inventory/v2/demands/${demandId}`, "PATCH", { status })
      setNotice({ type: "success", message: `Demand marked ${status}.` })
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update demand status."
      setNotice({ type: "error", message })
    }
  }

  const respondDemand = async (demand: Demand) => {
    const firstLine = demand.lines[0]
    if (!firstLine) {
      setNotice({ type: "error", message: "Demand has no line items." })
      return
    }

    const responderStoreId = demand.fromStore?.id || demand.toStore?.id
    if (!responderStoreId) {
      setNotice({ type: "error", message: "Cannot infer responder store from demand." })
      return
    }

    const qty = Math.max(1, firstLine.requestedQty - firstLine.fulfilledQty)

    try {
      await apiSend(`/api/store-inventory/v2/demands/${demand.id}/responses`, "POST", {
        responderStoreId,
        status: "APPROVED",
        lines: [
          {
            demandLineId: firstLine.id,
            productId: firstLine.product.id,
            quantity: qty,
          },
        ],
      })
      setNotice({ type: "success", message: "Demand response submitted and stock adjusted." })
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit demand response."
      setNotice({ type: "error", message })
    }
  }

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase().trim()
    return rows.filter((row) => `${row.requestNo || ""} ${row.status} ${row.fromStore?.name || ""} ${row.toStore?.name || ""}`.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <SectionTitle
        title={responseMode ? "Demands Response" : "Demands Send"}
        subtitle={responseMode ? "Approve and fulfill demand responses with stock validations." : "Create store demand requests and track lifecycle transitions."}
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      {!responseMode ? (
        <FilterBar className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select
              label="From Store *"
              value={form.fromStoreId}
              onChange={(value) => setForm((prev) => ({ ...prev, fromStoreId: value }))}
              options={stores.filter(isStore)}
            />
            <Select
              label="To Warehouse *"
              value={form.toStoreId}
              onChange={(value) => setForm((prev) => ({ ...prev, toStoreId: value }))}
              options={stores.filter(isWarehouse)}
            />
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Reason</label>
              <input className="ui-input" value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-4 font-medium text-[var(--text-muted)]">Items</div>
          {form.lines.map((line, index) => (
            <div key={index} className="grid grid-cols-1 gap-4 items-end border-b border-[var(--border)] pb-4 md:grid-cols-12">
              <div className="md:col-span-6">
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
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Requested Qty *</label>
                <input className="ui-input" type="number" min={1} value={line.requestedQty} onChange={(e) => updateLine(index, "requestedQty", e.target.value)} />
              </div>
              <div className="md:col-span-2">
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

          <div className="flex gap-2">
            <ActionButton onClick={() => void submitDemand()} disabled={saving}>{saving ? "Saving..." : "Create Demand"}</ActionButton>
            <ActionButton variant="secondary" onClick={() => setForm(INITIAL_FORM)}>Reset</ActionButton>
          </div>
        </FilterBar>
      ) : null}

      <FilterBar>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
          <input className="ui-input" placeholder="Search by status/store/request" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </FilterBar>

      <DataTable
        rows={visible}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading demands..." : "No demands found."}
        columns={[
          { key: "requestNo", header: "Request", render: (row) => row.requestNo || row.id.slice(0, 8) },
          { key: "fromStore", header: "From", render: (row) => row.fromStore?.name || "—" },
          { key: "toStore", header: "To", render: (row) => row.toStore?.name || "—" },
          { key: "lineCount", header: "Lines", render: (row) => row.lines.length },
          { key: "requestedQty", header: "Requested", render: (row) => row.lines.reduce((sum, line) => sum + line.requestedQty, 0) },
          { key: "fulfilledQty", header: "Fulfilled", render: (row) => row.lines.reduce((sum, line) => sum + line.fulfilledQty, 0) },
          { key: "status", header: "Status", sortable: true },
          { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleDateString("en-US") },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {!responseMode ? (
                  <>
                    {row.status === "SENT" ? (
                      <button className="text-[var(--brand)] hover:underline" onClick={() => void updateDemandStatus(row.id, "APPROVED")}>
                        Approve
                      </button>
                    ) : null}
                    {(row.status === "APPROVED" || row.status === "PARTIALLY_FULFILLED") && row.lines.some((line) => line.fulfilledQty < line.requestedQty) ? (
                      <button className="text-[var(--brand)] hover:underline" onClick={() => void respondDemand(row)}>
                        Fulfill
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button className="text-[var(--brand)] hover:underline" onClick={() => void respondDemand(row)}>
                    Respond
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  allowEmpty = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  allowEmpty?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allowEmpty ? "Optional" : "Select"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}
