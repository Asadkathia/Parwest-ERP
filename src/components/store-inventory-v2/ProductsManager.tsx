"use client"

import Link from "next/link"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { apiGet, apiSend } from "@/components/store-inventory-v2/api"
import { DataTable as ShadcnDataTable } from "@/components/shadcn/data-table"
import { Card, CardContent } from "@/components/shadcn/card"
import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { PermissionGate } from "@/components/shadcn/permission-gate"

type Option = { id: string; name: string }
type RegionOption = { id: string; name: string }
type CategoryOption = Option & { parent?: Option | null }

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
  variation?: Option | null
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
  size: "",
  color: "",
  description: "",
  imageUrl: "",
  serialRequired: false,
}

// Phase 6A: list-only migration. Region picker handled by the global topbar.
// `regions` / `locked` props remain for compat with the screen route signature.
export default function ProductsManager({
  createMode = false,
  regions: _regions = [],
  locked: _locked = false,
}: {
  createMode?: boolean
  regions?: RegionOption[]
  locked?: boolean
}) {
  void _regions
  void _locked
  const [products, setProducts] = useState<Product[]>([])
  const [brands, setBrands] = useState<Option[]>([])
  const [units, setUnits] = useState<Option[]>([])
  const [statuses, setStatuses] = useState<Option[]>([])
  const [conditions, setConditions] = useState<Option[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [weaponTypes, setWeaponTypes] = useState<Option[]>([])
  const [calibres, setCalibres] = useState<Option[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
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
        apiGet<CategoryOption[]>("/api/store-inventory/v2/masters/categories"),
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

  // Phase 6A: search is now handled by ShadcnDataTable's built-in `searchKey`.
  const visibleRows = useMemo(() => products, [products])

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === form.categoryId),
    [categories, form.categoryId],
  )

  const isWeaponCategory = useMemo(() => {
    if (!selectedCategory) return false
    const categoryName = selectedCategory.name.toLowerCase()
    const parentName = (selectedCategory.parent?.name || "").toLowerCase()
    const matches = (n: string) => n.includes("weapon") || n.includes("ammo") || n.includes("ammunition")
    return matches(categoryName) || matches(parentName)
  }, [selectedCategory])

  const generateCode = () => {
    const base = form.name.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase().slice(0, 8)
    const random = Math.random().toString(36).slice(2, 6).toUpperCase()
    const stamp = Date.now().toString(36).slice(-4).toUpperCase()
    const prefix = base || "PRD"
    setForm((prev) => ({ ...prev, sku: `${prefix}-${stamp}${random}` }))
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const startEdit = (row: Product) => {
    const variationParts = row.variation?.name?.split("/") ?? []
    const size = variationParts[0]?.trim() || ""
    const color = variationParts[1]?.trim() || ""

    setEditingId(row.id)
    setForm({
      sku: row.sku || "",
      name: row.name || "",
      brandId: row.brand?.id || "",
      unitId: row.unit?.id || "",
      statusId: row.status?.id || "",
      conditionId: row.condition?.id || "",
      categoryId: row.category?.id || "",
      weaponTypeId: row.weaponType?.id || "",
      calibreId: row.calibre?.id || "",
      size,
      color,
      description: row.description || "",
      imageUrl: row.imageUrl || "",
      serialRequired: row.serialRequired,
    })
  }

  const saveProduct = async () => {
    if (!form.sku.trim() || !form.name.trim()) {
      setNotice({ type: "error", message: "SKU and Name are required." })
      return
    }
    if (isWeaponCategory && (!form.weaponTypeId || !form.calibreId)) {
      setNotice({ type: "error", message: "Weapon Type and Calibre are required for weapon category." })
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        brandId: form.brandId || null,
        unitId: form.unitId || null,
        statusId: form.statusId || null,
        conditionId: form.conditionId || null,
        categoryId: form.categoryId || null,
        weaponTypeId: isWeaponCategory ? form.weaponTypeId || null : null,
        calibreId: isWeaponCategory ? form.calibreId || null : null,
        size: isWeaponCategory ? null : form.size.trim() || null,
        color: isWeaponCategory ? null : form.color.trim() || null,
        variationId: isWeaponCategory ? null : undefined,
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        serialRequired: form.serialRequired,
      }

      if (editingId) {
        await apiSend<Product>(`/api/store-inventory/v2/products/${editingId}`, "PATCH", payload)
      } else {
        await apiSend<Product>("/api/store-inventory/v2/products", "POST", payload)
      }

      const successMessage = editingId ? "Product updated successfully." : "Product created successfully."
      resetForm()
      // load() clears the notice, so set it AFTER the reload completes —
      // otherwise the banner flashes for a frame and disappears.
      await load()
      setNotice({ type: "success", message: successMessage })
    } catch (error) {
      const message = error instanceof Error ? error.message : editingId ? "Failed to update product." : "Failed to create product."
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
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{(createMode ? "Create Product" : "Products")}</h2><p className="mt-1 text-sm text-muted-foreground">{(createMode ? "Create store-inventory v2 products backed by Prisma models." : "Manage and search v2 products.")}</p></div></div>
      {notice ? ((notice.type) === "success" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert> : <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert>) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Name *</label>
            <input className="ui-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">SKU *</label>
            <div className="flex gap-2">
              <input className="ui-input" value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} />
              <Button type="button" onClick={generateCode}>
                Gen-Code
              </Button>
            </div>
          </div>
          <Select
            label="Category"
            value={form.categoryId}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                categoryId: value,
                weaponTypeId: "",
                calibreId: "",
                size: "",
                color: "",
              }))
            }
            options={categories}
            placeholder="Select Category"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Brand" value={form.brandId} onChange={(value) => setForm((prev) => ({ ...prev, brandId: value }))} options={brands} placeholder="Select Brand" />
          <Select label="Unit" value={form.unitId} onChange={(value) => setForm((prev) => ({ ...prev, unitId: value }))} options={units} placeholder="Select Unit" />
          {isWeaponCategory ? (
            <>
              <Select
                label="Weapon Type *"
                value={form.weaponTypeId}
                onChange={(value) => setForm((prev) => ({ ...prev, weaponTypeId: value }))}
                options={weaponTypes}
                placeholder="Select Weapon Type"
              />
              <Select
                label="Calibre *"
                value={form.calibreId}
                onChange={(value) => setForm((prev) => ({ ...prev, calibreId: value }))}
                options={calibres}
                placeholder="Select Calibre"
              />
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Size</label>
                <input className="ui-input" value={form.size} onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Color</label>
                <input className="ui-input" value={form.color} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} />
              </div>
            </>
          )}
          <Select label="Status" value={form.statusId} onChange={(value) => setForm((prev) => ({ ...prev, statusId: value }))} options={statuses} placeholder="Select Status" />
          <Select label="Condition" value={form.conditionId} onChange={(value) => setForm((prev) => ({ ...prev, conditionId: value }))} options={conditions} placeholder="Select Condition" />
          <div className="md:col-span-2 xl:col-span-2">
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
            <textarea className="ui-input min-h-[80px]" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="md:col-span-2 xl:col-span-2">
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
          <Button onClick={() => void saveProduct()} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Product" : "Create Product"}
          </Button>
          <Button variant="secondary" onClick={resetForm}>{editingId ? "Cancel Edit" : "Reset"}</Button>
        </div>
      </CardContent>
      </Card>

      {!createMode ? (
        <>
          {visibleRows.length === 0 && !loading ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted-foreground">No products yet.</p>
                <PermissionGate module="INVENTORY" action="CREATE" mode="hide">
                  <Button asChild size="sm">
                    <Link href="/store-inventory/product-create">Create your first product</Link>
                  </Button>
                </PermissionGate>
              </CardContent>
            </Card>
          ) : (
            <ShadcnDataTable
              data={visibleRows}
              searchKey="name"
              searchPlaceholder="Search by name…"
              emptyMessage={loading ? "Loading products…" : "No products found."}
              columns={[
                { id: "sku", accessorKey: "sku", header: "SKU", cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span> },
                { id: "name", accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
                { id: "brand", header: "Brand", accessorFn: (row) => row.brand?.name || "—" },
                { id: "unit", header: "Unit", accessorFn: (row) => row.unit?.name || "—" },
                { id: "category", header: "Category", accessorFn: (row) => row.category?.name || "—" },
                { id: "variation", header: "Variant", accessorFn: (row) => row.variation?.name || "—" },
                { id: "weaponType", header: "Weapon Type", accessorFn: (row) => row.weaponType?.name || "—" },
                { id: "calibre", header: "Calibre", accessorFn: (row) => row.calibre?.name || "—" },
                {
                  id: "status",
                  header: "Status",
                  cell: ({ row }) =>
                    row.original.status?.name ? (
                      <Badge variant="secondary">{row.original.status.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                { id: "condition", header: "Condition", accessorFn: (row) => row.condition?.name || "—" },
                {
                  id: "serialRequired",
                  header: "Serial",
                  cell: ({ row }) =>
                    row.original.serialRequired ? (
                      <Badge>Required</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                {
                  id: "actions",
                  header: "Actions",
                  enableHiding: false,
                  cell: ({ row }) => (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => startEdit(row.original)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-destructive hover:underline"
                        onClick={() => void removeProduct(row.original.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ),
                },
              ] as ColumnDef<Product>[]}
            />
          )}
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
  placeholder = "Select",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}
