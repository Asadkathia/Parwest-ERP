"use client"

import { type ReactNode, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
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
  region: {
    id: string
    name: string
  }
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

const allPrerequisitesInitial = [
  { name: "NADRA VERIFICATION", category: "ACTIVATED", status: "ACTIVATE" },
  { name: "HEALTH CERT VER", category: "ACTIVATED", status: "ACTIVATE" },
  { name: "POLICE VERIFICATION", category: "ACTIVATED", status: "ACTIVATE" },
  { name: "EYESIGHT CERT", category: "ACTIVATED", status: "ACTIVATE" },
  { name: "CHARACTER VERIFICATION", category: "ACTIVATED", status: "ACTIVATE" },
  { name: "MENTAL HEALTH CHECK", category: "ACTIVATED", status: "ACTIVATE" },
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
  const [allPrerequisites, setAllPrerequisites] = useState(allPrerequisitesInitial)
  const [editingPrereqIndex, setEditingPrereqIndex] = useState<number | null>(null)
  const [editingPrereqName, setEditingPrereqName] = useState("")
  const [editingPrereqCategory, setEditingPrereqCategory] = useState("")
  const [confirmToggleIndex, setConfirmToggleIndex] = useState<number | null>(null)

  const handleAddRegion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const data = { name: formData.get("name") }

    try {
      const response = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
    const data = {
      name: formData.get("name"),
      seriesCode: formData.get("seriesCode"),
      regionId: formData.get("regionId"),
    }

    try {
      const response = await fetch("/api/regional-offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

  const openEditPrereq = (index: number) => {
    const row = allPrerequisites[index]
    setEditingPrereqIndex(index)
    setEditingPrereqName(row.name)
    setEditingPrereqCategory(row.category)
  }

  const savePrereqEdit = () => {
    if (editingPrereqIndex === null) return
    setAllPrerequisites((prev) =>
      prev.map((row, idx) =>
        idx === editingPrereqIndex ? { ...row, name: editingPrereqName.trim() || row.name, category: editingPrereqCategory.trim() || row.category } : row
      )
    )
    setEditingPrereqIndex(null)
    setEditingPrereqName("")
    setEditingPrereqCategory("")
  }

  const togglePrereqStatus = (index: number) => {
    setAllPrerequisites((prev) =>
      prev.map((row, idx) =>
        idx === index ? { ...row, status: row.status === "ACTIVATE" ? "DEACTIVATE" : "ACTIVATE" } : row
      )
    )
  }

  return (
    <div className="space-y-8">
      {error ? <InlineAlert type="error" message={error} /> : null}

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
              <span
                key={status}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
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
          <HeaderWithAdd title="All Guard's Document Types" />
          <SimpleTable
            headers={["NAME", "DOCUMENT #", "ACTION", "STATUS"]}
            rows={documentTypes.map((row) => [row.name, row.number, "✎", row.status])}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <HeaderWithAdd title="All Prerequisites" />
          <SimpleTable
            headers={["NAME", "CATEGORY (STATUS)", "ACTION", "CURRENT STATUS"]}
            rows={allPrerequisites.map((row, index) => [
              row.name,
              row.category,
              <div key={`action-${index}`} className="flex gap-2">
                <ActionButton variant="secondary" onClick={() => openEditPrereq(index)}>Edit</ActionButton>
                <ActionButton variant={row.status === "ACTIVATE" ? "danger" : "secondary"} onClick={() => setConfirmToggleIndex(index)}>
                  {row.status === "ACTIVATE" ? "Deactivate" : "Activate"}
                </ActionButton>
              </div>,
              row.status,
            ])}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <HeaderWithAdd title="Allowances & Deduction" />
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
                  <label className="block text-sm text-[var(--text-muted)] mb-2">
                    Office Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="name" required placeholder="e.g., Lahore Office" className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">
                    Series Code <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="seriesCode" required placeholder="e.g., LHR, KHI" className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">
                    Region <span className="text-red-500">*</span>
                  </label>
                  <select name="regionId" required className="ui-select">
                    <option value="">Select region</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
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

      {editingPrereqIndex !== null ? (
        <ConfirmDialog
          title="Edit Prerequisite"
          customContent={
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Name</label>
                <input value={editingPrereqName} onChange={(e) => setEditingPrereqName(e.target.value)} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--text-muted)]">Category (Status)</label>
                <input value={editingPrereqCategory} onChange={(e) => setEditingPrereqCategory(e.target.value)} className="ui-input" />
              </div>
            </div>
          }
          onNo={() => setEditingPrereqIndex(null)}
          onYes={savePrereqEdit}
          yesText="Submit"
          noText="Close"
        />
      ) : null}

      {confirmToggleIndex !== null ? (
        <ConfirmDialog
          title="Confirm Status Change"
          message="Are you sure you want to change prerequisite status?"
          onNo={() => setConfirmToggleIndex(null)}
          onYes={() => {
            togglePrereqStatus(confirmToggleIndex)
            setConfirmToggleIndex(null)
          }}
          yesText="Yes"
          noText="No"
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
