"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import SectionTitle from "@/components/ui/section-title"
import FilterBar from "@/components/ui/filter-bar"
import ActionButton from "@/components/ui/action-button"
import DataTable from "@/components/shared/DataTable"
import InlineAlert from "@/components/ui/inline-alert"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"

type AssignmentType = "GUARD" | "EMPLOYEE" | "CLIENT"
type ProductScope = "NON_WEAPON" | "WEAPON"

type Option = { id: string; name: string }
type InventoryBalance = {
  id: string
  storeId: string
  productId: string
  quantityOnHand: number
  quantityHeld: number
}
type Product = {
  id: string
  sku: string
  name: string
  category?: { id: string; name: string } | null
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
  supervisorId?: string | null
  supervisorName?: string | null
  activeDeployments?: number | null
}

type Deployment = {
  id: string
  guardId: string
  status?: string | null
  shiftType?: string | null
  deploymentType?: string | null
  designation?: string | null
  guard?: { id: string; name?: string | null; parwestId?: string | null } | null
  clientId?: string | null
  branchId?: string | null
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

const INITIAL_RETURN_FORM = {
  assignmentId: "",
  status: "RETURNED",
  returnConditionId: "",
  notes: "",
}

function titleForType(type: AssignmentType, scope: ProductScope): string {
  const prefix = scope === "WEAPON" ? "Weapon " : ""
  if (type === "GUARD") return `${prefix}Guard Inventory Assignment`
  if (type === "CLIENT") return `${prefix}Client Assignment`
  return `${prefix}Employee Inventory Assignment`
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

export default function AssignmentsManager({
  assignmentType = "GUARD",
  productScope = "NON_WEAPON",
}: {
  assignmentType?: AssignmentType
  productScope?: ProductScope
}) {
  const [rows, setRows] = useState<Assignment[]>([])
  const [stores, setStores] = useState<Option[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<ClientBranch[]>([])
  const [activeClientDeployments, setActiveClientDeployments] = useState<Deployment[]>([])
  const [clientManagerName, setClientManagerName] = useState("")
  const [showPreviousAssignments, setShowPreviousAssignments] = useState(false)
  const [, setGuardDeployment] = useState<Deployment | null>(null)
  const [guardSupervisorName, setGuardSupervisorName] = useState("")
  const [form, setForm] = useState(INITIAL_FORM)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [returnDraft, setReturnDraft] = useState(INITIAL_RETURN_FORM)
  const [returning, setReturning] = useState(false)

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
  const previousAssignments = useMemo(() => {
    if (assignmentType !== "CLIENT" || !form.assignedToId) return []
    return rows
      .filter((row) => row.assignedToClient?.id === form.assignedToId)
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())
  }, [assignmentType, form.assignedToId, rows])

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [assignmentRows, storeRows, productRows, conditionRows, userRows, guardRows, clientRows, inventoryRows] = await Promise.all([
        apiGet<Assignment[]>(
          `/api/store-inventory/v2/assignments?assignedToType=${assignmentType}&categoryScope=${productScope}`
        ),
        apiGet<Option[]>("/api/store-inventory/v2/masters/stores"),
        apiGet<Product[]>("/api/store-inventory/v2/products"),
        apiGet<Condition[]>("/api/store-inventory/v2/masters/conditions"),
        apiGet<Employee[]>("/api/users?status=ACTIVE"),
        apiGet<Guard[]>("/api/guards?status=ACTIVE"),
        apiGet<Client[]>("/api/clients?status=ACTIVE"),
        apiGet<Array<InventoryBalance & { store?: { id?: string }; product?: { id?: string } }>>("/api/store-inventory/v2/inventories"),
      ])

      setRows(assignmentRows)
      setStores(storeRows)
      setProducts(productRows)
      setConditions(conditionRows)
      setEmployees(userRows)
      setGuards(guardRows)
      setClients(clientRows)
      setBalances(
        inventoryRows.map((row) => ({
          id: row.id,
          storeId: row.store?.id || row.storeId || "",
          productId: row.product?.id || row.productId || "",
          quantityOnHand: row.quantityOnHand,
          quantityHeld: row.quantityHeld,
        }))
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load assignments."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [assignmentType, productScope])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (assignmentType !== "CLIENT") return
    if (!form.assignedToId) {
      setBranches([])
      setActiveClientDeployments([])
      setClientManagerName("")
      setForm((prev) => ({ ...prev, branchId: "" }))
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const branchRows = await apiGet<ClientBranch[]>(`/api/clients/${encodeURIComponent(form.assignedToId)}/branches`)
        if (!cancelled) {
          setBranches(branchRows)
          setActiveClientDeployments([])
          setClientManagerName("")
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
    if (assignmentType !== "CLIENT" || !form.assignedToId || !form.branchId) {
      setActiveClientDeployments([])
      setClientManagerName("")
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const [deploymentRows, csRows] = await Promise.all([
          apiGet<Deployment[]>("/api/deployments"),
          apiGet<Array<{ supervisor?: { id?: string; name?: string } | null }>>(
            `/api/users/cs-relationships?clientId=${encodeURIComponent(form.assignedToId)}&branchId=${encodeURIComponent(form.branchId)}`
          ),
        ])

        if (!cancelled) {
          const active = deploymentRows.filter(
            (row) =>
              row.clientId === form.assignedToId &&
              row.branchId === form.branchId &&
              String(row.status || "").toUpperCase() === "ACTIVE"
          )
          setActiveClientDeployments(active)
        }

        const supervisorId = csRows[0]?.supervisor?.id
        if (!supervisorId) {
          if (!cancelled) setClientManagerName("")
          return
        }

        const msRows = await apiGet<Array<{ manager?: { id?: string; name?: string } | null }>>(
          `/api/users/ms-relationships?supervisorId=${encodeURIComponent(supervisorId)}`
        )
        if (!cancelled) setClientManagerName(msRows[0]?.manager?.name || "")
      } catch {
        if (!cancelled) {
          setActiveClientDeployments([])
          setClientManagerName("")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assignmentType, form.assignedToId, form.branchId])

  useEffect(() => {
    if (assignmentType !== "GUARD") return
    if (!form.assignedToId) {
      setGuardDeployment(null)
      setGuardSupervisorName("")
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [deploymentRows, supervisorRows] = await Promise.all([
          apiGet<Deployment[]>("/api/deployments"),
          apiGet<{ supervisorName?: string | null }>(
            `/api/guards/${encodeURIComponent(form.assignedToId)}/supervisor`
          ).catch(() => ({ supervisorName: null })),
        ])
        const active = deploymentRows.find(
          (row) => row.guardId === form.assignedToId && String(row.status || "").toUpperCase() === "ACTIVE"
        )
        if (!cancelled) {
          setGuardDeployment(active || null)
          setGuardSupervisorName((supervisorRows as { supervisorName?: string | null }).supervisorName || "")
        }
      } catch {
        if (!cancelled) {
          setGuardDeployment(null)
          setGuardSupervisorName("")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assignmentType, form.assignedToId])



  const scopedProducts = useMemo(() => {
    return products.filter((product) => {
      const category = String(product.category?.name ?? "").toLowerCase()
      const isWeaponOrAmmo = category.includes("weapon") || category.includes("ammo")
      return productScope === "WEAPON" ? isWeaponOrAmmo : !isWeaponOrAmmo
    })
  }, [products, productScope])

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
    for (const line of lines) {
      const stock = inventoryFor(form.storeId, line.productId)
      if (line.quantity > stock.available) {
        const product = products.find((row) => row.id === line.productId)
        setNotice({
          type: "error",
          message: `${product?.name || "Selected product"} exceeds available new stock (${stock.available}).`,
        })
        return
      }
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
        categoryScope: productScope,
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

  const openReturnModal = (id: string) => {
    setReturnDraft({
      assignmentId: id,
      status: "RETURNED",
      returnConditionId: "",
      notes: "",
    })
  }

  const closeReturnModal = () => {
    setReturnDraft(INITIAL_RETURN_FORM)
  }

  const returnAssignment = async () => {
    if (!returnDraft.assignmentId) return
    setReturning(true)
    try {
      await apiSend<Assignment>(`/api/store-inventory/v2/assignments/${returnDraft.assignmentId}/return`, "POST", {
        status: returnDraft.status,
        returnConditionId: returnDraft.returnConditionId || null,
        notes: returnDraft.notes.trim() || null,
      })
      setNotice({ type: "success", message: "Assignment closed successfully." })
      closeReturnModal()
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to return assignment."
      setNotice({ type: "error", message })
    } finally {
      setReturning(false)
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
      <SectionTitle
        title={titleForType(assignmentType, productScope)}
        subtitle={`Staging-aligned ${productScope === "WEAPON" ? "weapon " : ""}${assigneeLabel(assignmentType).toLowerCase()} assignment flow.`}
      />
      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <FilterBar className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SearchableCombobox
            label="Select Store *"
            value={form.storeId}
            onChange={(value) => setForm((prev) => ({ ...prev, storeId: value }))}
            options={stores}
            placeholder="Search stores..."
          />
          <SearchableCombobox
            label={assignmentType === "GUARD" ? "Search Guard" : assignmentType === "CLIENT" ? "Select Client" : "Select Employee"}
            value={form.assignedToId}
            onChange={(value) => setForm((prev) => ({ ...prev, assignedToId: value }))}
            options={
              assignmentType === "GUARD"
                ? guards.map((g) => ({ id: g.id, name: `${g.name}${g.parwestId ? ` (${g.parwestId})` : ""}` }))
                : assignmentType === "CLIENT"
                ? clients.map((cl) => ({ id: cl.id, name: cl.type ? `${cl.name} (${cl.type})` : cl.name }))
                : employees.map((e) => ({ id: e.id, name: `${e.name}${e.email ? ` (${e.email})` : ""}` }))
            }
            placeholder={`Search ${assignmentType === "GUARD" ? "guard" : assignmentType === "CLIENT" ? "client" : "employee"}...`}
          />
          {assignmentType === "CLIENT" ? (
            <SearchableCombobox
              label="Select Branch"
              value={form.branchId}
              onChange={(value) => setForm((prev) => ({ ...prev, branchId: value }))}
              options={branches.map((row) => ({ id: row.id, name: row.code ? `${row.name} (${row.code})` : row.name }))}
              placeholder="Search branch..."
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
            <ReadOnlyField label="Guard Supervisor" value={guardSupervisorName || "—"} />
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
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ReadOnlyField label="Manager" value={clientManagerName || "—"} />
              <ReadOnlyField label="Supervisor" value={selectedBranch?.supervisorName || "—"} />
              <ReadOnlyField label="Active Deployment" value={String(activeClientDeployments.length || selectedBranch?.activeDeployments || 0)} />
              <div className="flex items-end">
                <ActionButton variant="secondary" onClick={() => setShowPreviousAssignments(true)}>
                  Show Previous Assignments
                </ActionButton>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-[var(--text-muted)]">Active Deployment ({activeClientDeployments.length})</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                      <th className="p-2">Guard Name</th>
                      <th className="p-2">Deployed As</th>
                      <th className="p-2">Shift</th>
                      <th className="p-2">Deployment Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeClientDeployments.length ? (
                      activeClientDeployments.map((row) => (
                        <tr key={row.id} className="border-b border-[var(--border)]">
                          <td className="p-2">{row.guard?.parwestId ? `${row.guard.parwestId} : ${row.guard?.name || ""}` : row.guard?.name || "—"}</td>
                          <td className="p-2">{row.designation || "Guard"}</td>
                          <td className="p-2">{String(row.shiftType || "—").replaceAll("_", " ")}</td>
                          <td className="p-2">{row.deploymentType || "Regular"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2 text-[var(--text-muted)]" colSpan={4}>No active deployments.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        <div className="space-y-4">
          <div className="font-medium text-[var(--text-muted)]">Products Table *</div>
          {form.lines.map((line, index) => {
            const selectedProduct = lineProduct(products, line.productId)
            const stock = inventoryFor(form.storeId, line.productId)
            return (
            <div key={index} className="grid grid-cols-1 gap-4 items-end border-b border-[var(--border)] pb-4 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Select Product</label>
                <select className="ui-select" value={line.productId} onChange={(e) => updateLine(index, "productId", e.target.value)}>
                  <option value="">Type/select product code</option>
                  {scopedProducts.map((product) => (
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
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Available New</label>
                <input className="ui-input" value={String(stock.available)} readOnly />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[var(--text-muted)]">Available Reusable</label>
                <input className="ui-input" value={String(stock.reusable)} readOnly />
              </div>
              <div className="md:col-span-3">
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
          <ActionButton variant="secondary" onClick={() => { setForm(INITIAL_FORM); }}>Reset</ActionButton>
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
          { key: "returnedAt", header: "Returned At", render: (row) => (row.returnedAt ? new Date(row.returnedAt).toLocaleDateString("en-GB") : "—") },
          {
            key: "actions",
            header: "Action",
            render: (row) =>
              row.status === "ASSIGNED" ? (
                <button className="text-[var(--brand)] hover:underline" onClick={() => openReturnModal(row.id)}>
                  Return
                </button>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">Closed</span>
              ),
          },
        ]}
      />

      {assignmentType === "CLIENT" && showPreviousAssignments ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Already Assignments</h3>
              <button className="text-sm text-[var(--text-muted)] hover:underline" onClick={() => setShowPreviousAssignments(false)}>
                Close
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                    <th className="p-2">Store Inventory</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Assign Date</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previousAssignments.length ? (
                    previousAssignments.map((row) => (
                      <tr key={row.id} className="border-b border-[var(--border)]">
                        <td className="p-2">{row.store.name}</td>
                        <td className="p-2">{row.product.name}</td>
                        <td className="p-2">{new Date(row.assignedAt).toLocaleDateString("en-GB")}</td>
                        <td className="p-2">{row.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-3 text-[var(--text-muted)]" colSpan={4}>No assignments yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {returnDraft.assignmentId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Return Assignment</h3>
              <button className="text-sm text-[var(--text-muted)] hover:underline" onClick={closeReturnModal}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Status</label>
                <select
                  className="ui-select"
                  value={returnDraft.status}
                  onChange={(e) => setReturnDraft((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="RETURNED">Returned</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Revoking Condition</label>
                <select
                  className="ui-select"
                  value={returnDraft.returnConditionId}
                  onChange={(e) => setReturnDraft((prev) => ({ ...prev, returnConditionId: e.target.value }))}
                >
                  <option value="">— Select Condition —</option>
                  {conditions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Remarks</label>
                <textarea
                  className="ui-input min-h-24"
                  placeholder="Optional return remarks"
                  value={returnDraft.notes}
                  onChange={(e) => setReturnDraft((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <ActionButton onClick={() => void returnAssignment()} disabled={returning}>
                  {returning ? "Saving..." : "Submit Return"}
                </ActionButton>
                <ActionButton variant="secondary" onClick={closeReturnModal} disabled={returning}>
                  Cancel
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SearchableCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = "Search...",
}: {
  label: string
  value: string
  onChange: (id: string) => void
  options: Option[]
  placeholder?: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const selected = options.find((o) => o.id === value)
  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div ref={ref} className="relative">
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <div
        className="ui-input flex cursor-pointer items-center justify-between gap-2"
        onClick={() => { setOpen((v) => !v); setQuery("") }}
      >
        <span className={selected ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
          {selected ? selected.name : placeholder}
        </span>
        <svg className="h-4 w-4 shrink-0 text-[var(--text-muted)]" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              autoFocus
              className="ui-input py-1 text-sm"
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setQuery("") }
                if (e.key === "Enter" && filtered.length > 0) {
                  onChange(filtered[0].id)
                  setOpen(false)
                  setQuery("")
                }
              }}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[var(--text-muted)]">No results found</div>
            ) : (
              filtered.map((option) => (
                <div
                  key={option.id}
                  className={`cursor-pointer px-3 py-2 text-sm hover:bg-[var(--primary)]/10 ${option.id === value ? "font-semibold text-[var(--primary)]" : "text-[var(--text)]"}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(option.id)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  {option.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
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
