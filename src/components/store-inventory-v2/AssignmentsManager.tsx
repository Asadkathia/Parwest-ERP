"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type AssignmentType = "GUARD" | "EMPLOYEE" | "CLIENT"

type Option = { id: string; name: string }
type Product = {
  id: string
  sku: string
  name: string
  calibre?: { id: string; name: string } | null
  weaponType?: { id: string; name: string } | null
}
type Condition = { id: string; name: string }

type Employee = {
  id: string
  name: string
  email?: string | null
  role?: { name?: string | null } | null
  region?: { name?: string | null } | null
}

type Guard = {
  id: string
  name: string
  parwestId?: string | null
  cnic?: string | null
  status?: string | null
}

type Client = {
  id: string
  name: string
  type?: string | null
}

type ClientBranch = {
  id: string
  name: string
  code?: string | null
  supervisorName?: string | null
  activeDeployments?: number | null
}

type Deployment = {
  id: string
  guardId: string
  status?: string | null
  branch?: { id: string; name?: string | null; code?: string | null } | null
}

type Assignment = {
  id: string
  quantity: number
  status: string
  assignedAt: string
  returnedAt?: string | null
  assignedToType?: AssignmentType
  store: Option
  product: Product
  condition?: Condition | null
  notes?: string | null
  assignedToUser?: Employee | null
  assignedToGuard?: Guard | null
  assignedToClient?: Client | null
  assignedByUser: { id: string; name: string; email?: string | null }
  returnedByUser?: { id: string; name: string; email?: string | null } | null
}

const today = new Date().toISOString().slice(0, 10)
const INITIAL_FORM = {
  storeId: "",
  assignedToId: "",
  branchId: "",
  assignedAt: today,
  remarks: "",
  lines: [{ productId: "", conditionId: "", quantity: "1", notes: "" }],
}

function titleForType(type: AssignmentType): string {
  if (type === "GUARD") return "Guard Inventory Assignment"
  if (type === "CLIENT") return "Client Assignment"
  return "Employee Inventory Assignment"
}

function assigneeLabel(type: AssignmentType): string {
  if (type === "GUARD") return "Guard"
  if (type === "CLIENT") return "Client"
  return "Employee"
}

function assignmentAssigneeName(row: Assignment): string {
  if (row.assignedToType === "GUARD") return row.assignedToGuard?.name || "—"
  if (row.assignedToType === "CLIENT") return row.assignedToClient?.name || "—"
  return row.assignedToUser?.name || "—"
}

function assignmentAssigneeRef(row: Assignment): string {
  if (row.assignedToType === "GUARD") return row.assignedToGuard?.parwestId || row.assignedToGuard?.cnic || "—"
  if (row.assignedToType === "CLIENT") return row.assignedToClient?.type || "Client"
  return row.assignedToUser?.email || "—"
}

function lineProduct(products: Product[], productId: string): Product | null {
  if (!productId) return null
  return products.find((row) => row.id === productId) || null
}

export default function AssignmentsManager({ assignmentType = "GUARD" }: { assignmentType?: AssignmentType }) {
  const [rows, setRows] = useState<Assignment[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<ClientBranch[]>([])
  const [guardDeployment, setGuardDeployment] = useState<Deployment | null>(null)
  const [assigneeQuery, setAssigneeQuery] = useState("")
  const [form, setForm] = useState(INITIAL_FORM)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const selectedEmployee = useMemo(
    () => (assignmentType === "EMPLOYEE" ? employees.find((row) => row.id === form.assignedToId) || null : null),
    [assignmentType, employees, form.assignedToId]
  )
  const selectedGuard = useMemo(
    () => (assignmentType === "GUARD" ? guards.find((row) => row.id === form.assignedToId) || null : null),
    [assignmentType, guards, form.assignedToId]
  )
  const selectedBranch = useMemo(
    () => (assignmentType === "CLIENT" ? branches.find((row) => row.id === form.branchId) || null : null),
    [assignmentType, branches, form.branchId]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [assignmentRows, storeRows, productRows, conditionRows, userRows, guardRows, clientRows] = await Promise.all([
        apiGet<Assignment[]>(`/api/store-inventory/v2/assignments?assignedToType=${assignmentType}`),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<Product[]>("/api/store-inventory/v2/products"),
        apiGet<Condition[]>("/api/store-inventory/v2/masters/conditions"),
        apiGet<Employee[]>("/api/users?status=ACTIVE"),
        apiGet<Guard[]>("/api/guards?status=ACTIVE"),
        apiGet<Client[]>("/api/clients?status=ACTIVE"),
      ])

      setRows(assignmentRows)
      setStores(storeRows)
      setProducts(productRows)
      setConditions(conditionRows)
      setEmployees(userRows)
      setGuards(guardRows)
      setClients(clientRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load assignments."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [assignmentType])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (assignmentType !== "CLIENT") return
    if (!form.assignedToId) {
      setBranches([])
      setForm((prev) => ({ ...prev, branchId: "" }))
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const branchRows = await apiGet<ClientBranch[]>(`/api/clients/${encodeURIComponent(form.assignedToId)}/branches`)
        if (!cancelled) {
          setBranches(branchRows)
          setForm((prev) => ({
            ...prev,
            branchId: branchRows.some((b) => b.id === prev.branchId) ? prev.branchId : "",
          }))
        }
      } catch {
        if (!cancelled) setBranches([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assignmentType, form.assignedToId])

  useEffect(() => {
    if (assignmentType !== "GUARD") return
    if (!form.assignedToId) {
      setGuardDeployment(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const deploymentRows = await apiGet<Deployment[]>("/api/deployments")
        const active = deploymentRows.find(
          (row) => row.guardId === form.assignedToId && String(row.status || "").toUpperCase() === "ACTIVE"
        )
        if (!cancelled) setGuardDeployment(active || null)
      } catch {
        if (!cancelled) setGuardDeployment(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assignmentType, form.assignedToId])

  const visibleAssignees = useMemo(() => {
    const q = assigneeQuery.trim().toLowerCase()
    if (assignmentType === "GUARD") {
      const source = guards.map((row) => ({
        id: row.id,
        name: `${row.name}${row.parwestId ? ` (${row.parwestId})` : row.cnic ? ` (${row.cnic})` : ""}`,
      }))
      return q ? source.filter((row) => row.name.toLowerCase().includes(q)) : source
    }
    if (assignmentType === "CLIENT") {
      const source = clients.map((row) => ({
        id: row.id,
        name: row.type ? `${row.name} (${row.type})` : row.name,
      }))
      return q ? source.filter((row) => row.name.toLowerCase().includes(q)) : source
    }
    const source = employees.map((row) => ({
      id: row.id,
      name: `${row.name}${row.email ? ` (${row.email})` : ""}`,
    }))
    return q ? source.filter((row) => row.name.toLowerCase().includes(q)) : source
  }, [assignmentType, assigneeQuery, clients, employees, guards])

  const createAssignment = async () => {
    const lines = form.lines.map((line) => ({
      productId: line.productId,
      conditionId: line.conditionId || null,
      quantity: Number(line.quantity),
      notes: line.notes.trim() || null,
    }))

    if (
      !form.storeId ||
      !form.assignedToId ||
      lines.some((line) => !line.productId || !Number.isFinite(line.quantity) || line.quantity <= 0)
    ) {
      setNotice({
        type: "error",
        message: `Store, ${assigneeLabel(assignmentType).toLowerCase()}, and valid product lines are required.`,
      })
      return
    }
    if (assignmentType === "CLIENT" && !form.branchId) {
      setNotice({ type: "error", message: "Branch is required for client assignments." })
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      const branchInfo =
        assignmentType === "CLIENT" && selectedBranch
          ? `branch=${selectedBranch.name}${selectedBranch.code ? `(${selectedBranch.code})` : ""}`
          : null

      const remarks = [form.remarks.trim() || null, branchInfo].filter(Boolean).join(" | ") || null
      const payload: Record<string, unknown> = {
        storeId: form.storeId,
        assignedToType: assignmentType,
        assignedAt: form.assignedAt || today,
        remarks,
        lines,
      }
      if (assignmentType === "GUARD") payload.assignedToGuardId = form.assignedToId
      if (assignmentType === "CLIENT") payload.assignedToClientId = form.assignedToId
      if (assignmentType === "EMPLOYEE") payload.assignedToUserId = form.assignedToId

      await apiSend<Assignment[]>("/api/store-inventory/v2/assignments", "POST", payload)
      setNotice({ type: "success", message: `${assigneeLabel(assignmentType)} assignment created successfully.` })
      setForm(INITIAL_FORM)
      setAssigneeQuery("")
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to assign inventory."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { productId: "", conditionId: "", quantity: "1", notes: "" }],
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

  const returnAssignment = async (id: string) => {
    try {
      await apiSend<Assignment>(`/api/store-inventory/v2/assignments/${id}/return`, "POST", { status: "RETURNED" })
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
    return rows.filter((row) =>
      `${row.store.name} ${row.product.name} ${assignmentAssigneeName(row)} ${row.status} ${row.notes || ""}`
        .toLowerCase()
        .includes(q)
    )
  }, [rows, search])

  return (
    <div className="space-y-6">
      <SectionTitle title={titleForType(assignmentType)} subtitle={`Staging-aligned ${assigneeLabel(assignmentType).toLowerCase()} assignment flow.`} />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Select Store *" value={form.storeId} onChange={(value) => setForm((prev) => ({ ...prev, storeId: value }))} options={stores} />
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">
              {assignmentType === "GUARD" ? "Search Guard" : assignmentType === "CLIENT" ? "Select Client" : "Select Employee"}
            </label>
            <input
              className="ui-input mb-2"
              placeholder={`Type to search ${assigneeLabel(assignmentType).toLowerCase()}`}
              value={assigneeQuery}
              onChange={(e) => setAssigneeQuery(e.target.value)}
            />
            <select className="ui-select" value={form.assignedToId} onChange={(e) => setForm((prev) => ({ ...prev, assignedToId: e.target.value }))}>
              <option value="">Select {assigneeLabel(assignmentType)}</option>
              {visibleAssignees.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
          {assignmentType === "CLIENT" ? (
            <Select
              label="Select Branch"
              value={form.branchId}
              onChange={(value) => setForm((prev) => ({ ...prev, branchId: value }))}
              options={branches.map((row) => ({ id: row.id, name: row.code ? `${row.name} (${row.code})` : row.name }))}
            />
          ) : (
            <div />
          )}
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Assigned At</label>
            <input className="ui-input" type="date" value={form.assignedAt} onChange={(e) => setForm((prev) => ({ ...prev, assignedAt: e.target.value }))} />
          </div>
        </div>

        {assignmentType === "GUARD" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadOnlyField label="Guard Name" value={selectedGuard?.name || ""} />
            <ReadOnlyField label="Guard Status" value={selectedGuard?.status || ""} />
            <ReadOnlyField label="Guard Supervisor" value="—" />
            <ReadOnlyField label="Branch" value={guardDeployment?.branch?.name || ""} />
            <ReadOnlyField label="Branch Code" value={guardDeployment?.branch?.code || ""} />
          </div>
        ) : null}

        {assignmentType === "EMPLOYEE" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadOnlyField label="Employee Name" value={selectedEmployee?.name || ""} />
            <ReadOnlyField label="Employee Parwest ID" value={selectedEmployee?.email || ""} />
            <ReadOnlyField label="Designation" value={selectedEmployee?.role?.name || ""} />
            <ReadOnlyField label="Region" value={selectedEmployee?.region?.name || ""} />
          </div>
        ) : null}

        {assignmentType === "CLIENT" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
            <ReadOnlyField label="Manager/Supervisor" value={selectedBranch?.supervisorName || "—"} />
            <ReadOnlyField label="Active Deployment" value={String(selectedBranch?.activeDeployments ?? 0)} />
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="font-medium text-[var(--text-muted)]">Products Table *</div>
          {form.lines.map((line, index) => {
            const selectedProduct = lineProduct(products, line.productId)
            return (
            <div key={index} className="grid grid-cols-1 gap-4 items-end border-b border-[var(--border)] pb-4 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Select Product</label>
                <select className="ui-select" value={line.productId} onChange={(e) => updateLine(index, "productId", e.target.value)}>
                  <option value="">Type/select product code</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} - {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Product Code</label>
                <input className="ui-input" value={selectedProduct?.sku || ""} readOnly />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Product Name</label>
                <input className="ui-input" value={selectedProduct?.name || ""} readOnly />
              </div>
              {assignmentType === "CLIENT" ? (
                <>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Calibre</label>
                    <input className="ui-input" value={selectedProduct?.calibre?.name || ""} readOnly />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-[var(--text-muted)]">Weapon Type</label>
                    <input className="ui-input" value={selectedProduct?.weaponType?.name || ""} readOnly />
                  </div>
                </>
              ) : null}
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Product Condition</label>
                <select className="ui-select" value={line.conditionId} onChange={(e) => updateLine(index, "conditionId", e.target.value)}>
                  <option value="">Select</option>
                  {conditions.map((condition) => (
                    <option key={condition.id} value={condition.id}>
                      {condition.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Product Quantity</label>
                <input className="ui-input" min={1} type="number" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} />
              </div>
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Notes</label>
                <input className="ui-input" value={line.notes} onChange={(e) => updateLine(index, "notes", e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <button className="text-red-600 hover:text-red-700 p-2 disabled:opacity-30" onClick={() => removeLine(index)} disabled={form.lines.length === 1}>
                  ✕
                </button>
              </div>
            </div>
          )})}
          <ActionButton variant="secondary" onClick={addLine}>+ Add Product</ActionButton>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-muted)]">Remarks</label>
          <textarea className="ui-input min-h-24" value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} />
        </div>

        <div className="flex gap-2">
          <ActionButton onClick={() => void createAssignment()} disabled={saving}>{saving ? "Assigning..." : "Assign Products"}</ActionButton>
          <ActionButton variant="secondary" onClick={() => { setForm(INITIAL_FORM); setAssigneeQuery("") }}>Reset</ActionButton>
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
          { key: "quantity", header: "Product Quantity", sortable: true },
          { key: "condition", header: "Assigning Condition", render: (row) => row.condition?.name || "—" },
          { key: "assigneeName", header: assigneeLabel(assignmentType), render: (row) => assignmentAssigneeName(row) },
          { key: "assigneeRef", header: "Ref", render: (row) => assignmentAssigneeRef(row) },
          { key: "assignedByUser", header: "Assigned By", render: (row) => row.assignedByUser.name },
          { key: "assignedAt", header: "Assigned At", render: (row) => new Date(row.assignedAt).toLocaleDateString("en-GB") },
          { key: "notes", header: "Remarks", render: (row) => row.notes || "—" },
          { key: "returnedAt", header: "Revoked At", render: (row) => (row.returnedAt ? new Date(row.returnedAt).toLocaleDateString("en-GB") : "—") },
          {
            key: "actions",
            header: "Action",
            render: (row) =>
              row.status === "ASSIGNED" ? (
                <button className="text-[var(--brand)] hover:underline" onClick={() => void returnAssignment(row.id)}>
                  Revoke
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" value={value} readOnly />
    </div>
  )
}
