"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type Option = { id: string; name: string }
type Product = { id: string; sku: string; name: string }
type User = { id: string; name: string; email: string; role?: { name: string } | null }

type Assignment = {
  id: string
  quantity: number
  status: string
  assignedAt: string
  returnedAt?: string | null
  store: Option
  product: Product
  assignedToUser: User
  assignedByUser: User
  returnedByUser?: User | null
}

const INITIAL_FORM = {
  storeId: "",
  productId: "",
  assignedToUserId: "",
  quantity: "1",
  notes: "",
}

export default function AssignmentsManager({ employeeMode = false }: { employeeMode?: boolean }) {
  const [rows, setRows] = useState<Assignment[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [assignmentRows, storeRows, productRows, userRows] = await Promise.all([
        apiGet<Assignment[]>("/api/store-inventory/v2/assignments"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<Product[]>("/api/store-inventory/v2/products"),
        apiGet<User[]>("/api/users?status=ACTIVE"),
      ])

      setRows(assignmentRows)
      setStores(storeRows)
      setProducts(productRows)
      setUsers(userRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load assignments."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createAssignment = async () => {
    const quantity = Number(form.quantity)
    if (!form.storeId || !form.productId || !form.assignedToUserId || !Number.isFinite(quantity) || quantity <= 0) {
      setNotice({ type: "error", message: "Store, product, assignee and positive quantity are required." })
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      await apiSend<Assignment>("/api/store-inventory/v2/assignments", "POST", {
        storeId: form.storeId,
        productId: form.productId,
        assignedToUserId: form.assignedToUserId,
        quantity,
        notes: form.notes.trim() || null,
      })
      setNotice({ type: "success", message: "Inventory assigned successfully." })
      setForm(INITIAL_FORM)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to assign inventory."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const returnAssignment = async (id: string) => {
    try {
      await apiSend<Assignment>(`/api/store-inventory/v2/assignments/${id}/return`, "POST", {
        status: "RETURNED",
      })
      setNotice({ type: "success", message: "Assignment returned successfully." })
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to return assignment."
      setNotice({ type: "error", message })
    }
  }

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      return `${row.store.name} ${row.product.name} ${row.assignedToUser.name} ${row.status}`.toLowerCase().includes(q)
    })
  }, [rows, search])

  return (
    <div className="space-y-6">
      <SectionTitle
        title={employeeMode ? "Employee Assignments" : "Inventory Assignments"}
        subtitle={employeeMode ? "Assign stock to employees and process returns." : "Checkout and return inventory with transactional stock updates."}
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select label="Store *" value={form.storeId} onChange={(value) => setForm((prev) => ({ ...prev, storeId: value }))} options={stores} />
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Product *</label>
            <select className="ui-select" value={form.productId} onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Assignee *</label>
            <select className="ui-select" value={form.assignedToUserId} onChange={(e) => setForm((prev) => ({ ...prev, assignedToUserId: e.target.value }))}>
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Quantity *</label>
            <input className="ui-input" min={1} type="number" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Notes</label>
            <input className="ui-input" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={() => void createAssignment()} disabled={saving}>{saving ? "Saving..." : "Assign Inventory"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => setForm(INITIAL_FORM)}>Reset</ActionButton>
        </div>
      </FilterBar>

      <FilterBar>
        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
          <input className="ui-input" placeholder="Search by store/product/assignee/status" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </FilterBar>

      <DataTable
        rows={visible}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading assignments..." : "No assignments found."}
        columns={[
          { key: "store", header: "Store", render: (row) => row.store.name },
          { key: "product", header: "Product", render: (row) => `${row.product.sku} - ${row.product.name}` },
          { key: "quantity", header: "Qty", sortable: true },
          { key: "assignedToUser", header: "Assigned To", render: (row) => row.assignedToUser.name, sortable: true },
          { key: "assignedByUser", header: "Assigned By", render: (row) => row.assignedByUser.name },
          { key: "status", header: "Status", sortable: true },
          { key: "assignedAt", header: "Assigned At", render: (row) => new Date(row.assignedAt).toLocaleDateString("en-US") },
          { key: "returnedAt", header: "Returned At", render: (row) => (row.returnedAt ? new Date(row.returnedAt).toLocaleDateString("en-US") : "—") },
          {
            key: "actions",
            header: "Actions",
            render: (row) =>
              row.status === "ASSIGNED" ? (
                <button className="text-[var(--brand)] hover:underline" onClick={() => void returnAssignment(row.id)}>
                  Mark Returned
                </button>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">Closed</span>
              ),
          },
        ]}
      />
    </div>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Option[] }) {
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
