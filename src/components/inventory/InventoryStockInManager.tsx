"use client"

import { useEffect, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Option = { id: string; name: string }
type ApiOfficeRow = { id: string; name: string }

export default function InventoryStockInManager() {
  const [categories, setCategories] = useState<Option[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [offices, setOffices] = useState<Option[]>([])
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [form, setForm] = useState({
    uniqueNumber: "",
    serialNumber: "",
    orderId: "",
    categoryId: "",
    vendorId: "",
    regionalOfficeId: "",
    price: "",
    purchaseDate: "",
    expiryDate: "",
    quantity: "1",
    isInsured: false,
    isNonUnique: false,
  })

  useEffect(() => {
    fetch("/api/inventory/categories").then((r) => r.json()).then((d) => setCategories(d || [])).catch(() => null)
    fetch("/api/inventory/vendors").then((r) => r.json()).then((d) => setVendors(d || [])).catch(() => null)
    fetch("/api/regional-offices")
      .then((r) => r.json())
      .then((d) => setOffices(((d as ApiOfficeRow[]) || []).map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => null)
  }, [])

  const submit = async () => {
    if (!form.uniqueNumber || !form.categoryId) {
      setNotice({ type: "error", message: "Unique number and category are required." })
      return
    }

    const response = await fetch("/api/inventory/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: form.price ? Number(form.price) : null,
        quantity: form.quantity ? Number(form.quantity) : 1,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setNotice({ type: "error", message: body?.message || "Failed to save item." })
      return
    }

    setNotice({ type: "success", message: "Inventory item saved." })
    setForm({
      uniqueNumber: "",
      serialNumber: "",
      orderId: "",
      categoryId: "",
      vendorId: "",
      regionalOfficeId: "",
      price: "",
      purchaseDate: "",
      expiryDate: "",
      quantity: "1",
      isInsured: false,
      isNonUnique: false,
    })
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Stock In" subtitle="Register inventory items in the database." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="ui-input" placeholder="Unique Number *" value={form.uniqueNumber} onChange={(e) => setForm((p) => ({ ...p, uniqueNumber: e.target.value }))} />
          <input className="ui-input" placeholder="Serial Number" value={form.serialNumber} onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))} />
          <input className="ui-input" placeholder="Order ID" value={form.orderId} onChange={(e) => setForm((p) => ({ ...p, orderId: e.target.value }))} />
          <select className="ui-select" value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
            <option value="">Select Category *</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="ui-select" value={form.vendorId} onChange={(e) => setForm((p) => ({ ...p, vendorId: e.target.value }))}>
            <option value="">Select Vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select className="ui-select" value={form.regionalOfficeId} onChange={(e) => setForm((p) => ({ ...p, regionalOfficeId: e.target.value }))}>
            <option value="">Select Regional Office</option>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input className="ui-input" type="number" placeholder="Price" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
          <input className="ui-input" type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
          <input className="ui-input" type="date" value={form.purchaseDate} onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))} />
          <input className="ui-input" type="date" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isInsured} onChange={(e) => setForm((p) => ({ ...p, isInsured: e.target.checked }))} />
            Is Insured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isNonUnique} onChange={(e) => setForm((p) => ({ ...p, isNonUnique: e.target.checked }))} />
            Is Non-Unique
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <ActionButton onClick={submit}>Save Stock In</ActionButton>
        </div>
      </section>
    </div>
  )
}
