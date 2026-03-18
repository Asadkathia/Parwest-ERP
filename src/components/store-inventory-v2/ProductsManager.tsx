"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string }

type Product = {
  id: string
  sku: string
  name: string
  serialRequired: boolean
  brand?: Option | null
  unit?: Option | null
  status?: Option | null
  condition?: Option | null
  category?: Option | null
  weaponType?: Option | null
  calibre?: Option | null
  description?: string | null
  imageUrl?: string | null
}

const EMPTY_FORM = {
  sku: "",
  name: "",
  brandId: "",
  unitId: "",
  statusId: "",
  conditionId: "",
  categoryId: "",
  weaponTypeId: "",
  calibreId: "",
  description: "",
  imageUrl: "",
  serialRequired: false,
}

export default function ProductsManager({ createMode = false }: { createMode?: boolean }) {
  const [products, setProducts] = useState<Product[]>([])
  const [brands, setBrands] = useState<Option[]>([])
  const [units, setUnits] = useState<Option[]>([])
  const [statuses, setStatuses] = useState<Option[]>([])
  const [conditions, setConditions] = useState<Option[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [weaponTypes, setWeaponTypes] = useState<Option[]>([])
  const [calibres, setCalibres] = useState<Option[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [productRows, brandRows, unitRows, statusRows, conditionRows, categoryRows, weaponTypeRows, calibreRows] = await Promise.all([
        apiGet<Product[]>("/api/store-inventory/v2/products?includeBalances=true"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/brands"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/units"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/statuses"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/conditions"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/categories"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/weapon-types"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/calibres"),
      ])

      setProducts(productRows)
      setBrands(brandRows)
      setUnits(unitRows)
      setStatuses(statusRows)
      setConditions(conditionRows)
      setCategories(categoryRows)
      setWeaponTypes(weaponTypeRows)
      setCalibres(calibreRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load products."
      setNotice({ type: "error", message })
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    if (!search.trim()) return products
    const q = search.trim().toLowerCase()
    return products.filter((row) => `${row.sku} ${row.name} ${row.brand?.name || ""} ${row.status?.name || ""}`.toLowerCase().includes(q))
  }, [products, search])

  const createProduct = async () => {
    if (!form.sku.trim() || !form.name.trim()) {
      setNotice({ type: "error", message: "SKU and Name are required." })
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      await apiSend<Product>("/api/store-inventory/v2/products", "POST", {
        sku: form.sku.trim(),
        name: form.name.trim(),
        brandId: form.brandId || null,
        unitId: form.unitId || null,
        statusId: form.statusId || null,
        conditionId: form.conditionId || null,
        categoryId: form.categoryId || null,
        weaponTypeId: form.weaponTypeId || null,
        calibreId: form.calibreId || null,
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        serialRequired: form.serialRequired,
      })

      setNotice({ type: "success", message: "Product created successfully." })
      setForm(EMPTY_FORM)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create product."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const removeProduct = async (id: string) => {
    try {
      await apiSend(`/api/store-inventory/v2/products/${id}`, "DELETE")
      setNotice({ type: "success", message: "Product deleted." })
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete product."
      setNotice({ type: "error", message })
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={createMode ? "Create Product" : "Products"}
        subtitle={createMode ? "Create store-inventory v2 products backed by Prisma models." : "Manage and search v2 products."}
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">SKU *</label>
            <input className="ui-input" value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Name *</label>
            <input className="ui-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <Select label="Brand" value={form.brandId} onChange={(value) => setForm((prev) => ({ ...prev, brandId: value }))} options={brands} />
          <Select label="Unit" value={form.unitId} onChange={(value) => setForm((prev) => ({ ...prev, unitId: value }))} options={units} />
          <Select label="Status" value={form.statusId} onChange={(value) => setForm((prev) => ({ ...prev, statusId: value }))} options={statuses} />
          <Select label="Condition" value={form.conditionId} onChange={(value) => setForm((prev) => ({ ...prev, conditionId: value }))} options={conditions} />
          <Select label="Category" value={form.categoryId} onChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))} options={categories} />
          <Select label="Weapon Type" value={form.weaponTypeId} onChange={(value) => setForm((prev) => ({ ...prev, weaponTypeId: value }))} options={weaponTypes} />
          <Select label="Calibre" value={form.calibreId} onChange={(value) => setForm((prev) => ({ ...prev, calibreId: value }))} options={calibres} />
          <div className="xl:col-span-2">
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
            <textarea className="ui-input min-h-[80px]" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="xl:col-span-2">
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Image URL / Base64</label>
            <input className="ui-input" value={form.imageUrl} onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))} />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={form.serialRequired}
            onChange={(e) => setForm((prev) => ({ ...prev, serialRequired: e.target.checked }))}
          />
          Serial Required
        </label>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => void createProduct()} disabled={saving}>{saving ? "Saving..." : "Create Product"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => setForm(EMPTY_FORM)}>Reset</ActionButton>
        </div>
      </FilterBar>

      {!createMode ? (
        <>
          <FilterBar>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
              <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by sku/name/brand" />
            </div>
          </FilterBar>

          <DataTable
            rows={visibleRows}
            rowKey="id"
            searchable={false}
            emptyText={loading ? "Loading products..." : "No products found."}
            columns={[
              { key: "sku", header: "SKU", sortable: true },
              { key: "name", header: "Name", sortable: true },
              { key: "brand", header: "Brand", render: (row) => row.brand?.name || "—" },
              { key: "unit", header: "Unit", render: (row) => row.unit?.name || "—" },
              { key: "category", header: "Category", render: (row) => row.category?.name || "—" },
              { key: "weaponType", header: "Weapon Type", render: (row) => row.weaponType?.name || "—" },
              { key: "calibre", header: "Calibre", render: (row) => row.calibre?.name || "—" },
              { key: "status", header: "Status", render: (row) => row.status?.name || "—" },
              { key: "condition", header: "Condition", render: (row) => row.condition?.name || "—" },
              { key: "serialRequired", header: "Serial", render: (row) => (row.serialRequired ? "Yes" : "No") },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <button className="text-red-600 hover:underline" onClick={() => void removeProduct(row.id)}>
                    Delete
                  </button>
                ),
              },
            ]}
          />
        </>
      ) : null}
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
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}
