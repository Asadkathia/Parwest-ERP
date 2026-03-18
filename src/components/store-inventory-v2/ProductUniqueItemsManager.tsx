"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string }

type UniqueItem = {
  id: string
  uniqueNumber: string
  serialNumber?: string | null
  status: string
  category?: Option | null
  condition?: Option | null
  vendor?: Option | null
  regionalOffice?: Option | null
  createdAt?: string
}

const EMPTY_FORM = {
  uniqueNumber: "",
  serialNumber: "",
  categoryId: "",
  conditionId: "",
  vendorId: "",
  regionalOfficeId: "",
  status: "AVAILABLE",
}

export default function ProductUniqueItemsManager() {
  const [rows, setRows] = useState<UniqueItem[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [conditions, setConditions] = useState<Option[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [offices, setOffices] = useState<Option[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [items, categoryRows, conditionRows, vendorRows, officeRows] = await Promise.all([
        apiGet<UniqueItem[]>("/api/store-inventory/v2/product-unique-items"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/categories"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/conditions"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/vendors"),
        apiGet<Option[]>("/api/regional-offices"),
      ])

      setRows(items)
      setCategories(categoryRows)
      setConditions(conditionRows)
      setVendors(vendorRows)
      setOffices(officeRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load product unique items."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      return `${row.uniqueNumber} ${row.serialNumber || ""} ${row.status} ${row.category?.name || ""} ${row.vendor?.name || ""}`.toLowerCase().includes(q)
    })
  }, [rows, query])

  const createItem = async () => {
    if (!form.uniqueNumber.trim() || !form.categoryId) {
      setNotice({ type: "error", message: "Unique number and category are required." })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      await apiSend<UniqueItem>("/api/store-inventory/v2/product-unique-items", "POST", {
        uniqueNumber: form.uniqueNumber.trim(),
        serialNumber: form.serialNumber.trim() || null,
        categoryId: form.categoryId,
        conditionId: form.conditionId || null,
        vendorId: form.vendorId || null,
        regionalOfficeId: form.regionalOfficeId || null,
        status: form.status,
      })
      setNotice({ type: "success", message: "Unique item created successfully." })
      setForm(EMPTY_FORM)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create unique item."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const removeItem = async (id: string) => {
    try {
      await apiSend(`/api/store-inventory/v2/product-unique-items/${id}`, "DELETE")
      setNotice({ type: "success", message: "Unique item deleted successfully." })
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete unique item."
      setNotice({ type: "error", message })
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Product Unique Items"
        subtitle="Manage individually tracked inventory items by unique number and serial number."
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Unique Number *</label>
            <input className="ui-input" value={form.uniqueNumber} onChange={(e) => setForm((prev) => ({ ...prev, uniqueNumber: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Serial Number</label>
            <input className="ui-input" value={form.serialNumber} onChange={(e) => setForm((prev) => ({ ...prev, serialNumber: e.target.value }))} />
          </div>
          <Select label="Category *" value={form.categoryId} onChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))} options={categories} />
          <Select label="Condition" value={form.conditionId} onChange={(value) => setForm((prev) => ({ ...prev, conditionId: value }))} options={conditions} />
          <Select label="Vendor" value={form.vendorId} onChange={(value) => setForm((prev) => ({ ...prev, vendorId: value }))} options={vendors} />
          <Select label="Regional Office" value={form.regionalOfficeId} onChange={(value) => setForm((prev) => ({ ...prev, regionalOfficeId: value }))} options={offices} />
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Status</label>
            <select className="ui-select" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="ISSUED">ISSUED</option>
              <option value="CONDEMNED">CONDEMNED</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={() => void createItem()} disabled={saving}>
            {saving ? "Saving..." : "Create Unique Item"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => setForm(EMPTY_FORM)}>
            Reset
          </ActionButton>
        </div>
      </FilterBar>

      <FilterBar>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
          <input className="ui-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by unique/serial/status/vendor" />
        </div>
      </FilterBar>

      <DataTable
        rows={visibleRows}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading unique items..." : "No unique items found."}
        columns={[
          { key: "uniqueNumber", header: "Unique Number", sortable: true },
          { key: "serialNumber", header: "Serial Number", render: (row) => row.serialNumber || "—" },
          { key: "category", header: "Category", render: (row) => row.category?.name || "—" },
          { key: "vendor", header: "Vendor", render: (row) => row.vendor?.name || "—" },
          { key: "status", header: "Status", sortable: true },
          {
            key: "actions",
            header: "Action",
            render: (row) => (
              <button className="text-red-600 hover:underline" onClick={() => void removeItem(row.id)}>
                Delete
              </button>
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
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
}) {
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
