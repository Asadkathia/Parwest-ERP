"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string; type?: string | null }

type PurchaseLine = {
  id: string
  quantity: number
  unitCost?: number | null
  totalCost?: number | null
  product: {
    id: string
    name: string
    sku: string
    calibre?: { id: string; name: string } | null
    weaponType?: { id: string; name: string } | null
  }
}

type ProductOption = {
  id: string
  name: string
  sku: string
  category?: { id: string; name: string } | null
  calibre?: { id: string; name: string } | null
  weaponType?: { id: string; name: string } | null
  variation?: { id: string; name: string } | null
}

type ProductScope = "NON_WEAPON" | "WEAPON"

type Purchase = {
  id: string
  referenceNo?: string | null
  invoiceNo?: string | null
  attachmentUrl?: string | null
  supplierName?: string | null
  vendor?: Option | null
  status: string
  purchasedAt: string
  store: { id: string; name: string; type?: string | null }
  lines: PurchaseLine[]
  createdBy: { id: string; name: string }
  notes?: string | null
  purchaseOrder?: {
    approvalReference?: string | null
    invoiceDate?: string | null
    deliveryChallanNumber?: string | null
  } | null
  workflow?: {
    transport?: {
      transportType: "SELF" | "COURIER"
      driverName?: string | null
      driverPhone?: string | null
      vehicleNumber?: string | null
      courierCompany?: string | null
      courierTrackingId?: string | null
      courierBy?: string | null
      courierDate?: string | null
    } | null
    history: Array<{
      status: "PENDING" | "RECEIVED" | "CANCELLED"
      changedByName?: string | null
      changedAt: string
      remarks?: string | null
      lines?: Array<{
        purchaseLineId?: string
        productId?: string
        productName?: string | null
        variant?: string | null
        newReceivedQty: number
        damagedQty: number
        okQty: number
        reusableQty: number
        remarks?: string | null
      }>
    }>
  } | null
}

const INITIAL_FORM = {
  storeId: "",
  vendorId: "",
  attachmentName: "",
  purchasedAt: new Date().toISOString().split("T")[0],
  note: "",
  approvalReference: "",
  invoiceNumber: "",
  invoiceDate: "",
  deliveryChallanNumber: "",
  lines: [{ productId: "", quantity: "1", unitCost: "1", notes: "" }],
}

function toStatusLabel(value: string): string {
  const raw = String(value || "").toUpperCase()
  if (raw === "RECEIVED") return "Confirmed"
  if (raw === "CANCELLED") return "Rejected"
  if (raw === "DRAFT") return "Pending"
  return value
}

function statusBadgeClass(value: string): string {
  const raw = String(value || "").toUpperCase()
  if (raw === "RECEIVED") return "bg-emerald-100 text-emerald-700"
  if (raw === "CANCELLED") return "bg-rose-100 text-rose-700"
  if (raw === "DRAFT") return "bg-amber-100 text-amber-700"
  return "bg-slate-100 text-slate-700"
}

function terminalPurchaseHistory(row: Purchase): {
  actor: string
  at: string
  rejectReason: string
} {
  const terminal = [...(row.workflow?.history || [])]
    .reverse()
    .find((entry) => entry.status === "RECEIVED" || entry.status === "CANCELLED")

  if (!terminal) {
    return { actor: "N/A", at: "N/A", rejectReason: "N/A" }
  }

  return {
    actor: terminal.changedByName || "N/A",
    at: terminal.changedAt ? new Date(terminal.changedAt).toLocaleString() : "N/A",
    rejectReason: terminal.status === "CANCELLED" ? terminal.remarks || "N/A" : "N/A",
  }
}

function lineProduct(products: ProductOption[], id: string): ProductOption | null {
  if (!id) return null
  return products.find((row) => row.id === id) || null
}

export default function PurchasesManager({
  createMode = false,
  productScope = "NON_WEAPON",
}: {
  createMode?: boolean
  productScope?: ProductScope
}) {
  const router = useRouter()
  const [rows, setRows] = useState<Purchase[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [receivingRow, setReceivingRow] = useState<Purchase | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [receivingDraft, setReceivingDraft] = useState<{
    transportType: "SELF" | "COURIER"
    driverName: string
    driverPhone: string
    vehicleNumber: string
    courierCompany: string
    courierTrackingId: string
    courierBy: string
    courierDate: string
    lines: Array<{
      purchaseLineId: string
      requestedQty: number
      alreadyReceivedQty: number
      remainingQty: number
      receivedNewQty: string
      damagedQty: string
      reusableQty: string
      remarks: string
    }>
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [purchaseRows, storeRows, productRows, vendorRows] = await Promise.all([
        apiGet<Purchase[]>(`/api/store-inventory/v2/purchases?categoryScope=${productScope}`),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<ProductOption[]>("/api/store-inventory/v2/products"),
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
  }, [productScope])

  useEffect(() => {
    void load()
  }, [load])

  const scopedProducts = useMemo(() => {
    return products.filter((product) => {
      const category = String(product.category?.name ?? "").toLowerCase()
      const isWeaponOrAmmo = category.includes("weapon") || category.includes("ammo")
      return productScope === "WEAPON" ? isWeaponOrAmmo : !isWeaponOrAmmo
    })
  }, [products, productScope])

  const submit = async () => {
    const lines = form.lines.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
      unitCost: line.unitCost.trim() ? Number(line.unitCost) : 1,
      notes: line.notes.trim() || null,
    }))

    if (!form.storeId || !form.vendorId || !form.purchasedAt) {
      setNotice({ type: "error", message: "Store/Warehouse, Vendor, and Purchase Date are required." })
      return
    }

    if (lines.some((line) => !line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
      setNotice({ type: "error", message: "Valid products and positive quantities are required." })
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      await apiSend<Purchase>("/api/store-inventory/v2/purchases", "POST", {
        categoryScope: productScope,
        storeId: form.storeId,
        vendorId: form.vendorId,
        attachmentUrl: form.attachmentName || null,
        purchasedAt: form.purchasedAt,
        status: "DRAFT",
        referenceNo: form.approvalReference.trim() || null,
        invoiceNo: form.invoiceNumber.trim() || null,
        note: form.note.trim() || null,
        approvalReference: form.approvalReference.trim() || null,
        invoiceDate: form.invoiceDate.trim() || null,
        deliveryChallanNumber: form.deliveryChallanNumber.trim() || null,
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
      lines: [...prev.lines, { productId: "", quantity: "1", unitCost: "1", notes: "" }],
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

  const lineTotals = useMemo(() => {
    const qty = form.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
    const price = form.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0)
    return { qty, price }
  }, [form.lines])

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase().trim()
    return rows.filter((row) => {
      const productNames = row.lines.map((line) => `${line.product.sku} ${line.product.name}`).join(" ")
      return `${row.store.name} ${row.vendor?.name || ""} ${row.createdBy?.name || ""} ${row.invoiceNo || ""} ${row.referenceNo || ""} ${productNames}`
        .toLowerCase()
        .includes(q)
    })
  }, [rows, search])

  const openDetail = (id: string) => {
    router.push(`/store-inventory/purchases/${id}`)
  }

  const printPurchase = (id: string) => {
    window.open(`/store-inventory/purchases/${id}?print=1`, "_blank", "noopener,noreferrer")
  }

  const openReceiving = async (id: string) => {
    try {
      const row = await apiGet<Purchase>(`/api/store-inventory/v2/purchases/${id}`)
      setReceivingRow(row)
      setReceivingDraft({
        transportType: "SELF",
        driverName: "",
        driverPhone: "",
        vehicleNumber: "",
        courierCompany: "",
        courierTrackingId: "",
        courierBy: "",
        courierDate: "",
        lines: row.lines.map((line) => {
          const alreadyReceivedQty = (row.workflow?.history || [])
            .flatMap((entry) => entry.lines || [])
            .filter((entry) => entry.purchaseLineId === line.id || entry.productId === line.product.id)
            .reduce((sum, entry) => sum + entry.newReceivedQty + entry.okQty, 0)

          return {
            purchaseLineId: line.id,
            requestedQty: line.quantity,
            alreadyReceivedQty,
            remainingQty: Math.max(0, line.quantity - alreadyReceivedQty),
            receivedNewQty: "0",
            damagedQty: "0",
            reusableQty: "0",
            remarks: "",
          }
        }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open regular receiving."
      setNotice({ type: "error", message })
    }
  }

  const submitReceiving = async () => {
    if (!receivingRow || !receivingDraft) return

    const exceedsRemaining = receivingDraft.lines.some((line) => {
      const nextAccepted = (Number(line.receivedNewQty) || 0) + (Number(line.reusableQty) || 0)
      return nextAccepted > line.remainingQty
    })
    if (exceedsRemaining) {
      setNotice({ type: "error", message: "Received quantities cannot exceed remaining quantity." })
      return
    }

    setSaving(true)
    try {
      await apiSend(`/api/store-inventory/v2/purchases/${receivingRow.id}/receive`, "PATCH", {
        transportType: receivingDraft.transportType,
        driverName: receivingDraft.driverName,
        driverPhone: receivingDraft.driverPhone,
        vehicleNumber: receivingDraft.vehicleNumber,
        courierCompany: receivingDraft.courierCompany,
        courierTrackingId: receivingDraft.courierTrackingId,
        courierBy: receivingDraft.courierBy,
        courierDate: receivingDraft.courierDate,
        lines: receivingDraft.lines.map((line) => ({
          purchaseLineId: line.purchaseLineId,
          receivedNewQty: Number(line.receivedNewQty) || 0,
          damagedQty: Number(line.damagedQty) || 0,
          reusableQty: Number(line.reusableQty) || 0,
          remarks: line.remarks.trim() || null,
        })),
      })
      setNotice({ type: "success", message: "Regular receiving processed." })
      setReceivingRow(null)
      setReceivingDraft(null)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process receiving."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const rejectPurchase = async (id: string) => {
    setRejectingId(id)
    try {
      await apiSend(`/api/store-inventory/v2/purchases/${id}`, "PATCH", { status: "CANCELLED", reason: "Rejected from regular purchase listing" })
      setNotice({ type: "success", message: "Purchase rejected." })
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject purchase."
      setNotice({ type: "error", message })
    } finally {
      setRejectingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={createMode ? (productScope === "WEAPON" ? "Add Weapon Purchase" : "Add Purchase") : (productScope === "WEAPON" ? "Weapon Purchase" : "Regular Purchase")}
        subtitle={
          createMode
            ? productScope === "WEAPON"
              ? "Weapon-only purchase workflow for stock-in."
              : "Staging-aligned purchase workflow for store/warehouse inventory intake."
            : productScope === "WEAPON"
              ? "Weapon purchase list with status and invoice totals."
              : "Purchase list with status and invoice totals."
        }
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      {createMode ? (
        <FilterBar className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldSelect
              label="Select Store/Warehouse *"
              value={form.storeId}
              onChange={(value) => setForm((prev) => ({ ...prev, storeId: value }))}
              options={stores}
            />
            <FieldSelect
              label="Select Vendor *"
              value={form.vendorId}
              onChange={(value) => setForm((prev) => ({ ...prev, vendorId: value }))}
              options={vendors}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Attachment Invoices</label>
            <input
              className="ui-input"
              type="file"
              onChange={(e) => setForm((prev) => ({ ...prev, attachmentName: e.target.files?.[0]?.name || "" }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Purchase Date</label>
            <input
              className="ui-input"
              type="date"
              value={form.purchasedAt}
              onChange={(e) => setForm((prev) => ({ ...prev, purchasedAt: e.target.value }))}
            />
          </div>

          <div className="space-y-4">
            <div className="font-medium text-[var(--text-muted)]">Products Table *</div>
            {form.lines.map((line, index) => {
              const selected = lineProduct(scopedProducts, line.productId)
              return (
                <div key={index} className="grid grid-cols-1 gap-4 items-end border-b border-[var(--border)] pb-4 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Select Product</label>
                    <select className="ui-select" value={line.productId} onChange={(e) => updateLine(index, "productId", e.target.value)}>
                      <option value="">Type product code and select</option>
                      {scopedProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} - {product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Product Code</label>
                    <input className="ui-input" value={selected?.sku || ""} readOnly />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Product Name</label>
                    <input className="ui-input" value={selected?.name || ""} readOnly />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Variant</label>
                    <input className="ui-input" value={selected?.variation?.name || "—"} readOnly />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">New Stock</label>
                    <input className="ui-input" value="0" readOnly />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Reusable</label>
                    <input className="ui-input" value="0" readOnly />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Quantity</label>
                    <input className="ui-input" type="number" min={1} value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Price</label>
                    <input className="ui-input" type="number" min={0} value={line.unitCost} onChange={(e) => updateLine(index, "unitCost", e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <button className="text-red-600 hover:text-red-700 p-2 disabled:opacity-30" onClick={() => removeLine(index)} disabled={form.lines.length === 1}>
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
            <ActionButton variant="secondary" onClick={addLine}>+ Add Product</ActionButton>

            <div className="grid grid-cols-1 gap-2 text-sm text-[var(--text-muted)] md:grid-cols-2">
              <div className="rounded border border-[var(--border)] p-2 font-medium">Total Qty: {lineTotals.qty}</div>
              <div className="rounded border border-[var(--border)] p-2 font-medium">Total Price: {lineTotals.price.toFixed(2)}</div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Note</label>
            <textarea className="ui-input min-h-24" value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} />
          </div>

          <div className="space-y-3 rounded border border-[var(--border)] p-4">
            <div className="font-medium text-[var(--text-muted)]">Purchase Order Details (Optional)</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Approval Reference</label>
                <input className="ui-input" value={form.approvalReference} onChange={(e) => setForm((prev) => ({ ...prev, approvalReference: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Invoice Number</label>
                <input className="ui-input" value={form.invoiceNumber} onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Invoice Date</label>
                <input className="ui-input" type="date" value={form.invoiceDate} onChange={(e) => setForm((prev) => ({ ...prev, invoiceDate: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Delivery Challan Number</label>
                <input className="ui-input" value={form.deliveryChallanNumber} onChange={(e) => setForm((prev) => ({ ...prev, deliveryChallanNumber: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <ActionButton onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Add Purchase"}</ActionButton>
            <ActionButton variant="secondary" onClick={() => setForm(INITIAL_FORM)}>Reset</ActionButton>
          </div>
        </FilterBar>
      ) : (
        <>
          <FilterBar>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
              <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by store/vendor/user/date/invoice" />
            </div>
          </FilterBar>

          <DataTable
            rows={visible}
            rowKey="id"
            searchable={false}
            emptyText={loading ? "Loading purchases..." : "No purchases found."}
            columns={[
              { key: "store", header: "Store/Warehouse", render: (row) => `${row.store.name}${row.store.type ? ` (${row.store.type === "WAREHOUSE" ? "Warehouse" : "Store"})` : ""}`, sortable: true },
              { key: "vendor", header: "Vendor", render: (row) => row.vendor?.name || row.supplierName || "—", sortable: true },
              { key: "createdBy", header: "User", render: (row) => row.createdBy?.name || "—", sortable: true },
              { key: "purchasedAt", header: "Purchase Date", render: (row) => new Date(row.purchasedAt).toLocaleDateString("en-CA"), sortable: true },
              { key: "totalInvoice", header: "Total Invoice", render: (row) => row.lines.reduce((sum, line) => sum + (line.totalCost ?? (line.quantity * (line.unitCost ?? 0))), 0) },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                    {toStatusLabel(row.status)}
                  </span>
                ),
              },
              {
                key: "confirmedRejectedBy",
                header: "Confirmed/Rejected By",
                render: (row) => terminalPurchaseHistory(row).actor,
              },
              {
                key: "confirmedRejectedAt",
                header: "Confirmed/Rejected At",
                render: (row) => terminalPurchaseHistory(row).at,
              },
              {
                key: "rejectReason",
                header: "Reject Reason",
                render: (row) => terminalPurchaseHistory(row).rejectReason,
              },
              {
                key: "note",
                header: "Note",
                render: (row) => row.notes || "—",
              },
              {
                key: "actions",
                header: "Action",
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <button className="text-[var(--brand)] hover:underline" onClick={() => void openDetail(row.id)}>
                      Show Detail
                    </button>
                    <button className="text-[var(--brand)] hover:underline" onClick={() => printPurchase(row.id)}>
                      Print PO
                    </button>
                    {String(row.status).toUpperCase() !== "RECEIVED" && String(row.status).toUpperCase() !== "CANCELLED" ? (
                      <>
                        <button className="text-[var(--brand)] hover:underline" onClick={() => void openReceiving(row.id)}>
                          Regular receiving
                        </button>
                        <button className="text-rose-600 hover:underline" onClick={() => void rejectPurchase(row.id)} disabled={rejectingId === row.id}>
                          {rejectingId === row.id ? "Rejecting..." : "Reject"}
                        </button>
                      </>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      {receivingRow && receivingDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-6xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Regular Purchase Details</h3>
              <button className="text-sm text-[var(--text-muted)] hover:underline" onClick={() => { setReceivingRow(null); setReceivingDraft(null) }}>
                Close
              </button>
            </div>
            <div className="mb-3 text-sm text-[var(--text-muted)]">
              Purchase Status: <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${statusBadgeClass(receivingRow.status)}`}>{toStatusLabel(receivingRow.status)}</span>
            </div>
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                      <th className="p-2">Product</th>
                      <th className="p-2">Requested Qty</th>
                      <th className="p-2">Received Qty</th>
                      <th className="p-2">Remaining Qty</th>
                      <th className="p-2">Unit Price</th>
                      <th className="p-2">New Fulfilled</th>
                      <th className="p-2">Damaged Qty</th>
                      <th className="p-2">Reusable Fulfilled</th>
                      <th className="p-2">Remarks / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivingDraft.lines.map((line, index) => {
                      const lineProduct = receivingRow.lines.find((row) => row.id === line.purchaseLineId)
                      return (
                        <tr key={line.purchaseLineId} className="border-b border-[var(--border)]">
                          <td className="p-2">{lineProduct?.product.name} ({lineProduct?.product.sku})</td>
                          <td className="p-2">{line.requestedQty}</td>
                          <td className="p-2">{line.alreadyReceivedQty}</td>
                          <td className="p-2">{line.remainingQty}</td>
                          <td className="p-2">{lineProduct?.unitCost ?? 0}</td>
                          <td className="p-2">
                            <input
                              className="ui-input"
                              type="number"
                              min={0}
                              max={line.remainingQty}
                              value={line.receivedNewQty}
                              onChange={(e) =>
                                setReceivingDraft((prev) =>
                                  prev
                                    ? { ...prev, lines: prev.lines.map((row, i) => i === index ? { ...row, receivedNewQty: e.target.value } : row) }
                                    : prev
                                )
                              }
                            />
                          </td>
                          <td className="p-2">
                            <input className="ui-input" type="number" min={0} value={line.damagedQty} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, lines: prev.lines.map((row, i) => i === index ? { ...row, damagedQty: e.target.value } : row) }) : prev)} />
                          </td>
                          <td className="p-2">
                            <input
                              className="ui-input"
                              type="number"
                              min={0}
                              max={line.remainingQty}
                              value={line.reusableQty}
                              onChange={(e) =>
                                setReceivingDraft((prev) =>
                                  prev
                                    ? { ...prev, lines: prev.lines.map((row, i) => i === index ? { ...row, reusableQty: e.target.value } : row) }
                                    : prev
                                )
                              }
                            />
                          </td>
                          <td className="p-2">
                            <input className="ui-input" value={line.remarks} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, lines: prev.lines.map((row, i) => i === index ? { ...row, remarks: e.target.value } : row) }) : prev)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <div className="font-medium text-[var(--text-muted)]">Transportation</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm text-[var(--text-muted)]">Transportation Type</label>
                    <select className="ui-select" value={receivingDraft.transportType} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, transportType: e.target.value as "SELF" | "COURIER" }) : prev)}>
                      <option value="SELF">Self</option>
                      <option value="COURIER">Courier</option>
                    </select>
                  </div>
                  {receivingDraft.transportType === "SELF" ? (
                    <>
                      <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">Driver Name</label>
                        <input className="ui-input" value={receivingDraft.driverName} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, driverName: e.target.value }) : prev)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">Driver Phone</label>
                        <input className="ui-input" value={receivingDraft.driverPhone} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, driverPhone: e.target.value }) : prev)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">Vehicle Number</label>
                        <input className="ui-input" value={receivingDraft.vehicleNumber} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, vehicleNumber: e.target.value }) : prev)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">Courier Company Name</label>
                        <input className="ui-input" value={receivingDraft.courierCompany} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, courierCompany: e.target.value }) : prev)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">Courier By</label>
                        <input className="ui-input" value={receivingDraft.courierBy} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, courierBy: e.target.value }) : prev)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">Date & Time</label>
                        <input className="ui-input" value={receivingDraft.courierDate} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, courierDate: e.target.value }) : prev)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-[var(--text-muted)]">Courier Tracking ID</label>
                        <input className="ui-input" value={receivingDraft.courierTrackingId} onChange={(e) => setReceivingDraft((prev) => prev ? ({ ...prev, courierTrackingId: e.target.value }) : prev)} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <ActionButton variant="secondary" onClick={() => { setReceivingRow(null); setReceivingDraft(null) }}>
                  Cancel
                </ActionButton>
                <ActionButton onClick={() => void submitReceiving()} disabled={saving}>
                  {saving ? "Saving..." : "Received"}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
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
