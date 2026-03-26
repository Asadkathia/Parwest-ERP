"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"
import { parseDemandResponseMeta, totalReceivedForMeta, type DemandResponseMeta } from "@/lib/inventory/demand-response-meta"

type Option = { id: string; name: string; type?: string | null }
type Product = { id: string; sku: string; name: string; category?: { id: string; name: string } | null }
type DemandLine = { id: string; product: Product; requestedQty: number; approvedQty?: number | null; fulfilledQty: number }
type DemandResponseRow = {
  id: string
  status: string
  respondedAt: string
  notes?: string | null
  responderStore: Option
  responder?: { id: string; name: string } | null
  lines: Array<{ id: string; demandLineId: string; productId: string; quantity: number }>
}

type Demand = {
  id: string
  requestNo?: string | null
  status: string
  reason?: string | null
  notes?: string | null
  fromStore?: Option | null
  toStore?: Option | null
  requestedBy?: { id: string; name: string } | null
  createdAt: string
  lines: DemandLine[]
  responses: DemandResponseRow[]
}

type InventoryBalance = {
  id: string
  storeId: string
  productId: string
  quantityOnHand: number
  quantityHeld: number
}

const INITIAL_FORM = {
  fromStoreId: "",
  toStoreId: "",
  reason: "",
  lines: [] as Array<{ productId: string; requestedQty: string }>,
}

type AllocateDraft = {
  demandId: string
  responseRemarks: string
  lines: Array<{
    demandLineId: string
    productId: string
    productName: string
    requestedQty: number
    fulfilledQty: number
    availableQty: number
    reusableQty: number
    newQty: string
    reusableAllocQty: string
    notes: string
  }>
}

type TransportDraft = {
  demandId: string
  responseId: string
  transportType: "SELF" | "COURIER"
  driverName: string
  driverPhone: string
  vehicleNumber: string
  courierCompany: string
  courierBy: string
  courierTrackingId: string
  courierDate: string
}

type ReceiveDraft = {
  demandId: string
  responseId: string
  receiveRemarks: string
  lines: Array<{
    demandLineId: string
    productId: string
    productName: string
    requestedQty: number
    fulfilledNewQty: number
    fulfilledReusableQty: number
    receivedNewQty: string
    receivedReusableQty: string
    remarks: string
  }>
}

function computeTotals(row: Demand): { requested: number; fulfilled: number; received: number; shortfall: number } {
  const requested = row.lines.reduce((sum, line) => sum + line.requestedQty, 0)
  const fulfilled = row.lines.reduce((sum, line) => sum + line.fulfilledQty, 0)
  const received = row.responses.reduce((sum, response) => sum + totalReceivedForMeta(parseDemandResponseMeta(response.notes)), 0)
  return {
    requested,
    fulfilled,
    received,
    shortfall: Math.max(0, requested - received),
  }
}

function latestResponse(row: Demand): DemandResponseRow | null {
  if (!row.responses?.length) return null
  return [...row.responses].sort((a, b) => new Date(b.respondedAt).getTime() - new Date(a.respondedAt).getTime())[0] || null
}

function workflowStatus(row: Demand): string {
  if (row.status === "REJECTED") return "Rejected"
  if (row.status === "CANCELLED") return "Cancelled"

  const response = latestResponse(row)
  if (!response) return "Pending"

  const meta = parseDemandResponseMeta(response.notes)
  if (meta.receive?.receivedAt) return "Completed"
  if (meta.transport) return "In Transit"
  return "Checked Out"
}

function badgeClass(status: string): string {
  const normalized = status.toUpperCase()
  if (normalized === "COMPLETED") return "bg-emerald-100 text-emerald-700"
  if (normalized === "IN TRANSIT" || normalized === "IN_TRANSIT") return "bg-sky-100 text-sky-700"
  if (normalized === "CHECKED OUT" || normalized === "CHECKED_OUT") return "bg-blue-100 text-blue-700"
  if (normalized === "PENDING") return "bg-amber-100 text-amber-700"
  if (normalized === "REJECTED") return "bg-rose-100 text-rose-700"
  return "bg-slate-100 text-slate-700"
}

export default function DemandsManager({ responseMode = false }: { responseMode?: boolean }) {
  const [rows, setRows] = useState<Demand[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [newLineProductId, setNewLineProductId] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [detailsDemandId, setDetailsDemandId] = useState<string | null>(null)

  const [allocateDraft, setAllocateDraft] = useState<AllocateDraft | null>(null)
  const [transportDraft, setTransportDraft] = useState<TransportDraft | null>(null)
  const [receiveDraft, setReceiveDraft] = useState<ReceiveDraft | null>(null)

  const isWarehouse = (store: Option) => String(store.type ?? "").trim().toUpperCase() === "WAREHOUSE"
  const isStore = (store: Option) => !isWarehouse(store)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [demandRows, storeRows, productRows, inventoryRows] = await Promise.all([
        apiGet<Demand[]>("/api/store-inventory/v2/demands"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<Product[]>("/api/store-inventory/v2/products"),
        apiGet<Array<InventoryBalance & { store: { id: string }; product: { id: string } }>>("/api/store-inventory/v2/inventories"),
      ])

      setRows(demandRows)
      setStores(storeRows)
      setProducts(productRows)
      setBalances(
        inventoryRows.map((row) => ({
          id: row.id,
          storeId: row.store?.id || (row as unknown as { storeId?: string }).storeId || "",
          productId: row.product?.id || (row as unknown as { productId?: string }).productId || "",
          quantityOnHand: row.quantityOnHand,
          quantityHeld: row.quantityHeld,
        }))
      )
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

    if (!lines.length) {
      setNotice({ type: "error", message: "Add at least one product line." })
      return
    }

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
      setNewLineProductId("")
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create demand."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const addLine = () => {
    if (!newLineProductId) {
      setNotice({ type: "error", message: "Select a product to add." })
      return
    }
    if (form.lines.some((line) => line.productId === newLineProductId)) {
      setNotice({ type: "error", message: "Selected product is already added." })
      return
    }
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { productId: newLineProductId, requestedQty: "1" }],
    }))
    setNewLineProductId("")
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

  const inventoryFor = useCallback(
    (storeId: string | undefined, productId: string) => {
      if (!storeId || !productId) return { available: 0, reusable: 0 }
      const row = balances.find((item) => item.storeId === storeId && item.productId === productId)
      return {
        available: row?.quantityOnHand ?? 0,
        reusable: row?.quantityHeld ?? 0,
      }
    },
    [balances]
  )

  const openAllocate = (demand: Demand) => {
    const warehouseId = demand.toStore?.id
    if (!warehouseId) {
      setNotice({ type: "error", message: "Warehouse is missing on demand record." })
      return
    }

    const draft: AllocateDraft = {
      demandId: demand.id,
      responseRemarks: "",
      lines: demand.lines.map((line) => {
        const stock = inventoryFor(warehouseId, line.product.id)
        return {
          demandLineId: line.id,
          productId: line.product.id,
          productName: `${line.product.sku} - ${line.product.name}`,
          requestedQty: line.requestedQty,
          fulfilledQty: line.fulfilledQty,
          availableQty: stock.available,
          reusableQty: stock.reusable,
          newQty: "0",
          reusableAllocQty: "0",
          notes: "",
        }
      }),
    }
    setAllocateDraft(draft)
    setTransportDraft(null)
    setReceiveDraft(null)
  }

  const submitAllocate = async () => {
    if (!allocateDraft) return

    const demand = rows.find((row) => row.id === allocateDraft.demandId)
    if (!demand || !demand.toStore?.id) {
      setNotice({ type: "error", message: "Demand not found for allocation." })
      return
    }

    const payloadLines = allocateDraft.lines
      .map((line) => {
        const newQty = Math.max(0, Number(line.newQty) || 0)
        const reusableQty = Math.max(0, Number(line.reusableAllocQty) || 0)
        const quantity = newQty + reusableQty
        return {
          demandLineId: line.demandLineId,
          productId: line.productId,
          requestedQty: line.requestedQty,
          fulfilledNewQty: newQty,
          fulfilledReusableQty: reusableQty,
          quantity,
          notes: line.notes.trim() || null,
        }
      })
      .filter((line) => line.quantity > 0)

    if (!payloadLines.length) {
      setNotice({ type: "error", message: "At least one allocated quantity is required." })
      return
    }

    for (const line of payloadLines) {
      const draftLine = allocateDraft.lines.find((row) => row.demandLineId === line.demandLineId)
      if (!draftLine) continue
      if (line.fulfilledNewQty > draftLine.availableQty) {
        setNotice({ type: "error", message: `${draftLine.productName}: allocated new qty exceeds available qty.` })
        return
      }
      if (line.fulfilledReusableQty > draftLine.reusableQty) {
        setNotice({ type: "error", message: `${draftLine.productName}: allocated reusable qty exceeds reusable qty.` })
        return
      }
    }

    setSaving(true)
    setNotice(null)
    try {
      await apiSend(`/api/store-inventory/v2/demands/${demand.id}/responses`, "POST", {
        responderStoreId: demand.toStore.id,
        status: "APPROVED",
        responseRemarks: allocateDraft.responseRemarks.trim() || null,
        lines: payloadLines,
      })
      setNotice({ type: "success", message: "Allocation saved. Demand is now checked out." })
      setAllocateDraft(null)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to allocate demand response."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const openTransport = (demand: Demand, response: DemandResponseRow, meta: DemandResponseMeta) => {
    setTransportDraft({
      demandId: demand.id,
      responseId: response.id,
      transportType: meta.transport?.type || "SELF",
      driverName: meta.transport?.driverName || "",
      driverPhone: meta.transport?.driverPhone || "",
      vehicleNumber: meta.transport?.vehicleNumber || "",
      courierCompany: meta.transport?.courierCompany || "",
      courierBy: meta.transport?.courierBy || "",
      courierTrackingId: meta.transport?.courierTrackingId || "",
      courierDate: meta.transport?.courierDate || "",
    })
    setAllocateDraft(null)
    setReceiveDraft(null)
  }

  const submitTransport = async () => {
    if (!transportDraft) return
    setSaving(true)
    setNotice(null)

    try {
      await apiSend(
        `/api/store-inventory/v2/demands/${transportDraft.demandId}/responses/${transportDraft.responseId}/transport`,
        "PATCH",
        {
          transportType: transportDraft.transportType,
          driverName: transportDraft.driverName,
          driverPhone: transportDraft.driverPhone,
          vehicleNumber: transportDraft.vehicleNumber,
          courierCompany: transportDraft.courierCompany,
          courierBy: transportDraft.courierBy,
          courierTrackingId: transportDraft.courierTrackingId,
          courierDate: transportDraft.courierDate,
        }
      )
      setNotice({ type: "success", message: "Transport details added. Demand is now in transit." })
      setTransportDraft(null)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add transport details."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const openReceive = (demand: Demand, response: DemandResponseRow, meta: DemandResponseMeta) => {
    setReceiveDraft({
      demandId: demand.id,
      responseId: response.id,
      receiveRemarks: meta.receive?.remarks || "",
      lines: meta.allocations.map((line) => ({
        demandLineId: line.demandLineId,
        productId: line.productId,
        productName: demand.lines.find((d) => d.id === line.demandLineId)?.product?.name || line.productId,
        requestedQty: line.requestedQty ?? demand.lines.find((d) => d.id === line.demandLineId)?.requestedQty ?? 0,
        fulfilledNewQty: line.fulfilledNewQty,
        fulfilledReusableQty: line.fulfilledReusableQty,
        receivedNewQty: String(meta.receive?.lines.find((r) => r.demandLineId === line.demandLineId)?.receivedNewQty ?? line.fulfilledNewQty),
        receivedReusableQty: String(meta.receive?.lines.find((r) => r.demandLineId === line.demandLineId)?.receivedReusableQty ?? line.fulfilledReusableQty),
        remarks: meta.receive?.lines.find((r) => r.demandLineId === line.demandLineId)?.remarks || "",
      })),
    })
    setAllocateDraft(null)
    setTransportDraft(null)
  }

  const submitReceive = async () => {
    if (!receiveDraft) return

    const payloadLines = receiveDraft.lines.map((line) => ({
      demandLineId: line.demandLineId,
      productId: line.productId,
      receivedNewQty: Math.max(0, Number(line.receivedNewQty) || 0),
      receivedReusableQty: Math.max(0, Number(line.receivedReusableQty) || 0),
      remarks: line.remarks.trim() || null,
    }))

    setSaving(true)
    setNotice(null)
    try {
      await apiSend(
        `/api/store-inventory/v2/demands/${receiveDraft.demandId}/responses/${receiveDraft.responseId}/receive`,
        "PATCH",
        {
          receiveRemarks: receiveDraft.receiveRemarks.trim() || null,
          lines: payloadLines,
        }
      )
      setNotice({ type: "success", message: "Receive confirmed. Demand lifecycle updated." })
      setReceiveDraft(null)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to confirm receive."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const rejectDemand = async (demandId: string) => {
    setSaving(true)
    setNotice(null)
    try {
      await apiSend(`/api/store-inventory/v2/demands/${demandId}`, "PATCH", { status: "REJECTED" })
      setNotice({ type: "success", message: "Demand rejected." })
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject demand."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase().trim()
    return rows.filter((row) => {
      const totals = computeTotals(row)
      return `${row.requestNo || ""} ${workflowStatus(row)} ${row.fromStore?.name || ""} ${row.toStore?.name || ""} ${row.requestedBy?.name || ""} ${totals.shortfall}`
        .toLowerCase()
        .includes(q)
    })
  }, [rows, search])

  const productById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]))
  }, [products])

  const nonWeaponProducts = useMemo(
    () =>
      products.filter((product) => {
        const category = String(product.category?.name ?? "").toLowerCase()
        return !category.includes("weapon") && !category.includes("ammo")
      }),
    [products]
  )

  const demandProductOptions = useMemo(() => {
    if (!form.toStoreId) return nonWeaponProducts
    const productIdsWithStock = new Set(
      balances
        .filter((row) => row.storeId === form.toStoreId && (row.quantityOnHand > 0 || row.quantityHeld > 0))
        .map((row) => row.productId)
    )
    const storeProducts = nonWeaponProducts.filter((product) => productIdsWithStock.has(product.id))
    return storeProducts.length ? storeProducts : nonWeaponProducts
  }, [balances, form.toStoreId, nonWeaponProducts])

  const totalRequestedQty = useMemo(
    () => form.lines.reduce((sum, line) => sum + Math.max(0, Number(line.requestedQty) || 0), 0),
    [form.lines]
  )

  const detailsDemand = useMemo(() => rows.find((row) => row.id === detailsDemandId) || null, [rows, detailsDemandId])

  return (
    <div className="space-y-6">
      <SectionTitle
        title={responseMode ? "Demands Response" : "Demands Send"}
        subtitle={
          responseMode
            ? "Respond to store requests, allocate stock, add transport, and confirm receive."
            : "Create store demand requests toward warehouse and track lifecycle."
        }
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
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Request Remarks</label>
              <input className="ui-input" value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-4 font-medium text-[var(--text-muted)]">Demand Items</div>
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
            <div className="md:col-span-10">
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Select Product</label>
              <select className="ui-select" value={newLineProductId} onChange={(e) => setNewLineProductId(e.target.value)}>
                <option value="">Select product</option>
                {demandProductOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.sku} - {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <ActionButton variant="secondary" onClick={addLine}>+ Add Product</ActionButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                  <th className="p-2">Product Name</th>
                  <th className="p-2">Product Code</th>
                  <th className="p-2">Available New Stock</th>
                  <th className="p-2">Available Reusable Stock</th>
                  <th className="p-2">Required Quantity</th>
                  <th className="p-2">Delete</th>
                </tr>
              </thead>
              <tbody>
                {form.lines.length ? (
                  form.lines.map((line, index) => {
                    const product = productById.get(line.productId)
                    const stock = inventoryFor(form.toStoreId, line.productId)
                    return (
                      <tr key={`${line.productId}-${index}`} className="border-b border-[var(--border)]">
                        <td className="p-2">{product?.name || "—"}</td>
                        <td className="p-2">{product?.sku || "—"}</td>
                        <td className="p-2">{stock.available}</td>
                        <td className="p-2">{stock.reusable}</td>
                        <td className="p-2">
                          <input
                            className="ui-input"
                            type="number"
                            min={1}
                            value={line.requestedQty}
                            onChange={(e) => updateLine(index, "requestedQty", e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <button className="text-red-600 hover:text-red-700" onClick={() => removeLine(index)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className="p-3 text-[var(--text-muted)]" colSpan={6}>No products added yet.</td>
                  </tr>
                )}
                <tr className="border-t border-[var(--border)] font-semibold">
                  <td className="p-2">Total Qty</td>
                  <td className="p-2" />
                  <td className="p-2" />
                  <td className="p-2" />
                  <td className="p-2">{totalRequestedQty}</td>
                  <td className="p-2" />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <ActionButton onClick={() => void submitDemand()} disabled={saving}>{saving ? "Saving..." : "Create Demand"}</ActionButton>
            <ActionButton
              variant="secondary"
              onClick={() => {
                setForm(INITIAL_FORM)
                setNewLineProductId("")
              }}
            >
              Reset
            </ActionButton>
          </div>
        </FilterBar>
      ) : null}

      {responseMode && allocateDraft ? (
        <FilterBar className="space-y-4">
          <SectionTitle title="Allocate Demand" subtitle="Allocate new/reusable quantities from warehouse inventory." />
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Response Remarks</label>
            <input
              className="ui-input"
              value={allocateDraft.responseRemarks}
              onChange={(e) => setAllocateDraft((prev) => (prev ? { ...prev, responseRemarks: e.target.value } : prev))}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                  <th className="p-2">Product</th>
                  <th className="p-2">Requested</th>
                  <th className="p-2">To Avail Qty</th>
                  <th className="p-2">To Reusable Qty</th>
                  <th className="p-2">New Fulfill Qty</th>
                  <th className="p-2">Reusable Fulfill Qty</th>
                  <th className="p-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {allocateDraft.lines.map((line, idx) => (
                  <tr key={line.demandLineId} className="border-b border-[var(--border)]">
                    <td className="p-2">{line.productName}</td>
                    <td className="p-2">{line.requestedQty}</td>
                    <td className="p-2">{line.availableQty}</td>
                    <td className="p-2">{line.reusableQty}</td>
                    <td className="p-2">
                      <input
                        className="ui-input"
                        type="number"
                        min={0}
                        value={line.newQty}
                        onChange={(e) =>
                          setAllocateDraft((prev) => {
                            if (!prev) return prev
                            const next = [...prev.lines]
                            next[idx] = { ...next[idx], newQty: e.target.value }
                            return { ...prev, lines: next }
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="ui-input"
                        type="number"
                        min={0}
                        value={line.reusableAllocQty}
                        onChange={(e) =>
                          setAllocateDraft((prev) => {
                            if (!prev) return prev
                            const next = [...prev.lines]
                            next[idx] = { ...next[idx], reusableAllocQty: e.target.value }
                            return { ...prev, lines: next }
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="ui-input"
                        value={line.notes}
                        onChange={(e) =>
                          setAllocateDraft((prev) => {
                            if (!prev) return prev
                            const next = [...prev.lines]
                            next[idx] = { ...next[idx], notes: e.target.value }
                            return { ...prev, lines: next }
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <ActionButton onClick={() => void submitAllocate()} disabled={saving}>{saving ? "Saving..." : "Add Response"}</ActionButton>
            <ActionButton variant="secondary" onClick={() => setAllocateDraft(null)}>Close</ActionButton>
          </div>
        </FilterBar>
      ) : null}

      {responseMode && transportDraft ? (
        <FilterBar className="space-y-4">
          <SectionTitle title="Transportation" subtitle="Add transport details after checkout/allocation." />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Transportation Type</label>
              <select
                className="ui-select"
                value={transportDraft.transportType}
                onChange={(e) => setTransportDraft((prev) => (prev ? { ...prev, transportType: e.target.value === "COURIER" ? "COURIER" : "SELF" } : prev))}
              >
                <option value="SELF">Self</option>
                <option value="COURIER">Courier</option>
              </select>
            </div>

            {transportDraft.transportType === "SELF" ? (
              <>
                <FieldInput label="Driver Name" value={transportDraft.driverName} onChange={(value) => setTransportDraft((prev) => (prev ? { ...prev, driverName: value } : prev))} />
                <FieldInput label="Driver Phone" value={transportDraft.driverPhone} onChange={(value) => setTransportDraft((prev) => (prev ? { ...prev, driverPhone: value } : prev))} />
                <FieldInput label="Vehicle Number" value={transportDraft.vehicleNumber} onChange={(value) => setTransportDraft((prev) => (prev ? { ...prev, vehicleNumber: value } : prev))} />
              </>
            ) : (
              <>
                <FieldInput label="Courier Company Name" value={transportDraft.courierCompany} onChange={(value) => setTransportDraft((prev) => (prev ? { ...prev, courierCompany: value } : prev))} />
                <FieldInput label="Courier By" value={transportDraft.courierBy} onChange={(value) => setTransportDraft((prev) => (prev ? { ...prev, courierBy: value } : prev))} />
                <FieldInput label="Date & Time" value={transportDraft.courierDate} onChange={(value) => setTransportDraft((prev) => (prev ? { ...prev, courierDate: value } : prev))} />
                <FieldInput label="Courier Tracking ID" value={transportDraft.courierTrackingId} onChange={(value) => setTransportDraft((prev) => (prev ? { ...prev, courierTrackingId: value } : prev))} />
              </>
            )}
          </div>

          <div className="flex gap-2">
            <ActionButton onClick={() => void submitTransport()} disabled={saving}>{saving ? "Saving..." : "Submit"}</ActionButton>
            <ActionButton variant="secondary" onClick={() => setTransportDraft(null)}>Close</ActionButton>
          </div>
        </FilterBar>
      ) : null}

      {receiveDraft ? (
        <FilterBar className="space-y-4">
          <SectionTitle title="Receive Demand" subtitle="Confirm received new/reusable quantities at requesting store." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                  <th className="p-2">Product</th>
                  <th className="p-2">Requested Qty</th>
                  <th className="p-2">Fulfilled New Qty</th>
                  <th className="p-2">Fulfilled Reusable Qty</th>
                  <th className="p-2">Received New Qty</th>
                  <th className="p-2">Received Reusable Qty</th>
                  <th className="p-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {receiveDraft.lines.map((line, idx) => (
                  <tr key={line.demandLineId} className="border-b border-[var(--border)]">
                    <td className="p-2">{line.productName}</td>
                    <td className="p-2">{line.requestedQty}</td>
                    <td className="p-2">{line.fulfilledNewQty}</td>
                    <td className="p-2">{line.fulfilledReusableQty}</td>
                    <td className="p-2">
                      <input
                        className="ui-input"
                        type="number"
                        min={0}
                        value={line.receivedNewQty}
                        onChange={(e) =>
                          setReceiveDraft((prev) => {
                            if (!prev) return prev
                            const next = [...prev.lines]
                            next[idx] = { ...next[idx], receivedNewQty: e.target.value }
                            return { ...prev, lines: next }
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="ui-input"
                        type="number"
                        min={0}
                        value={line.receivedReusableQty}
                        onChange={(e) =>
                          setReceiveDraft((prev) => {
                            if (!prev) return prev
                            const next = [...prev.lines]
                            next[idx] = { ...next[idx], receivedReusableQty: e.target.value }
                            return { ...prev, lines: next }
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="ui-input"
                        value={line.remarks}
                        onChange={(e) =>
                          setReceiveDraft((prev) => {
                            if (!prev) return prev
                            const next = [...prev.lines]
                            next[idx] = { ...next[idx], remarks: e.target.value }
                            return { ...prev, lines: next }
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Receive Remarks</label>
            <input
              className="ui-input"
              value={receiveDraft.receiveRemarks}
              onChange={(e) => setReceiveDraft((prev) => (prev ? { ...prev, receiveRemarks: e.target.value } : prev))}
            />
          </div>

          <div className="flex gap-2">
            <ActionButton onClick={() => void submitReceive()} disabled={saving}>{saving ? "Saving..." : "Confirm Receive"}</ActionButton>
            <ActionButton variant="secondary" onClick={() => setReceiveDraft(null)}>Close</ActionButton>
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
        columns={
          responseMode
            ? [
                { key: "requestNo", header: "Sr#", render: (row) => row.requestNo || row.id.slice(0, 8) },
                { key: "fromStore", header: "From Store", render: (row) => row.fromStore?.name || "—" },
                { key: "toStore", header: "To Warehouse", render: (row) => row.toStore?.name || "—" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => {
                    const status = workflowStatus(row)
                    return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${badgeClass(status)}`}>{status}</span>
                  },
                },
                { key: "createdAt", header: "Dated", render: (row) => new Date(row.createdAt).toLocaleString("en-US") },
                { key: "requestedBy", header: "Requested By", render: (row) => row.requestedBy?.name || "N/A" },
                { key: "respondedBy", header: "Responded By", render: (row) => latestResponse(row)?.responder?.name || "N/A" },
                {
                  key: "requestedQty",
                  header: "Total Required",
                  render: (row) => computeTotals(row).requested,
                },
                {
                  key: "fulfilledQty",
                  header: "Total Fulfill",
                  render: (row) => computeTotals(row).fulfilled,
                },
                {
                  key: "receivedQty",
                  header: "Total Received",
                  render: (row) => computeTotals(row).received,
                },
                {
                  key: "shortfallQty",
                  header: "Shortfall",
                  render: (row) => computeTotals(row).shortfall,
                },
                {
                  key: "actions",
                  header: "Action",
                  render: (row) => {
                    const response = latestResponse(row)
                    const meta = response ? parseDemandResponseMeta(response.notes) : null
                    const canAllocate = !response && row.status !== "REJECTED" && row.status !== "CANCELLED"
                    const canTransport = Boolean(response && meta && !meta.transport && !meta.receive)

                    return (
                      <div className="flex flex-wrap gap-2">
                        {canAllocate ? (
                          <button className="text-[var(--brand)] hover:underline" onClick={() => openAllocate(row)}>
                            Allocate
                          </button>
                        ) : null}
                        {!response && row.status !== "REJECTED" ? (
                          <button className="text-rose-600 hover:underline" onClick={() => void rejectDemand(row.id)}>
                            Reject
                          </button>
                        ) : null}
                        {canTransport ? (
                          <button className="text-emerald-600 hover:underline" onClick={() => openTransport(row, response!, meta!)}>
                            Add Transport
                          </button>
                        ) : null}
                        <button
                          className="text-slate-700 hover:underline"
                          onClick={() => setDetailsDemandId((prev) => (prev === row.id ? null : row.id))}
                        >
                          Show Details
                        </button>
                      </div>
                    )
                  },
                },
              ]
            : [
                { key: "requestNo", header: "Request", render: (row) => row.requestNo || row.id.slice(0, 8) },
                { key: "fromStore", header: "From", render: (row) => row.fromStore?.name || "—" },
                { key: "toStore", header: "To", render: (row) => row.toStore?.name || "—" },
                { key: "lineCount", header: "Lines", render: (row) => row.lines.length },
                { key: "requestedQty", header: "Requested", render: (row) => computeTotals(row).requested },
                { key: "fulfilledQty", header: "Fulfilled", render: (row) => computeTotals(row).fulfilled },
                { key: "receivedQty", header: "Received", render: (row) => computeTotals(row).received },
                { key: "shortfallQty", header: "Shortfall", render: (row) => computeTotals(row).shortfall },
                {
                  key: "status",
                  header: "Lifecycle",
                  render: (row) => {
                    const status = workflowStatus(row)
                    return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${badgeClass(status)}`}>{status}</span>
                  },
                },
                { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleDateString("en-US") },
                {
                  key: "actions",
                  header: "Action",
                  render: (row) => {
                    const response = latestResponse(row)
                    const meta = response ? parseDemandResponseMeta(response.notes) : null
                    const canReceive = Boolean(response && meta && meta.transport && !meta.receive)

                    return (
                      <div className="flex flex-wrap gap-2">
                        {canReceive ? (
                          <button className="text-emerald-700 hover:underline" onClick={() => openReceive(row, response!, meta!)}>
                            Confirm Receive
                          </button>
                        ) : null}
                        <button
                          className="text-slate-700 hover:underline"
                          onClick={() => setDetailsDemandId((prev) => (prev === row.id ? null : row.id))}
                        >
                          Show Details
                        </button>
                      </div>
                    )
                  },
                },
              ]
        }
      />

      {detailsDemand ? (
        <FilterBar className="space-y-4">
          <SectionTitle title="Demand Details" subtitle={`Request ${detailsDemand.requestNo || detailsDemand.id.slice(0, 8)}`} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
            <ReadOnly label="From Store" value={detailsDemand.fromStore?.name || "—"} />
            <ReadOnly label="To Warehouse" value={detailsDemand.toStore?.name || "—"} />
            <ReadOnly label="Requested By" value={detailsDemand.requestedBy?.name || "—"} />
            <ReadOnly label="Request Remarks" value={detailsDemand.reason || "—"} />
            <ReadOnly label="Total Required" value={String(computeTotals(detailsDemand).requested)} />
            <ReadOnly label="Total Fulfill" value={String(computeTotals(detailsDemand).fulfilled)} />
            <ReadOnly label="Total Received" value={String(computeTotals(detailsDemand).received)} />
            <ReadOnly label="Total Shortfall" value={String(computeTotals(detailsDemand).shortfall)} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                  <th className="p-2">Product</th>
                  <th className="p-2">Required Qty</th>
                  <th className="p-2">Allocated Qty</th>
                </tr>
              </thead>
              <tbody>
                {detailsDemand.lines.map((line) => (
                  <tr key={line.id} className="border-b border-[var(--border)]">
                    <td className="p-2">{line.product.name}</td>
                    <td className="p-2">{line.requestedQty}</td>
                    <td className="p-2">{line.fulfilledQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FilterBar>
      ) : null}
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

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
