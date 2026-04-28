"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import { useSession } from "next-auth/react"
import DataTable from "@/components/shared/DataTable"
import { apiGet, apiSend } from "@/components/store-inventory-v2/api"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"
import { useScopeQuery } from "@/components/store-inventory-v2/use-scope-query"

type Option = { id: string; name: string }
type RegionOption = { id: string; name: string }

type LicenseRow = {
  id: string
  validity: string
  licenseNumber: string
  weaponNumber?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  attachmentName?: string | null
  clientId?: string | null
  weaponTypeId?: string | null
  calibreId?: string | null
  client?: Option | null
  weaponType?: Option | null
  calibre?: Option | null
  createdBy?: Option | null
}

type FormState = {
  validity: string
  licenseNumber: string
  clientId: string
  weaponNumber: string
  weaponTypeId: string
  calibreId: string
  issueDate: string
  expiryDate: string
  attachmentName: string
}

const EMPTY_FORM: FormState = {
  validity: "",
  licenseNumber: "",
  clientId: "",
  weaponNumber: "",
  weaponTypeId: "",
  calibreId: "",
  issueDate: "",
  expiryDate: "",
  attachmentName: "",
}

const VALIDITY_OPTIONS = ["Pakistan wide", "Province wide", "District wide", "City wide"]

export default function LicensesManager({
  regions = [],
  locked = false,
}: {
  regions?: RegionOption[]
  locked?: boolean
} = {}) {
  const scopeQuery = useScopeQuery()
  const { data: session } = useSession()
  const sessionUser = session?.user as
    | { roleScopeType?: "GLOBAL" | "REGIONAL"; regionId?: string | null }
    | undefined
  const callerRegionId =
    sessionUser?.roleScopeType === "REGIONAL" ? sessionUser.regionId ?? null : null

  const [rows, setRows] = useState<LicenseRow[]>([])
  const [clients, setClients] = useState<Option[]>([])
  const [weaponTypes, setWeaponTypes] = useState<Option[]>([])
  const [calibres, setCalibres] = useState<Option[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const effectiveRegionId = scopeQuery.regionId || callerRegionId
      const clientsUrl = effectiveRegionId
        ? `/api/clients?regionId=${encodeURIComponent(effectiveRegionId)}`
        : "/api/clients"
      const [licenseRows, clientRows, weaponTypeRows, calibreRows] = await Promise.all([
        apiGet<LicenseRow[]>(`/api/store-inventory/v2/licenses${scopeQuery.query}`),
        apiGet<Option[]>(clientsUrl),
        apiGet<Option[]>("/api/store-inventory/v2/masters/weapon-types"),
        apiGet<Option[]>("/api/store-inventory/v2/masters/calibres"),
      ])
      setRows(licenseRows)
      setClients(clientRows)
      setWeaponTypes(weaponTypeRows)
      setCalibres(calibreRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load licenses."
      setNotice({ type: "error", message })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [callerRegionId, scopeQuery.query, scopeQuery.regionId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) =>
      `${row.licenseNumber} ${row.validity} ${row.weaponNumber || ""} ${row.client?.name || ""} ${row.weaponType?.name || ""} ${row.calibre?.name || ""}`
        .toLowerCase()
        .includes(q),
    )
  }, [rows, query])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const startEdit = (row: LicenseRow) => {
    setEditingId(row.id)
    setForm({
      validity: row.validity || "",
      licenseNumber: row.licenseNumber || "",
      clientId: row.clientId || "",
      weaponNumber: row.weaponNumber || "",
      weaponTypeId: row.weaponTypeId || "",
      calibreId: row.calibreId || "",
      issueDate: row.issueDate ? String(row.issueDate).slice(0, 10) : "",
      expiryDate: row.expiryDate ? String(row.expiryDate).slice(0, 10) : "",
      attachmentName: row.attachmentName || "",
    })
  }

  const save = async () => {
    if (!form.validity.trim() || !form.licenseNumber.trim()) {
      setNotice({ type: "error", message: "License validity and license number are required." })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      const payload = {
        validity: form.validity.trim(),
        licenseNumber: form.licenseNumber.trim(),
        clientId: form.clientId || null,
        weaponNumber: form.weaponNumber.trim() || null,
        weaponTypeId: form.weaponTypeId || null,
        calibreId: form.calibreId || null,
        issueDate: form.issueDate || null,
        expiryDate: form.expiryDate || null,
        attachmentName: form.attachmentName || null,
      }

      if (editingId) {
        await apiSend(`/api/store-inventory/v2/licenses/${editingId}`, "PATCH", payload)
      } else {
        await apiSend("/api/store-inventory/v2/licenses", "POST", payload)
      }

      setNotice({ type: "success", message: editingId ? "License updated successfully." : "License created successfully." })
      resetForm()
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : editingId ? "Failed to update license." : "Failed to create license."
      setNotice({ type: "error", message })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await apiSend(`/api/store-inventory/v2/licenses/${id}`, "DELETE")
      setNotice({ type: "success", message: "License deleted." })
      if (editingId === id) resetForm()
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete license."
      setNotice({ type: "error", message })
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Licenses"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Manage license records for weapon inventory with client + weapon details."}</p></div></div>
      {notice ? ((notice.type) === "success" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert> : <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert>) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="License Validity *"
            value={form.validity}
            onChange={(value) => setForm((prev) => ({ ...prev, validity: value }))}
            options={VALIDITY_OPTIONS.map((value) => ({ id: value, name: value }))}
            placeholder="Select Validity"
          />
          <div />
          <Field label="License Number *" value={form.licenseNumber} onChange={(value) => setForm((prev) => ({ ...prev, licenseNumber: value }))} />
          <Select label="Client" value={form.clientId} onChange={(value) => setForm((prev) => ({ ...prev, clientId: value }))} options={clients} placeholder="View Client" />
          <Field label="Weapon Number" value={form.weaponNumber} onChange={(value) => setForm((prev) => ({ ...prev, weaponNumber: value }))} />
          <div />
          <Select
            label="Weapon Type"
            value={form.weaponTypeId}
            onChange={(value) => setForm((prev) => ({ ...prev, weaponTypeId: value }))}
            options={weaponTypes}
            placeholder="Select Weapon Type"
          />
          <Select
            label="Calibre"
            value={form.calibreId}
            onChange={(value) => setForm((prev) => ({ ...prev, calibreId: value }))}
            options={calibres}
            placeholder="Select Calibre"
          />
          <Field label="Issue Date" type="date" value={form.issueDate} onChange={(value) => setForm((prev) => ({ ...prev, issueDate: value }))} />
          <Field label="Expiry Date" type="date" value={form.expiryDate} onChange={(value) => setForm((prev) => ({ ...prev, expiryDate: value }))} />
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Attachment</label>
            <input
              className="ui-input"
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                setForm((prev) => ({ ...prev, attachmentName: file?.name || "" }))
              }}
            />
            {form.attachmentName ? <p className="mt-1 text-xs text-[var(--text-muted)]">Selected: {form.attachmentName}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update" : "Add"}
          </Button>
          <Button variant="secondary" onClick={resetForm}>
            {editingId ? "Cancel" : "Reset"}
          </Button>
        </div>
      </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Suspense>
            <RegionUrlPicker regions={regions} locked={locked} includeGlobalOption={false} />
          </Suspense>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Search</label>
            <input className="ui-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by license/client/weapon" />
          </div>
        </div>
      </CardContent>
      </Card>

      <DataTable
        rows={filtered}
        rowKey="id"
        searchable={false}
        emptyText={loading ? "Loading licenses..." : "No licenses found."}
        columns={[
          { key: "licenseNumber", header: "License Number", sortable: true },
          { key: "client", header: "Client", render: (row) => row.client?.name || "—" },
          { key: "weaponNumber", header: "Weapon Number", render: (row) => row.weaponNumber || "—" },
          { key: "weaponType", header: "Weapon Type", render: (row) => row.weaponType?.name || "—" },
          { key: "calibre", header: "Calibre", render: (row) => row.calibre?.name || "—" },
          { key: "validity", header: "Validity", render: (row) => row.validity || "—" },
          { key: "createdBy", header: "Created By", render: (row) => row.createdBy?.name || "—" },
          { key: "issueDate", header: "Issue Date", render: (row) => (row.issueDate ? String(row.issueDate).slice(0, 10) : "—") },
          { key: "expiryDate", header: "Expiry Date", render: (row) => (row.expiryDate ? String(row.expiryDate).slice(0, 10) : "—") },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex items-center gap-3">
                <button className="text-[var(--brand)] hover:underline" onClick={() => startEdit(row)}>
                  Edit
                </button>
                <button className="text-red-600 hover:underline" onClick={() => void remove(row.id)}>
                  Delete
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: "text" | "date"
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input className="ui-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
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
