"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type MasterResource =
  | "stores"
  | "vendors"
  | "categories"
  | "brands"
  | "units"
  | "statuses"
  | "conditions"
  | "weapon-types"
  | "calibres"
  | "license-types"
  | "variations"
  | "repairings"

type RegionalOffice = { id: string; name: string }
type Option = { id: string; name: string }

type Row = {
  id: string
  name: string
  contact?: string | null
  companyPhone?: string | null
  contactPerson?: string | null
  contactPersonPhone?: string | null
  code?: string | null
  shortCode?: string | null
  description?: string | null
  type?: string | null
  contactNumber?: string | null
  address?: string | null
  isActive?: boolean
  regionalOfficeId?: string | null
  regionalOffice?: { id: string; name: string } | null
  prefix?: string | null
  isHeadOffice?: boolean
  latitude?: number | null
  longitude?: number | null
  parentId?: string | null
  parent?: { id: string; name: string } | null
  canAssignGuard?: boolean
  canAssignEmployee?: boolean
  canAssignClient?: boolean
  categoryId?: string | null
  category?: { id: string; name: string } | null
}

type Props = {
  resource: MasterResource
  title: string
  subtitle: string
  supportsDescription?: boolean
  supportsStoreFields?: boolean
  supportsUnitShortCode?: boolean
  supportsContact?: boolean
  supportsCategoryFields?: boolean
  supportsVendorFields?: boolean
  supportsStatusCategory?: boolean
}

const EMPTY_FORM = {
  name: "",
  code: "",
  shortCode: "",
  description: "",
  contact: "",
  companyPhone: "",
  contactPerson: "",
  contactPersonPhone: "",
  type: "",
  contactNumber: "",
  address: "",
  regionalOfficeId: "",
  prefix: "",
  isHeadOffice: false,
  latitude: "",
  longitude: "",
  parentId: "",
  canAssignGuard: false,
  canAssignEmployee: false,
  canAssignClient: false,
  categoryId: "",
}

export default function MasterManager({
  resource,
  title,
  subtitle,
  supportsDescription = false,
  supportsStoreFields = false,
  supportsUnitShortCode = false,
  supportsContact = false,
  supportsCategoryFields = false,
  supportsVendorFields = false,
  supportsStatusCategory = false,
}: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [form, setForm] = useState(EMPTY_FORM)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const loadRows = useCallback(async () => {
    setLoading(true)
    setNotice(null)

    try {
      const [masterRows, officeRows, categoryRows] = await Promise.all([
        apiGet<Row[]>(`/api/store-inventory/v2/masters/${resource}`),
        supportsStoreFields ? apiGet<RegionalOffice[]>("/api/regional-offices") : Promise.resolve([]),
        supportsStatusCategory ? apiGet<Option[]>("/api/store-inventory/v2/masters/categories") : Promise.resolve([]),
      ])

      setRows(masterRows)
      setRegionalOffices(officeRows)
      setCategories(categoryRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to load ${title}.`
      setNotice({ type: "error", message })
      setRows([])
      setRegionalOffices([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [resource, supportsStatusCategory, supportsStoreFields, title])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      return (
        row.name.toLowerCase().includes(q) ||
        (row.code || "").toLowerCase().includes(q) ||
        (row.shortCode || "").toLowerCase().includes(q) ||
        (row.contact || "").toLowerCase().includes(q) ||
        (row.description || "").toLowerCase().includes(q) ||
        (row.regionalOffice?.name || "").toLowerCase().includes(q)
      )
    })
  }, [rows, query])

  const startEdit = (row: Row) => {
    setEditingId(row.id)
    setForm({
      name: row.name || "",
      code: row.code || "",
      shortCode: row.shortCode || "",
      description: row.description || "",
      contact: row.contact || "",
      companyPhone: row.companyPhone || "",
      contactPerson: row.contactPerson || "",
      contactPersonPhone: row.contactPersonPhone || "",
      type: row.type || "",
      contactNumber: row.contactNumber || "",
      address: row.address || "",
      regionalOfficeId: row.regionalOfficeId || "",
      prefix: row.prefix || "",
      isHeadOffice: row.isHeadOffice || false,
      latitude: row.latitude != null ? String(row.latitude) : "",
      longitude: row.longitude != null ? String(row.longitude) : "",
      parentId: row.parentId || "",
      canAssignGuard: row.canAssignGuard || false,
      canAssignEmployee: row.canAssignEmployee || false,
      canAssignClient: row.canAssignClient || false,
      categoryId: row.categoryId || "",
    })
  }

  const submit = async () => {
    if (!form.name.trim()) {
      setNotice({ type: "error", message: "Name is required." })
      return
    }

    if (supportsStoreFields && !form.code.trim()) {
      setNotice({ type: "error", message: "Code is required for stores." })
      return
    }

    if (supportsUnitShortCode && !form.shortCode.trim()) {
      setNotice({ type: "error", message: "Short code is required for units." })
      return
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
    }

    if (supportsDescription) payload.description = form.description.trim() || null
    if (supportsContact) payload.contact = form.contact.trim() || null
    if (supportsVendorFields) {
      payload.companyPhone = form.companyPhone.trim() || null
      payload.contactPerson = form.contactPerson.trim() || null
      payload.contactPersonPhone = form.contactPersonPhone.trim() || null
      payload.address = form.address.trim() || null
    }
    if (supportsUnitShortCode) payload.shortCode = form.shortCode.trim()

    if (supportsStoreFields) {
      payload.code = form.code.trim()
      payload.type = form.type.trim() || null
      payload.prefix = form.prefix.trim() || null
      payload.isHeadOffice = form.isHeadOffice
      payload.latitude = form.latitude.trim() ? Number(form.latitude) : null
      payload.longitude = form.longitude.trim() ? Number(form.longitude) : null
      payload.contactNumber = form.contactNumber.trim() || null
      payload.address = form.address.trim() || null
      payload.regionalOfficeId = form.regionalOfficeId || null
      payload.isActive = true
    }
    
    if (supportsCategoryFields) {
      payload.parentId = form.parentId || null
      payload.canAssignGuard = form.canAssignGuard
      payload.canAssignEmployee = form.canAssignEmployee
      payload.canAssignClient = form.canAssignClient
    }

    if (supportsStatusCategory) {
      payload.categoryId = form.categoryId || null
    }

    setSaving(true)
    setNotice(null)

    try {
      if (editingId) {
        await apiSend(`/api/store-inventory/v2/masters/${resource}/${editingId}`, "PATCH", payload)
        setNotice({ type: "success", message: `${title} updated successfully.` })
      } else {
        await apiSend(`/api/store-inventory/v2/masters/${resource}`, "POST", payload)
        setNotice({ type: "success", message: `${title} created successfully.` })
      }

      resetForm()
      await loadRows()
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to save ${title}.`
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await apiSend(`/api/store-inventory/v2/masters/${resource}/${id}`, "DELETE")
      setNotice({ type: "success", message: `${title} deleted successfully.` })
      if (editingId === id) resetForm()
      await loadRows()
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to delete ${title}.`
      setNotice({ type: "error", message })
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title={title} subtitle={subtitle} />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className={`grid grid-cols-1 gap-4 ${supportsStoreFields ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Name *</label>
            <input className="ui-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>

          {supportsUnitShortCode ? (
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Short Code *</label>
              <input className="ui-input" value={form.shortCode} onChange={(e) => setForm((prev) => ({ ...prev, shortCode: e.target.value }))} />
            </div>
          ) : null}

          {supportsDescription ? (
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Description</label>
              <input className="ui-input" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
          ) : null}

          {supportsContact ? (
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Contact</label>
              <input className="ui-input" value={form.contact} onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))} />
            </div>
          ) : null}
          {supportsVendorFields ? (
            <>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Company Phone</label>
                <input className="ui-input" value={form.companyPhone} onChange={(e) => setForm((prev) => ({ ...prev, companyPhone: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Contact Person</label>
                <input className="ui-input" value={form.contactPerson} onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Contact Person Phone</label>
                <input className="ui-input" value={form.contactPersonPhone} onChange={(e) => setForm((prev) => ({ ...prev, contactPersonPhone: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Address</label>
                <input className="ui-input" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
              </div>
            </>
          ) : null}

          {supportsStoreFields ? (
            <>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Code *</label>
                <input className="ui-input" value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Type</label>
                <input className="ui-input" value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))} placeholder="MAIN / REGIONAL" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Regional Office</label>
                <select className="ui-select" value={form.regionalOfficeId} onChange={(e) => setForm((prev) => ({ ...prev, regionalOfficeId: e.target.value }))}>
                  <option value="">Select office</option>
                  {regionalOffices.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Contact Number</label>
                <input className="ui-input" value={form.contactNumber} onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Address</label>
                <input className="ui-input" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Prefix</label>
                <input className="ui-input" value={form.prefix} onChange={(e) => setForm((prev) => ({ ...prev, prefix: e.target.value }))} placeholder="e.g. WH-KHI" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isHeadOffice"
                  checked={form.isHeadOffice}
                  onChange={(e) => setForm((prev) => ({ ...prev, isHeadOffice: e.target.checked }))}
                />
                <label htmlFor="isHeadOffice" className="text-sm text-[var(--text-muted)]">Is Head Office</label>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Latitude</label>
                <input className="ui-input" type="number" step="any" value={form.latitude} onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Longitude</label>
                <input className="ui-input" type="number" step="any" value={form.longitude} onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))} />
              </div>
            </>
          ) : null}

          {supportsCategoryFields ? (
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Parent Category</label>
              <select className="ui-select" value={form.parentId} onChange={(e) => setForm((prev) => ({ ...prev, parentId: e.target.value }))}>
                <option value="">None (Top Level)</option>
                {rows
                  .filter((r) => r.id !== editingId)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
          {supportsCategoryFields ? (
            <div className="md:col-span-2 flex flex-wrap gap-4 pt-6">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={form.canAssignGuard}
                  onChange={(e) => setForm((prev) => ({ ...prev, canAssignGuard: e.target.checked }))}
                />
                Guard
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={form.canAssignEmployee}
                  onChange={(e) => setForm((prev) => ({ ...prev, canAssignEmployee: e.target.checked }))}
                />
                Employee
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={form.canAssignClient}
                  onChange={(e) => setForm((prev) => ({ ...prev, canAssignClient: e.target.checked }))}
                />
                Client
              </label>
            </div>
          ) : null}
          {supportsStatusCategory ? (
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Category</label>
              <select className="ui-select" value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}>
                <option value="">None</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update" : "Create"}
          </ActionButton>
          <ActionButton variant="secondary" onClick={resetForm}>Reset</ActionButton>
        </div>
      </FilterBar>

      <FilterBar>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
          <input className="ui-input" placeholder="Search by name/code/office" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </FilterBar>

      <DataTable
        rows={filtered}
        rowKey="id"
        searchable={false}
        emptyText={loading ? `Loading ${title.toLowerCase()}...` : `No ${title.toLowerCase()} found.`}
        columns={[
          { key: "name", header: "Name", sortable: true },
          ...(supportsStoreFields
            ? [
                { key: "code", header: "Code" },
                { key: "type", header: "Type" },
                { key: "regionalOffice", header: "Regional Office", render: (row: Row) => row.regionalOffice?.name || "—" },
                { key: "prefix", header: "Prefix" },
                { key: "isHeadOffice", header: "H.O", render: (row: Row) => (row.isHeadOffice ? "Yes" : "No") },
              ]
            : []),
          ...(supportsCategoryFields ? [{ key: "parent", header: "Parent", render: (row: Row) => row.parent?.name || "—" }] : []),
          ...(supportsCategoryFields
            ? [
                { key: "canAssignGuard", header: "Guard", render: (row: Row) => (row.canAssignGuard ? "Yes" : "No") },
                { key: "canAssignEmployee", header: "Employee", render: (row: Row) => (row.canAssignEmployee ? "Yes" : "No") },
                { key: "canAssignClient", header: "Client", render: (row: Row) => (row.canAssignClient ? "Yes" : "No") },
              ]
            : []),
          ...(supportsUnitShortCode ? [{ key: "shortCode", header: "Short Code" }] : []),
          ...(supportsContact ? [{ key: "contact", header: "Contact", render: (row: Row) => row.contact || "—" }] : []),
          ...(supportsVendorFields
            ? [
                { key: "companyPhone", header: "Company Phone", render: (row: Row) => row.companyPhone || "—" },
                { key: "contactPerson", header: "Contact Person", render: (row: Row) => row.contactPerson || "—" },
                { key: "contactPersonPhone", header: "Contact Phone", render: (row: Row) => row.contactPersonPhone || "—" },
              ]
            : []),
          ...(supportsStatusCategory ? [{ key: "category", header: "Category", render: (row: Row) => row.category?.name || "—" }] : []),
          ...(supportsDescription ? [{ key: "description", header: "Description", render: (row: Row) => row.description || "—" }] : []),
          {
            key: "actions",
            header: "Actions",
            render: (row: Row) => (
              <div className="flex flex-wrap gap-2">
                <button className="text-[var(--brand)] hover:underline" onClick={() => startEdit(row)}>Edit</button>
                <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>Delete</button>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
