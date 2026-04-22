"use client"

import { type ReactNode, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X as XIcon, Check } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import { Card, CardBody } from "@/components/ui/card"

type Region = {
  id: string
  name: string
}

type GuardDocumentType = {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
  docCategory: string
  isSystemGenerated: boolean
}

type InventoryCategory = {
  id: string
  name: string
}

type DeploymentInventoryRule = {
  id: string
  ruleKey: string
  isActive: boolean
  minimumAssignedItems: number
  allowedCategoryIds: string[]
  updatedAt?: string
}

type Props = {
  regions: Region[]
}

const guardStatuses = [
  { serial: 1, name: "present", color: "green" },
  { serial: 2, name: "absent", color: "yellow" },
  { serial: 3, name: "on-training", color: "red" },
  { serial: 4, name: "default", color: "blue" },
  { serial: 5, name: "resigned", color: "brown" },
  { serial: 6, name: "Long Leave", color: "orange" },
  { serial: 7, name: "Inactive", color: "light" },
  { serial: 8, name: "Pending", color: "teal" },
]

const salaryCategories = [
  { id: 1, name: "A", limit: "35000" },
  { id: 2, name: "B", limit: "50000" },
]

const documentTypes = [
  { name: "CLASS 4TH CERT", number: 10, status: "ACTIVATE" },
  { name: "CNIC ORIGINAL", number: 15, status: "ACTIVATE" },
  { name: "DMC", number: 17, status: "ACTIVATE" },
  { name: "EYE HEALTH CERT", number: 21, status: "ACTIVATE" },
  { name: "SERVICE EXPERIENCE NOTES", number: 23, status: "ACTIVATE" },
]

const allowancesAndDeductions = [
  { factorName: "EOBI", amount: "2360" },
  { factorName: "ESSI", amount: "1500" },
  { factorName: "CWF", amount: "500" },
]

export default function PrerequisitesManager({ regions }: Props) {
  const router = useRouter()
  const [showRegionForm, setShowRegionForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cwfeDeduction, setCwfeDeduction] = useState("")
  const [cwfeDeductions, setCwfeDeductions] = useState<string[]>(["ACTIVATED"])

  // DB-backed document types
  const [docTypes, setDocTypes] = useState<GuardDocumentType[]>([])
  const [docTypesLoading, setDocTypesLoading] = useState(true)
  const [docTypesError, setDocTypesError] = useState("")
  const [showAddDocType, setShowAddDocType] = useState(false)
  const [newDocTypeName, setNewDocTypeName] = useState("")
  const [newDocTypeCategory, setNewDocTypeCategory] = useState<"VERIFICATION" | "ATTACHMENT">("ATTACHMENT")
  const [savingDocType, setSavingDocType] = useState(false)
  const [editingDocType, setEditingDocType] = useState<GuardDocumentType | null>(null)
  const [editDocTypeName, setEditDocTypeName] = useState("")
  const [editDocTypeCategory, setEditDocTypeCategory] = useState<"VERIFICATION" | "ATTACHMENT">("ATTACHMENT")
  const [confirmDeleteDocType, setConfirmDeleteDocType] = useState<GuardDocumentType | null>(null)

  // Guard Designation types
  type DesignationType = { id: string; name: string; isActive: boolean; sortOrder: number }
  const [designationTypes, setDesignationTypes] = useState<DesignationType[]>([])
  const [designationTypesLoading, setDesignationTypesLoading] = useState(true)
  const [designationTypesError, setDesignationTypesError] = useState("")
  const [showAddDesignationType, setShowAddDesignationType] = useState(false)
  const [newDesignationTypeName, setNewDesignationTypeName] = useState("")
  const [savingDesignationType, setSavingDesignationType] = useState(false)
  const [editingDesignationType, setEditingDesignationType] = useState<DesignationType | null>(null)
  const [editDesignationTypeName, setEditDesignationTypeName] = useState("")
  const [confirmDeleteDesignationType, setConfirmDeleteDesignationType] = useState<DesignationType | null>(null)

  // Ex-Service types
  type ExServiceType = { id: string; name: string; isActive: boolean; sortOrder: number }
  const [exServiceTypes, setExServiceTypes] = useState<ExServiceType[]>([])
  const [exServiceTypesLoading, setExServiceTypesLoading] = useState(true)
  const [exServiceTypesError, setExServiceTypesError] = useState("")
  const [showAddExServiceType, setShowAddExServiceType] = useState(false)
  const [newExServiceTypeName, setNewExServiceTypeName] = useState("")
  const [savingExServiceType, setSavingExServiceType] = useState(false)
  const [editingExServiceType, setEditingExServiceType] = useState<ExServiceType | null>(null)
  const [editExServiceTypeName, setEditExServiceTypeName] = useState("")
  const [confirmDeleteExServiceType, setConfirmDeleteExServiceType] = useState<ExServiceType | null>(null)

  // Pledged document types
  type PledgeableDocType = { id: string; name: string; description: string | null }
  const [pledgeTypes, setPledgeTypes] = useState<PledgeableDocType[]>([])
  const [pledgeTypesLoading, setPledgeTypesLoading] = useState(true)
  const [pledgeTypesError, setPledgeTypesError] = useState("")
  const [showAddPledgeType, setShowAddPledgeType] = useState(false)
  const [newPledgeTypeName, setNewPledgeTypeName] = useState("")
  const [newPledgeTypeDesc, setNewPledgeTypeDesc] = useState("")
  const [savingPledgeType, setSavingPledgeType] = useState(false)
  const [editingPledgeType, setEditingPledgeType] = useState<PledgeableDocType | null>(null)
  const [editPledgeTypeName, setEditPledgeTypeName] = useState("")
  const [editPledgeTypeDesc, setEditPledgeTypeDesc] = useState("")
  const [confirmDeletePledgeType, setConfirmDeletePledgeType] = useState<PledgeableDocType | null>(null)

  // Return conditions
  type ReturnCondition = { id: string; name: string; description: string | null }
  const [returnConditions, setReturnConditions] = useState<ReturnCondition[]>([])
  const [returnCondLoading, setReturnCondLoading] = useState(true)
  const [returnCondError, setReturnCondError] = useState("")
  const [showAddReturnCond, setShowAddReturnCond] = useState(false)
  const [newReturnCondName, setNewReturnCondName] = useState("")
  const [newReturnCondDesc, setNewReturnCondDesc] = useState("")
  const [savingReturnCond, setSavingReturnCond] = useState(false)
  const [editingReturnCond, setEditingReturnCond] = useState<ReturnCondition | null>(null)
  const [editReturnCondName, setEditReturnCondName] = useState("")
  const [editReturnCondDesc, setEditReturnCondDesc] = useState("")
  const [confirmDeleteReturnCond, setConfirmDeleteReturnCond] = useState<ReturnCondition | null>(null)

  // Deployment inventory prerequisite rule
  const [inventoryRule, setInventoryRule] = useState<DeploymentInventoryRule | null>(null)
  const [inventoryRuleLoading, setInventoryRuleLoading] = useState(true)
  const [inventoryRuleSaving, setInventoryRuleSaving] = useState(false)
  const [inventoryRuleError, setInventoryRuleError] = useState("")
  const [inventoryRuleNotice, setInventoryRuleNotice] = useState("")
  const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([])


  const loadDocTypes = useCallback(async () => {
    setDocTypesLoading(true)
    setDocTypesError("")
    try {
      const res = await fetch("/api/guard-document-types?activeOnly=false")
      if (!res.ok) throw new Error("Failed to load document types")
      const data = await res.json()
      setDocTypes(data)
    } catch {
      setDocTypesError("Failed to load prerequisite document types")
    } finally {
      setDocTypesLoading(false)
    }
  }, [])

  useEffect(() => { loadDocTypes() }, [loadDocTypes])

  const loadPledgeTypes = useCallback(async () => {
    setPledgeTypesLoading(true)
    setPledgeTypesError("")
    try {
      const res = await fetch("/api/guard-pledgeable-documents")
      if (!res.ok) throw new Error("Failed to load pledged document types")
      setPledgeTypes(await res.json())
    } catch {
      setPledgeTypesError("Failed to load pledged document types")
    } finally {
      setPledgeTypesLoading(false)
    }
  }, [])

  useEffect(() => { loadPledgeTypes() }, [loadPledgeTypes])

  const loadDesignationTypes = useCallback(async () => {
    setDesignationTypesLoading(true)
    setDesignationTypesError("")
    try {
      const res = await fetch("/api/guard-designation-types?activeOnly=false")
      if (!res.ok) throw new Error()
      setDesignationTypes(await res.json())
    } catch {
      setDesignationTypesError("Failed to load designation types")
    } finally {
      setDesignationTypesLoading(false)
    }
  }, [])

  useEffect(() => { loadDesignationTypes() }, [loadDesignationTypes])

  const handleAddDesignationType = async () => {
    const name = newDesignationTypeName.trim()
    if (!name) return
    setSavingDesignationType(true)
    setDesignationTypesError("")
    try {
      const res = await fetch("/api/guard-designation-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) { const d = await res.json(); setDesignationTypesError(d.error || "Failed"); return }
      setNewDesignationTypeName("")
      setShowAddDesignationType(false)
      await loadDesignationTypes()
    } catch {
      setDesignationTypesError("Failed to add designation type")
    } finally {
      setSavingDesignationType(false)
    }
  }

  const handleEditDesignationType = async () => {
    if (!editingDesignationType) return
    const name = editDesignationTypeName.trim()
    if (!name) return
    setSavingDesignationType(true)
    try {
      const res = await fetch(`/api/guard-designation-types/${editingDesignationType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) { const d = await res.json(); setDesignationTypesError(d.error || "Failed"); return }
      setEditingDesignationType(null)
      setEditDesignationTypeName("")
      await loadDesignationTypes()
    } catch {
      setDesignationTypesError("Failed to update designation type")
    } finally {
      setSavingDesignationType(false)
    }
  }

  const handleToggleDesignationType = async (dt: DesignationType) => {
    try {
      await fetch(`/api/guard-designation-types/${dt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !dt.isActive }),
      })
      await loadDesignationTypes()
    } catch {
      setDesignationTypesError("Failed to update designation type")
    }
  }

  const handleDeleteDesignationType = async (dt: DesignationType) => {
    try {
      await fetch(`/api/guard-designation-types/${dt.id}`, { method: "DELETE" })
      setConfirmDeleteDesignationType(null)
      await loadDesignationTypes()
    } catch {
      setDesignationTypesError("Failed to delete designation type")
    }
  }

  const loadExServiceTypes = useCallback(async () => {
    setExServiceTypesLoading(true)
    setExServiceTypesError("")
    try {
      const res = await fetch("/api/guard-ex-service-types?activeOnly=false")
      if (!res.ok) throw new Error()
      setExServiceTypes(await res.json())
    } catch {
      setExServiceTypesError("Failed to load ex-service types")
    } finally {
      setExServiceTypesLoading(false)
    }
  }, [])

  useEffect(() => { loadExServiceTypes() }, [loadExServiceTypes])

  const loadReturnConditions = useCallback(async () => {
    setReturnCondLoading(true)
    setReturnCondError("")
    try {
      const res = await fetch("/api/pledge-return-conditions")
      if (!res.ok) throw new Error()
      setReturnConditions(await res.json())
    } catch {
      setReturnCondError("Failed to load return conditions")
    } finally {
      setReturnCondLoading(false)
    }
  }, [])

  useEffect(() => { loadReturnConditions() }, [loadReturnConditions])

  const loadDeploymentInventoryRule = useCallback(async () => {
    setInventoryRuleLoading(true)
    setInventoryRuleError("")
    try {
      const [ruleRes, categoriesRes] = await Promise.all([
        fetch("/api/guard-deployment-inventory-rule"),
        fetch("/api/store-inventory/v2/masters/categories"),
      ])

      if (!ruleRes.ok) throw new Error("Failed to load deployment inventory rule")
      if (!categoriesRes.ok) throw new Error("Failed to load inventory categories")

      const rulePayload = await ruleRes.json()
      const ruleData = (rulePayload?.data ?? rulePayload) as Partial<DeploymentInventoryRule>

      const categoriesPayload = await categoriesRes.json()
      const categoryRows = Array.isArray(categoriesPayload)
        ? categoriesPayload
        : Array.isArray(categoriesPayload?.data)
          ? categoriesPayload.data
          : []

      const parsedCategories = categoryRows
        .map((row: unknown) => {
          const item = row as Record<string, unknown>
          return {
            id: String(item?.id ?? "").trim(),
            name: String(item?.name ?? "").trim(),
          }
        })
        .filter((row: InventoryCategory) => row.id.length > 0 && row.name.length > 0)

      setInventoryCategories(parsedCategories)
      setInventoryRule({
        id: String(ruleData.id ?? ""),
        ruleKey: String(ruleData.ruleKey ?? "default"),
        isActive: ruleData.isActive === true,
        minimumAssignedItems: Math.max(0, Number(ruleData.minimumAssignedItems ?? 1) || 0),
        allowedCategoryIds: Array.isArray(ruleData.allowedCategoryIds)
          ? ruleData.allowedCategoryIds.map((entry) => String(entry ?? "").trim()).filter((entry) => entry.length > 0)
          : [],
        updatedAt: typeof ruleData.updatedAt === "string" ? ruleData.updatedAt : undefined,
      })
    } catch {
      setInventoryRuleError("Failed to load deployment inventory prerequisite settings")
    } finally {
      setInventoryRuleLoading(false)
    }
  }, [])

  useEffect(() => { loadDeploymentInventoryRule() }, [loadDeploymentInventoryRule])

  const toggleAllowedCategory = (categoryId: string) => {
    setInventoryRule((prev) => {
      if (!prev) return prev
      const has = prev.allowedCategoryIds.includes(categoryId)
      return {
        ...prev,
        allowedCategoryIds: has
          ? prev.allowedCategoryIds.filter((id) => id !== categoryId)
          : [...prev.allowedCategoryIds, categoryId],
      }
    })
  }

  const handleSaveDeploymentInventoryRule = async () => {
    if (!inventoryRule) return
    setInventoryRuleSaving(true)
    setInventoryRuleError("")
    setInventoryRuleNotice("")
    try {
      const res = await fetch("/api/guard-deployment-inventory-rule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: inventoryRule.isActive,
          minimumAssignedItems: Math.max(0, Math.floor(inventoryRule.minimumAssignedItems || 0)),
          allowedCategoryIds: inventoryRule.allowedCategoryIds,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        setInventoryRuleError(payload?.message || payload?.error || "Failed to save deployment inventory prerequisite settings")
        return
      }
      await loadDeploymentInventoryRule()
      setInventoryRuleNotice("Deployment inventory prerequisite settings saved.")
    } catch {
      setInventoryRuleError("Failed to save deployment inventory prerequisite settings")
    } finally {
      setInventoryRuleSaving(false)
    }
  }

  const handleAddReturnCond = async () => {
    const name = newReturnCondName.trim()
    if (!name) return
    setSavingReturnCond(true)
    setReturnCondError("")
    try {
      const res = await fetch("/api/pledge-return-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newReturnCondDesc.trim() || null }),
      })
      if (!res.ok) { const d = await res.json(); setReturnCondError(d.error || "Failed"); return }
      setShowAddReturnCond(false)
      setNewReturnCondName("")
      setNewReturnCondDesc("")
      await loadReturnConditions()
    } catch {
      setReturnCondError("Failed to add return condition")
    } finally {
      setSavingReturnCond(false)
    }
  }

  const handleEditReturnCond = async () => {
    if (!editingReturnCond) return
    const name = editReturnCondName.trim()
    if (!name) return
    setSavingReturnCond(true)
    setReturnCondError("")
    try {
      const res = await fetch(`/api/pledge-return-conditions/${editingReturnCond.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: editReturnCondDesc.trim() || null }),
      })
      if (!res.ok) { const d = await res.json(); setReturnCondError(d.error || "Failed"); return }
      setEditingReturnCond(null)
      await loadReturnConditions()
    } catch {
      setReturnCondError("Failed to update return condition")
    } finally {
      setSavingReturnCond(false)
    }
  }

  const handleDeleteReturnCond = async () => {
    if (!confirmDeleteReturnCond) return
    try {
      await fetch(`/api/pledge-return-conditions/${confirmDeleteReturnCond.id}`, { method: "DELETE" })
      setConfirmDeleteReturnCond(null)
      await loadReturnConditions()
    } catch {
      setReturnCondError("Failed to delete return condition")
    }
  }

  const handleAddExServiceType = async () => {
    const name = newExServiceTypeName.trim().toUpperCase()
    if (!name) return
    setSavingExServiceType(true)
    setExServiceTypesError("")
    try {
      const res = await fetch("/api/guard-ex-service-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) { const d = await res.json(); setExServiceTypesError(d.error || "Failed"); return }
      setNewExServiceTypeName("")
      setShowAddExServiceType(false)
      await loadExServiceTypes()
    } catch {
      setExServiceTypesError("Failed to add ex-service type")
    } finally {
      setSavingExServiceType(false)
    }
  }

  const handleEditExServiceType = async () => {
    if (!editingExServiceType) return
    const name = editExServiceTypeName.trim().toUpperCase()
    if (!name) return
    setSavingExServiceType(true)
    try {
      const res = await fetch(`/api/guard-ex-service-types/${editingExServiceType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) { const d = await res.json(); setExServiceTypesError(d.error || "Failed"); return }
      setEditingExServiceType(null)
      setEditExServiceTypeName("")
      await loadExServiceTypes()
    } catch {
      setExServiceTypesError("Failed to update ex-service type")
    } finally {
      setSavingExServiceType(false)
    }
  }

  const handleToggleExServiceType = async (et: ExServiceType) => {
    try {
      await fetch(`/api/guard-ex-service-types/${et.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !et.isActive }),
      })
      await loadExServiceTypes()
    } catch {
      setExServiceTypesError("Failed to update ex-service type")
    }
  }

  const handleDeleteExServiceType = async (et: ExServiceType) => {
    try {
      await fetch(`/api/guard-ex-service-types/${et.id}`, { method: "DELETE" })
      setConfirmDeleteExServiceType(null)
      await loadExServiceTypes()
    } catch {
      setExServiceTypesError("Failed to delete ex-service type")
    }
  }

  const handleAddPledgeType = async () => {
    const name = newPledgeTypeName.trim()
    if (!name) return
    setSavingPledgeType(true)
    setPledgeTypesError("")
    try {
      const res = await fetch("/api/guard-pledgeable-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newPledgeTypeDesc.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json()
        setPledgeTypesError(d.error || "Failed to add pledged document type")
        return
      }
      setNewPledgeTypeName("")
      setNewPledgeTypeDesc("")
      setShowAddPledgeType(false)
      await loadPledgeTypes()
    } catch {
      setPledgeTypesError("Failed to add pledged document type")
    } finally {
      setSavingPledgeType(false)
    }
  }

  const handleEditPledgeType = async () => {
    if (!editingPledgeType) return
    const name = editPledgeTypeName.trim()
    if (!name) return
    setSavingPledgeType(true)
    setPledgeTypesError("")
    try {
      const res = await fetch(`/api/guard-pledgeable-documents/${editingPledgeType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: editPledgeTypeDesc.trim() || null }),
      })
      if (!res.ok) {
        const d = await res.json()
        setPledgeTypesError(d.error || "Failed to update pledged document type")
        return
      }
      setEditingPledgeType(null)
      setEditPledgeTypeName("")
      setEditPledgeTypeDesc("")
      await loadPledgeTypes()
    } catch {
      setPledgeTypesError("Failed to update pledged document type")
    } finally {
      setSavingPledgeType(false)
    }
  }

  const handleDeletePledgeType = async (pt: { id: string; name: string; description: string | null }) => {
    try {
      const res = await fetch(`/api/guard-pledgeable-documents/${pt.id}`, { method: "DELETE" })
      if (!res.ok) {
        setPledgeTypesError("Failed to delete pledged document type")
        return
      }
      setConfirmDeletePledgeType(null)
      await loadPledgeTypes()
    } catch {
      setPledgeTypesError("Failed to delete pledged document type")
    }
  }

  const handleAddDocType = async () => {
    const name = newDocTypeName.trim()
    if (!name) return
    setSavingDocType(true)
    try {
      const res = await fetch("/api/guard-document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, docCategory: newDocTypeCategory }),
      })
      if (!res.ok) {
        const data = await res.json()
        setDocTypesError(data.message || "Failed to add document type")
        return
      }
      setNewDocTypeName("")
      setShowAddDocType(false)
      await loadDocTypes()
    } catch {
      setDocTypesError("Failed to add document type")
    } finally {
      setSavingDocType(false)
    }
  }

  const handleToggleActive = async (dt: GuardDocumentType) => {
    try {
      const res = await fetch(`/api/guard-document-types/${dt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !dt.isActive }),
      })
      if (!res.ok) {
        setDocTypesError("Failed to update document type")
        return
      }
      await loadDocTypes()
    } catch {
      setDocTypesError("Failed to update document type")
    }
  }

  const handleEditDocType = async () => {
    if (!editingDocType) return
    const name = editDocTypeName.trim()
    if (!name) return
    setSavingDocType(true)
    try {
      const res = await fetch(`/api/guard-document-types/${editingDocType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, docCategory: editDocTypeCategory }),
      })
      if (!res.ok) {
        const data = await res.json()
        setDocTypesError(data.message || "Failed to update document type")
        return
      }
      setEditingDocType(null)
      setEditDocTypeName("")
      setEditDocTypeCategory("ATTACHMENT")
      await loadDocTypes()
    } catch {
      setDocTypesError("Failed to update document type")
    } finally {
      setSavingDocType(false)
    }
  }

  const handleDeleteDocType = async (dt: GuardDocumentType) => {
    try {
      const res = await fetch(`/api/guard-document-types/${dt.id}`, { method: "DELETE" })
      if (!res.ok) {
        setDocTypesError("Failed to delete document type")
        return
      }
      setConfirmDeleteDocType(null)
      await loadDocTypes()
    } catch {
      setDocTypesError("Failed to delete document type")
    }
  }

  const handleAddRegion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    try {
      const response = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name") }),
      })
      if (!response.ok) throw new Error("Failed to create region")
      router.refresh()
      setShowRegionForm(false)
      ;(e.target as HTMLFormElement).reset()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  const addCwfeDeduction = () => {
    const value = cwfeDeduction.trim()
    if (!value) return
    setCwfeDeductions((prev) => [value, ...prev])
    setCwfeDeduction("")
  }

  return (
    <div className="space-y-8">
      {error ? <InlineAlert type="error" message={error} /> : null}

      {/* ── Deployment Inventory Prerequisite ── */}
      <Card>
        <CardBody className="space-y-4">
          <SectionTitle
            title="Deployment Inventory Prerequisite"
            subtitle="Control guard deployment blocking by minimum assigned inventory and optional category restrictions."
          />

          {inventoryRuleError ? <InlineAlert type="error" message={inventoryRuleError} /> : null}
          {inventoryRuleNotice ? <InlineAlert type="success" message={inventoryRuleNotice} /> : null}

          {inventoryRuleLoading || !inventoryRule ? (
            <p className="text-sm text-[var(--text-muted)]">Loading rule settings...</p>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <input
                  type="checkbox"
                  checked={inventoryRule.isActive}
                  onChange={(event) =>
                    setInventoryRule((prev) => prev ? { ...prev, isActive: event.target.checked } : prev)
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-[var(--text)]">
                  Require inventory assignment before deployment
                </span>
              </label>

              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                <div>
                  <label className="mb-1 block text-sm text-[var(--text-muted)]">
                    Minimum assigned items
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={inventoryRule.minimumAssignedItems}
                    onChange={(event) =>
                      setInventoryRule((prev) => {
                        if (!prev) return prev
                        const value = Number(event.target.value)
                        return {
                          ...prev,
                          minimumAssignedItems: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0,
                        }
                      })
                    }
                    className="ui-input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-[var(--text-muted)]">
                    Allowed categories <span className="text-xs font-normal">(optional filter)</span>
                  </label>
                  <div className="max-h-44 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                    {inventoryCategories.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">No categories found.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {inventoryCategories.map((category) => (
                          <label key={category.id} className="flex items-center gap-2 text-sm text-[var(--text)]">
                            <input
                              type="checkbox"
                              checked={inventoryRule.allowedCategoryIds.includes(category.id)}
                              onChange={() => toggleAllowedCategory(category.id)}
                              className="h-4 w-4"
                            />
                            <span>{category.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Leave all unchecked to allow any category.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ActionButton onClick={handleSaveDeploymentInventoryRule} disabled={inventoryRuleSaving}>
                  {inventoryRuleSaving ? "Saving..." : "Save Rule"}
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  onClick={loadDeploymentInventoryRule}
                  disabled={inventoryRuleSaving}
                >
                  Reset
                </ActionButton>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Prerequisite Document Types (DB-backed) ── */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle title="Prerequisite Document Types" subtitle="Configure required documents for guard enrollment. Attachment category → appears in Attachments tab. Verification category → appears in Verifications tab." />
            </div>
            <ActionButton onClick={() => setShowAddDocType((p) => !p)} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Type
            </ActionButton>
          </div>

          {docTypesError ? <InlineAlert type="error" message={docTypesError} /> : null}

          {showAddDocType && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-[var(--text-muted)] mb-1">Document Type Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newDocTypeName}
                  onChange={(e) => setNewDocTypeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddDocType() }}
                  placeholder="e.g., Blood Group Certificate"
                  className="ui-input"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-1">Category <span className="text-red-500">*</span></label>
                <select
                  value={newDocTypeCategory}
                  onChange={(e) => setNewDocTypeCategory(e.target.value as "VERIFICATION" | "ATTACHMENT")}
                  className="ui-input"
                >
                  <option value="VERIFICATION">Verification Document</option>
                  <option value="ATTACHMENT">Attachment Document</option>
                </select>
              </div>
              <ActionButton onClick={handleAddDocType} disabled={savingDocType || !newDocTypeName.trim()}>
                {savingDocType ? "Saving..." : "Save"}
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => { setShowAddDocType(false); setNewDocTypeName(""); setNewDocTypeCategory("ATTACHMENT") }}>Cancel</ActionButton>
            </div>
          )}

          {docTypesLoading ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-4">Loading...</p>
          ) : (() => {
            const systemDocs = docTypes.filter((dt) => dt.isSystemGenerated)
            const adminDocs = docTypes.filter((dt) => !dt.isSystemGenerated)
            return (
              <div className="space-y-4">
                {/* System-Generated (read-only) */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    System-Generated Documents
                    <span className="ml-2 font-normal normal-case text-gray-400">— auto-created for every guard, not editable</span>
                  </p>
                  <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          {["#", "NAME", "CATEGORY"].map((h) => (
                            <th key={h} className="bg-[var(--surface-muted)] px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {systemDocs.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">No system documents found</td></tr>
                        ) : systemDocs.map((dt, idx) => (
                          <tr key={dt.id} className="border-t border-[var(--border)]">
                            <td className="px-4 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                            <td className="px-4 py-2 font-medium text-[var(--text)]">{dt.name}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">
                                Attachment
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Admin-Configured (editable) */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Admin-Configured Document Types
                  </p>
                  <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          {["#", "NAME", "CATEGORY", "STATUS", "ACTIONS"].map((h) => (
                            <th key={h} className="bg-[var(--surface-muted)] px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {adminDocs.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">No admin-configured document types yet</td></tr>
                        ) : adminDocs.map((dt, idx) => (
                          <tr key={dt.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                            <td className="px-4 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                            <td className="px-4 py-2 font-medium">{dt.name}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                dt.docCategory === "VERIFICATION"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}>
                                {dt.docCategory === "VERIFICATION" ? "Verification" : "Attachment"}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${dt.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                                {dt.isActive ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setEditingDocType(dt); setEditDocTypeName(dt.name); setEditDocTypeCategory((dt.docCategory as "VERIFICATION" | "ATTACHMENT") || "VERIFICATION") }}
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  onClick={() => handleToggleActive(dt)}
                                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${dt.isActive ? "text-orange-700 hover:bg-orange-50" : "text-green-700 hover:bg-green-50"}`}
                                >
                                  {dt.isActive ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteDocType(dt)}
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}
        </CardBody>
      </Card>

      {/* ── Guard Statuses ── */}
      <Card>
        <CardBody className="space-y-4">
          <div>
            <SectionTitle title="Guard Statuses" subtitle="Legacy merged options and deduction prerequisites." />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-2 block text-sm text-[var(--text-muted)]">Add CWFE deduction</label>
              <input
                type="text"
                value={cwfeDeduction}
                onChange={(e) => setCwfeDeduction(e.target.value)}
                placeholder="Enter CWFE deduction status"
                className="ui-input"
              />
            </div>
            <div className="self-end">
              <ActionButton onClick={addCwfeDeduction}>Add</ActionButton>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {cwfeDeductions.map((status) => (
              <span key={status} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {status}
              </span>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <SectionTitle title="Salary Categories" subtitle="Reference values — configurable via system settings." />
          <SimpleTable
            headers={["ID#", "NAME", "LIMIT"]}
            rows={salaryCategories.map((row) => [row.id, row.name, row.limit])}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <HeaderWithAdd title="All Guard&apos;s Document Types" />
          <SimpleTable
            headers={["NAME", "DOCUMENT #", "ACTION", "STATUS"]}
            rows={documentTypes.map((row) => [row.name, row.number, "✎", row.status])}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <SectionTitle title="Allowances &amp; Deductions" subtitle="Reference values — configurable via system settings." />
          <SimpleTable
            headers={["FACTOR NAME", "AMOUNT"]}
            rows={allowancesAndDeductions.map((row) => [row.factorName, row.amount])}
          />
        </CardBody>
      </Card>

      {/* ── Guard Designation Types ── */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle title="Guard Designation Types" subtitle="Configure the list of designations shown in the Branch Contract section when adding/editing clients and branches." />
            </div>
            <ActionButton onClick={() => { setShowAddDesignationType((p) => !p); setNewDesignationTypeName("") }} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Type
            </ActionButton>
          </div>

          {designationTypesError ? <InlineAlert type="error" message={designationTypesError} /> : null}

          {showAddDesignationType && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-[var(--text-muted)] mb-1">Designation Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newDesignationTypeName}
                  onChange={(e) => setNewDesignationTypeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddDesignationType() }}
                  placeholder="e.g., Armed Guard, Receptionist"
                  className="ui-input"
                />
              </div>
              <ActionButton onClick={handleAddDesignationType} disabled={savingDesignationType || !newDesignationTypeName.trim()}>
                {savingDesignationType ? "Saving..." : "Save"}
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => { setShowAddDesignationType(false); setNewDesignationTypeName("") }}>Cancel</ActionButton>
            </div>
          )}

          {designationTypesLoading ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-4">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["#", "DESIGNATION NAME", "STATUS", "ACTIONS"].map((h) => (
                      <th key={h} className="bg-[var(--surface-muted)] px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {designationTypes.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">No types yet — defaults will be created on first use</td></tr>
                  ) : designationTypes.map((dt, idx) => (
                    <tr key={dt.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-[var(--text)]">{dt.name}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${dt.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {dt.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingDesignationType(dt); setEditDesignationTypeName(dt.name) }}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleToggleDesignationType(dt)}
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${dt.isActive ? "text-orange-700 hover:bg-orange-50" : "text-green-700 hover:bg-green-50"}`}
                          >
                            {dt.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteDesignationType(dt)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Edit designation type modal */}
      {editingDesignationType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-base font-semibold">Edit Designation Type</h3>
              <button onClick={() => setEditingDesignationType(null)} className="text-gray-400 hover:text-gray-600"><XIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Designation Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editDesignationTypeName}
                  onChange={(e) => setEditDesignationTypeName(e.target.value)}
                  className="ui-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <ActionButton variant="secondary" onClick={() => setEditingDesignationType(null)}>Cancel</ActionButton>
              <ActionButton onClick={handleEditDesignationType} disabled={savingDesignationType || !editDesignationTypeName.trim()}>
                {savingDesignationType ? "Saving..." : "Save"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete designation type confirm */}
      {confirmDeleteDesignationType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-base font-semibold text-red-700">Delete Designation Type</h3>
              <button onClick={() => setConfirmDeleteDesignationType(null)} className="text-gray-400 hover:text-gray-600"><XIcon className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5 text-sm text-[var(--text-muted)]">
              Are you sure you want to delete <strong>{confirmDeleteDesignationType.name}</strong>? This cannot be undone.
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <ActionButton variant="secondary" onClick={() => setConfirmDeleteDesignationType(null)}>Cancel</ActionButton>
              <button
                onClick={() => handleDeleteDesignationType(confirmDeleteDesignationType)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ex-Service Types ── */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle title="Ex-Servicemen Types" subtitle="Configure the list of ex-service branches shown during guard enrollment. Guards not matching any type are treated as Civilian." />
            </div>
            <ActionButton onClick={() => { setShowAddExServiceType((p) => !p); setNewExServiceTypeName("") }} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Type
            </ActionButton>
          </div>

          {exServiceTypesError ? <InlineAlert type="error" message={exServiceTypesError} /> : null}

          {showAddExServiceType && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-[var(--text-muted)] mb-1">Type Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newExServiceTypeName}
                  onChange={(e) => setNewExServiceTypeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddExServiceType() }}
                  placeholder="e.g., NAVY, AIR FORCE"
                  className="ui-input"
                />
              </div>
              <ActionButton onClick={handleAddExServiceType} disabled={savingExServiceType || !newExServiceTypeName.trim()}>
                {savingExServiceType ? "Saving..." : "Save"}
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => { setShowAddExServiceType(false); setNewExServiceTypeName("") }}>Cancel</ActionButton>
            </div>
          )}

          {exServiceTypesLoading ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-4">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["#", "TYPE NAME", "STATUS", "ACTIONS"].map((h) => (
                      <th key={h} className="bg-[var(--surface-muted)] px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exServiceTypes.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">No types yet — defaults will be created on first use</td></tr>
                  ) : exServiceTypes.map((et, idx) => (
                    <tr key={et.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-[var(--text)]">{et.name}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${et.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {et.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingExServiceType(et); setEditExServiceTypeName(et.name) }}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleToggleExServiceType(et)}
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${et.isActive ? "text-orange-700 hover:bg-orange-50" : "text-green-700 hover:bg-green-50"}`}
                          >
                            {et.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteExServiceType(et)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Edit ex-service type modal */}
      {editingExServiceType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-base font-semibold">Edit Ex-Service Type</h3>
              <button onClick={() => setEditingExServiceType(null)} className="text-gray-400 hover:text-gray-600"><XIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Type Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editExServiceTypeName}
                  onChange={(e) => setEditExServiceTypeName(e.target.value)}
                  className="ui-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <ActionButton variant="secondary" onClick={() => setEditingExServiceType(null)}>Cancel</ActionButton>
              <ActionButton onClick={handleEditExServiceType} disabled={savingExServiceType || !editExServiceTypeName.trim()}>
                {savingExServiceType ? "Saving..." : "Save"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete ex-service type confirm */}
      {confirmDeleteExServiceType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-base font-semibold text-red-700">Delete Ex-Service Type</h3>
              <button onClick={() => setConfirmDeleteExServiceType(null)} className="text-gray-400 hover:text-gray-600"><XIcon className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5 text-sm text-[var(--text-muted)]">
              Are you sure you want to delete <strong>{confirmDeleteExServiceType.name}</strong>? This cannot be undone.
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <ActionButton variant="secondary" onClick={() => setConfirmDeleteExServiceType(null)}>Cancel</ActionButton>
              <button
                onClick={() => handleDeleteExServiceType(confirmDeleteExServiceType)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pledged Document Types ── */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle title="Pledged Document Types" subtitle="Configure the types of documents that guards can pledge (hand over to the company for safekeeping)." />
            </div>
            <ActionButton onClick={() => { setShowAddPledgeType((p) => !p); setNewPledgeTypeName(""); setNewPledgeTypeDesc("") }} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Type
            </ActionButton>
          </div>

          {pledgeTypesError ? <InlineAlert type="error" message={pledgeTypesError} /> : null}

          {showAddPledgeType && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-[var(--text-muted)] mb-1">Document Type Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newPledgeTypeName}
                  onChange={(e) => setNewPledgeTypeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPledgeType() }}
                  placeholder="e.g., CNIC Original"
                  className="ui-input"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-[var(--text-muted)] mb-1">Description <span className="text-xs font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={newPledgeTypeDesc}
                  onChange={(e) => setNewPledgeTypeDesc(e.target.value)}
                  placeholder="Brief description"
                  className="ui-input"
                />
              </div>
              <ActionButton onClick={handleAddPledgeType} disabled={savingPledgeType || !newPledgeTypeName.trim()}>
                {savingPledgeType ? "Saving..." : "Save"}
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => { setShowAddPledgeType(false); setNewPledgeTypeName(""); setNewPledgeTypeDesc("") }}>Cancel</ActionButton>
            </div>
          )}

          {pledgeTypesLoading ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-4">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["#", "NAME", "DESCRIPTION", "ACTIONS"].map((h) => (
                      <th key={h} className="bg-[var(--surface-muted)] px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pledgeTypes.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">No pledged document types configured yet</td></tr>
                  ) : pledgeTypes.map((pt, idx) => (
                    <tr key={pt.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-[var(--text)]">{pt.name}</td>
                      <td className="px-4 py-2 text-[var(--text-muted)]">{pt.description || "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingPledgeType(pt); setEditPledgeTypeName(pt.name); setEditPledgeTypeDesc(pt.description || "") }}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeletePledgeType(pt)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Pledge Return Conditions ── */}
      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center justify-between">
            <SectionTitle title="Pledge Return Conditions" subtitle="Configure conditions that can be selected when a pledged document is temporarily issued back to a guard." />
            <button
              onClick={() => { setShowAddReturnCond(true); setNewReturnCondName(""); setNewReturnCondDesc("") }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Condition
            </button>
          </div>

          {returnCondError ? <InlineAlert type="error" message={returnCondError} /> : null}

          {showAddReturnCond && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-3">
              <div>
                <label className="ui-label">Condition Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="e.g., Medical Emergency, Court Requirement"
                  value={newReturnCondName}
                  onChange={(e) => setNewReturnCondName(e.target.value)}
                />
              </div>
              <div>
                <label className="ui-label">Description <span className="text-xs font-normal text-[var(--text-muted)]">(optional)</span></label>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="Brief description"
                  value={newReturnCondDesc}
                  onChange={(e) => setNewReturnCondDesc(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddReturnCond}
                  disabled={savingReturnCond || !newReturnCondName.trim()}
                  className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {savingReturnCond ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setShowAddReturnCond(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {returnCondLoading ? (
            <p className="py-4 text-center text-sm text-[var(--text-muted)]">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                    {["#", "Condition", "Description", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {returnConditions.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">No return conditions configured yet</td></tr>
                  ) : returnConditions.map((rc, idx) => (
                    <tr key={rc.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-[var(--text)]">
                        {editingReturnCond?.id === rc.id ? (
                          <input
                            type="text"
                            className="ui-input"
                            value={editReturnCondName}
                            onChange={(e) => setEditReturnCondName(e.target.value)}
                          />
                        ) : rc.name}
                      </td>
                      <td className="px-4 py-2 text-[var(--text-muted)]">
                        {editingReturnCond?.id === rc.id ? (
                          <input
                            type="text"
                            className="ui-input"
                            value={editReturnCondDesc}
                            onChange={(e) => setEditReturnCondDesc(e.target.value)}
                          />
                        ) : (rc.description || "—")}
                      </td>
                      <td className="px-4 py-2">
                        {editingReturnCond?.id === rc.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={handleEditReturnCond}
                              disabled={savingReturnCond}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                            >
                              <Check className="h-3 w-3" /> Save
                            </button>
                            <button
                              onClick={() => setEditingReturnCond(null)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              <XIcon className="h-3 w-3" /> Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditingReturnCond(rc); setEditReturnCondName(rc.name); setEditReturnCondDesc(rc.description || "") }}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                            <button
                              onClick={() => setConfirmDeleteReturnCond(rc)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Delete Return Condition Confirm ── */}
      {confirmDeleteReturnCond && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-[var(--border)] p-6 space-y-4">
            <p className="font-semibold text-[var(--text)]">Delete Return Condition</p>
            <p className="text-sm text-[var(--text-muted)]">Delete <strong>{confirmDeleteReturnCond.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteReturnCond(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={handleDeleteReturnCond}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center justify-between">
            <SectionTitle title="Regions" subtitle="Manage region master list for guard workflows." />
            <ActionButton onClick={() => setShowRegionForm((p) => !p)} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Region
            </ActionButton>
          </div>

          {showRegionForm ? (
            <form onSubmit={handleAddRegion} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Region Name <span className="text-red-500">*</span>
              </label>
              <input type="text" name="name" required placeholder="e.g., Punjab, Sindh, KPK" className="ui-input" />
              <div className="flex gap-2 mt-4">
                <ActionButton type="submit" disabled={loading}>{loading ? "Saving..." : "Save Region"}</ActionButton>
                <ActionButton type="button" variant="secondary" onClick={() => setShowRegionForm(false)}>Cancel</ActionButton>
              </div>
            </form>
          ) : null}

          <div className="space-y-2">
            {regions.length === 0 ? (
              <p className="text-[var(--text-muted)] text-center py-8">No regions added yet</p>
            ) : (
              regions.map((region) => (
                <div key={region.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 hover:bg-[var(--surface-muted)]">
                  <p className="font-medium">{region.name}</p>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <div className="space-y-4">
            <HeaderWithAdd title="Guard Statuses" />
            <SimpleTable
              headers={["SERIAL NUMBER", "NAME", "COLOR", "ACTION"]}
              rows={guardStatuses.map((row) => [row.serial, row.name, row.color, "✎"])}
            />
          </div>

        </CardBody>
      </Card>

      {/* Edit Doc Type Modal */}
      {editingDocType ? (
        <ConfirmDialog
          title="Edit Document Type"
          customContent={
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Name</label>
                <input
                  value={editDocTypeName}
                  onChange={(e) => setEditDocTypeName(e.target.value)}
                  className="ui-input"
                  onKeyDown={(e) => { if (e.key === "Enter") handleEditDocType() }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Category</label>
                <select
                  value={editDocTypeCategory}
                  onChange={(e) => setEditDocTypeCategory(e.target.value as "VERIFICATION" | "ATTACHMENT")}
                  className="ui-input"
                >
                  <option value="VERIFICATION">Verification Document</option>
                  <option value="ATTACHMENT">Attachment Document</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Verification docs appear in the Verification tab and affect guard status. Attachment docs appear in the Attachments tab only.
                </p>
              </div>
            </div>
          }
          onNo={() => { setEditingDocType(null); setEditDocTypeName(""); setEditDocTypeCategory("VERIFICATION") }}
          onYes={handleEditDocType}
          yesText={savingDocType ? "Saving..." : "Save"}
          noText="Cancel"
        />
      ) : null}

      {/* Delete Confirm Modal */}
      {confirmDeleteDocType ? (
        <ConfirmDialog
          title="Delete Document Type"
          message={`Are you sure you want to delete "${confirmDeleteDocType.name}"? This will remove it from all guard prerequisite records.`}
          onNo={() => setConfirmDeleteDocType(null)}
          onYes={() => handleDeleteDocType(confirmDeleteDocType)}
          yesText="Delete"
          noText="Cancel"
        />
      ) : null}

      {/* Edit Pledged Document Type Modal */}
      {editingPledgeType ? (
        <ConfirmDialog
          title="Edit Pledged Document Type"
          customContent={
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Name <span className="text-red-500">*</span></label>
                <input
                  value={editPledgeTypeName}
                  onChange={(e) => setEditPledgeTypeName(e.target.value)}
                  className="ui-input"
                  onKeyDown={(e) => { if (e.key === "Enter") handleEditPledgeType() }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Description <span className="text-xs font-normal">(optional)</span></label>
                <input
                  value={editPledgeTypeDesc}
                  onChange={(e) => setEditPledgeTypeDesc(e.target.value)}
                  className="ui-input"
                  placeholder="Brief description"
                />
              </div>
            </div>
          }
          onNo={() => { setEditingPledgeType(null); setEditPledgeTypeName(""); setEditPledgeTypeDesc("") }}
          onYes={handleEditPledgeType}
          yesText={savingPledgeType ? "Saving..." : "Save"}
          noText="Cancel"
        />
      ) : null}

      {/* Delete Pledged Document Type Confirm Modal */}
      {confirmDeletePledgeType ? (
        <ConfirmDialog
          title="Delete Pledged Document Type"
          message={`Are you sure you want to delete "${confirmDeletePledgeType.name}"?`}
          onNo={() => setConfirmDeletePledgeType(null)}
          onYes={() => handleDeletePledgeType(confirmDeletePledgeType)}
          yesText="Delete"
          noText="Cancel"
        />
      ) : null}
    </div>
  )
}

function HeaderWithAdd({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
      <ActionButton variant="secondary" className="inline-flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Add
      </ActionButton>
    </div>
  )
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: Array<Array<string | number | ReactNode>>
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="bg-[var(--surface-muted)] px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
              {row.map((cell, cellIndex) => (
                <td key={`cell-${index}-${cellIndex}`} className="px-4 py-2 text-[var(--text)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConfirmDialog({
  title,
  message,
  customContent,
  onYes,
  onNo,
  yesText = "Yes",
  noText = "No",
}: {
  title: string
  message?: string
  customContent?: ReactNode
  onYes: () => void | Promise<void>
  onNo: () => void
  yesText?: string
  noText?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-md)]">
        <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
        {message ? <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p> : null}
        {customContent ? <div className="mt-3">{customContent}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <ActionButton variant="secondary" onClick={onNo}>{noText}</ActionButton>
          <ActionButton onClick={onYes}>{yesText}</ActionButton>
        </div>
      </div>
    </div>
  )
}
