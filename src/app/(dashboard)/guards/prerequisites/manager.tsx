"use client"

import { type ReactNode, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2 } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import { Card, CardBody } from "@/components/ui/card"

type Region = {
  id: string
  name: string
}

type RegionalOffice = {
  id: string
  name: string
  seriesCode: string
  regionId: string
  region: { id: string; name: string }
}

type GuardDocumentType = {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
}

type Props = {
  regions: Region[]
  regionalOffices: RegionalOffice[]
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

export default function PrerequisitesManager({ regions, regionalOffices }: Props) {
  const router = useRouter()
  const [showRegionForm, setShowRegionForm] = useState(false)
  const [showOfficeForm, setShowOfficeForm] = useState(false)
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
  const [savingDocType, setSavingDocType] = useState(false)
  const [editingDocType, setEditingDocType] = useState<GuardDocumentType | null>(null)
  const [editDocTypeName, setEditDocTypeName] = useState("")
  const [confirmDeleteDocType, setConfirmDeleteDocType] = useState<GuardDocumentType | null>(null)

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

  const handleAddDocType = async () => {
    const name = newDocTypeName.trim()
    if (!name) return
    setSavingDocType(true)
    try {
      const res = await fetch("/api/guard-document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json()
        setDocTypesError(data.error || "Failed to add document type")
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
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json()
        setDocTypesError(data.error || "Failed to update document type")
        return
      }
      setEditingDocType(null)
      setEditDocTypeName("")
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

  const handleAddOffice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    try {
      const response = await fetch("/api/regional-offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          seriesCode: formData.get("seriesCode"),
          regionId: formData.get("regionId"),
        }),
      })
      if (!response.ok) throw new Error("Failed to create regional office")
      router.refresh()
      setShowOfficeForm(false)
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

      {/* ── Prerequisite Document Types (DB-backed) ── */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle title="Prerequisite Document Types" subtitle="Configure the required documents for guard enrollment. These appear in the Add Guard form and guard attachments/verification tabs." />
            </div>
            <ActionButton onClick={() => setShowAddDocType((p) => !p)} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Type
            </ActionButton>
          </div>

          {docTypesError ? <InlineAlert type="error" message={docTypesError} /> : null}

          {showAddDocType && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 flex gap-3 items-end">
              <div className="flex-1">
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
              <ActionButton onClick={handleAddDocType} disabled={savingDocType || !newDocTypeName.trim()}>
                {savingDocType ? "Saving..." : "Save"}
              </ActionButton>
              <ActionButton variant="secondary" onClick={() => { setShowAddDocType(false); setNewDocTypeName("") }}>Cancel</ActionButton>
            </div>
          )}

          {docTypesLoading ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-4">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["#", "NAME", "STATUS", "ACTIONS"].map((h) => (
                      <th key={h} className="bg-[var(--surface-muted)] px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docTypes.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">No document types configured</td></tr>
                  ) : docTypes.map((dt, idx) => (
                    <tr key={dt.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-2 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium">{dt.name}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${dt.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                          {dt.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingDocType(dt); setEditDocTypeName(dt.name) }}
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
          )}
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
          <HeaderWithAdd title="Salary Categories" />
          <SimpleTable
            headers={["ID#", "NAME", "LIMIT", "ACTION"]}
            rows={salaryCategories.map((row) => [row.id, row.name, row.limit, "✎"])}
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
          <HeaderWithAdd title="Allowances &amp; Deduction" />
          <SimpleTable
            headers={["FACTOR NAME", "AMOUNT", "ACTION"]}
            rows={allowancesAndDeductions.map((row) => [row.factorName, row.amount, "✎"])}
          />
        </CardBody>
      </Card>

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

          <div className="flex items-center justify-between">
            <SectionTitle title="Regional Offices" subtitle="Manage offices mapped to regions." />
            <ActionButton onClick={() => setShowOfficeForm((p) => !p)} disabled={regions.length === 0} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Regional Office
            </ActionButton>
          </div>

          {regions.length === 0 ? (
            <InlineAlert type="error" message="Please add at least one region before creating regional offices." />
          ) : null}

          {showOfficeForm ? (
            <form onSubmit={handleAddOffice} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Office Name <span className="text-red-500">*</span></label>
                  <input type="text" name="name" required placeholder="e.g., Lahore Office" className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Series Code <span className="text-red-500">*</span></label>
                  <input type="text" name="seriesCode" required placeholder="e.g., LHR, KHI" className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Region <span className="text-red-500">*</span></label>
                  <select name="regionId" required className="ui-select">
                    <option value="">Select region</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>{region.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <ActionButton type="submit" disabled={loading}>{loading ? "Saving..." : "Save Office"}</ActionButton>
                <ActionButton type="button" variant="secondary" onClick={() => setShowOfficeForm(false)}>Cancel</ActionButton>
              </div>
            </form>
          ) : null}

          <div className="space-y-2">
            {regionalOffices.length === 0 ? (
              <p className="text-[var(--text-muted)] text-center py-8">No regional offices added yet</p>
            ) : (
              regionalOffices.map((office) => (
                <div key={office.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-4 hover:bg-[var(--surface-muted)]">
                  <p className="font-medium">{office.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    Series: {office.seriesCode} | Region: {office.region.name}
                  </p>
                </div>
              ))
            )}
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
            </div>
          }
          onNo={() => { setEditingDocType(null); setEditDocTypeName("") }}
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
