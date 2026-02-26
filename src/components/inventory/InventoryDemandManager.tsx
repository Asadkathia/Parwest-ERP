"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"

type Category = { id: string; name: string }
type Office = { id: string; name: string }

type DemandRow = {
  id: string
  quantity: number
  status: string
  reason?: string | null
  requiredBy?: string | null
  createdAt: string
  category?: Category | null
  regionalOffice?: Office | null
}

const STATUS_OPTIONS = ["PENDING", "APPROVED", "FULFILLED", "REJECTED"]

export default function InventoryDemandManager() {
  const [rows, setRows] = useState<DemandRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const [filters, setFilters] = useState({
    status: "",
    categoryId: "",
    regionalOfficeId: "",
    search: "",
  })

  const [form, setForm] = useState({
    categoryId: "",
    regionalOfficeId: "",
    quantity: "",
    requiredBy: "",
    reason: "",
  })

  const loadBase = useCallback(async () => {
    try {
      const [categoriesRes, officesRes] = await Promise.all([
        fetch("/api/inventory/categories", { cache: "no-store" }),
        fetch("/api/regional-offices", { cache: "no-store" }),
      ])
      const [categoriesJson, officesJson] = await Promise.all([
        categoriesRes.json().catch(() => []),
        officesRes.json().catch(() => []),
      ])
      setCategories(Array.isArray(categoriesJson) ? categoriesJson : [])
      setOffices(Array.isArray(officesJson) ? officesJson : [])
    } catch {
      setCategories([])
      setOffices([])
    }
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set("status", filters.status)
      if (filters.categoryId) params.set("categoryId", filters.categoryId)
      if (filters.regionalOfficeId) params.set("regionalOfficeId", filters.regionalOfficeId)

      const response = await fetch(`/api/inventory/demands?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to load demands.")
      setRows(Array.isArray(payload) ? payload : [])
    } catch (error: any) {
      setRows([])
      setNotice({ type: "error", message: error?.message || "Failed to load demands." })
    } finally {
      setLoading(false)
    }
  }, [filters.categoryId, filters.regionalOfficeId, filters.status])

  useEffect(() => {
    void loadBase()
  }, [loadBase])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const create = async () => {
    setNotice(null)
    const quantity = Number(form.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setNotice({ type: "error", message: "Quantity must be greater than zero." })
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/inventory/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: form.categoryId || null,
          regionalOfficeId: form.regionalOfficeId || null,
          quantity,
          requiredBy: form.requiredBy || null,
          reason: form.reason.trim() || null,
          status: "PENDING",
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to create demand.")
      setForm({ categoryId: "", regionalOfficeId: "", quantity: "", requiredBy: "", reason: "" })
      setNotice({ type: "success", message: "Demand created." })
      await loadRows()
    } catch (error: any) {
      setNotice({ type: "error", message: error?.message || "Failed to create demand." })
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (row: DemandRow, status: string) => {
    try {
      const response = await fetch(`/api/inventory/demands/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to update demand.")
      setNotice({ type: "success", message: `Demand marked ${status}.` })
      await loadRows()
    } catch (error: any) {
      setNotice({ type: "error", message: error?.message || "Failed to update demand." })
    }
  }

  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/inventory/demands/${id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to delete demand.")
      setNotice({ type: "success", message: "Demand deleted." })
      await loadRows()
    } catch (error: any) {
      setNotice({ type: "error", message: error?.message || "Failed to delete demand." })
    }
  }

  const filteredRows = useMemo(() => {
    if (!filters.search.trim()) return rows
    const q = filters.search.toLowerCase()
    return rows.filter((row) =>
      `${row.category?.name || ""} ${row.regionalOffice?.name || ""} ${row.reason || ""} ${row.status}`.toLowerCase().includes(q)
    )
  }, [rows, filters.search])

  return (
    <div className="space-y-6">
      <SectionTitle title="Demand" subtitle="Create and track inventory demand requests." />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select
            label="Regional Office"
            value={form.regionalOfficeId}
            onChange={(value) => setForm((prev) => ({ ...prev, regionalOfficeId: value }))}
            options={offices.map((row) => ({ value: row.id, label: row.name }))}
          />
          <Select
            label="Category"
            value={form.categoryId}
            onChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
            options={categories.map((row) => ({ value: row.id, label: row.name }))}
          />
          <Input label="Requested Quantity *" value={form.quantity} onChange={(value) => setForm((prev) => ({ ...prev, quantity: value }))} type="number" placeholder="0" />
          <Input label="Required By" value={form.requiredBy} onChange={(value) => setForm((prev) => ({ ...prev, requiredBy: value }))} type="date" placeholder="" />
          <Input label="Notes" value={form.reason} onChange={(value) => setForm((prev) => ({ ...prev, reason: value }))} placeholder="Reason / notes" />
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={create} disabled={saving}>{saving ? "Saving..." : "Create Request"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => setForm({ categoryId: "", regionalOfficeId: "", quantity: "", requiredBy: "", reason: "" })}>Reset</ActionButton>
        </div>
      </FilterBar>

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Status"
            value={filters.status}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            options={STATUS_OPTIONS.map((status) => ({ value: status, label: status }))}
            withAll
          />
          <Select
            label="Category"
            value={filters.categoryId}
            onChange={(value) => setFilters((prev) => ({ ...prev, categoryId: value }))}
            options={categories.map((row) => ({ value: row.id, label: row.name }))}
            withAll
          />
          <Select
            label="Regional Office"
            value={filters.regionalOfficeId}
            onChange={(value) => setFilters((prev) => ({ ...prev, regionalOfficeId: value }))}
            options={offices.map((row) => ({ value: row.id, label: row.name }))}
            withAll
          />
          <Input label="Search" value={filters.search} onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))} placeholder="Search demands" />
        </div>
      </FilterBar>

      <DataTable
        rows={filteredRows}
        columns={[
          { key: "regionalOffice", header: "Regional Office", render: (row) => row.regionalOffice?.name || "—", sortable: true },
          { key: "category", header: "Category", render: (row) => row.category?.name || "—", sortable: true },
          { key: "quantity", header: "Qty", sortable: true },
          { key: "requiredBy", header: "Required By", render: (row) => (row.requiredBy ? new Date(row.requiredBy).toLocaleDateString("en-US") : "—") },
          { key: "status", header: "Status", sortable: true },
          { key: "reason", header: "Notes", render: (row) => row.reason || "—" },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {row.status !== "APPROVED" ? (
                  <button className="text-[var(--brand)] hover:underline" onClick={() => void updateStatus(row, "APPROVED")}>
                    Approve
                  </button>
                ) : null}
                {row.status !== "FULFILLED" ? (
                  <button className="text-[var(--brand)] hover:underline" onClick={() => void updateStatus(row, "FULFILLED")}>
                    Fulfill
                  </button>
                ) : null}
                <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>
                  Delete
                </button>
              </div>
            ),
          },
        ]}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading demand requests..." : "No demand requests found."}
      />
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: "text" | "number" | "date"
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input
        className="ui-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  withAll = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  withAll?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select className="ui-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{withAll ? "All" : "Select"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
