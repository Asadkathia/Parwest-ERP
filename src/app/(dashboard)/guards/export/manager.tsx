"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Download, X, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/shadcn/card"
// Legacy shadow status (Guard.status) — dual-written, kept for non-web CSV consumers.
// BLACKLISTED + ABSENT are retired enum values and no longer emitted, so omitted here.
const STATUS_OPTIONS = ["ACTIVE", "PENDING", "INACTIVE", "TERMINATED", "PRESENT", "DEFAULT"]
// New canonical lifecycleStatus enum. Prefer this for filtering going forward.
const LIFECYCLE_STATUS_OPTIONS = ["PENDING", "ACTIVE", "INACTIVE", "TERMINATED"]
const EX_SERVICE_OPTIONS = ["ARMY", "POLICE", "RANGERS", "MUJAHID", "OTHER", "CIVILIAN"]
const VERIFICATION_STATUS_OPTIONS = ["PENDING", "VERIFIED", "REJECTED", "IN_PROCESS"]

type RegionalOffice = { id: string; name: string; region: { id: string; name: string } }
type Supervisor = { id: string; name: string | null }

export default function ExportGuardsManager() {
  const [parwestId, setParwestId] = useState("")
  const [name, setName] = useState("")
  const [cnic, setCnic] = useState("")
  const [status, setStatus] = useState("")
  const [lifecycleStatus, setLifecycleStatus] = useState("")
  const [exService, setExService] = useState("")
  const [supervisorId, setSupervisorId] = useState("")
  const [verificationStatus, setVerificationStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [regionalOfficeId, setRegionalOfficeId] = useState("")
  const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [notice, setNotice] = useState("")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch("/api/regional-offices")
      .then((r) => r.ok ? r.json() : [])
      .then((data: RegionalOffice[]) => setRegionalOffices(data))
      .catch(() => {})
    fetch("/api/users?take=200")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { users?: Supervisor[]; items?: Supervisor[] } | Supervisor[]) => {
        const list = Array.isArray(data) ? data : (data.users ?? data.items ?? [])
        setSupervisors(list.filter((u) => u.name))
      })
      .catch(() => {})
  }, [])

  const buildParams = () => {
    const params = new URLSearchParams()
    if (parwestId) params.set("parwestId", parwestId)
    if (name) params.set("name", name)
    if (cnic) params.set("cnic", cnic)
    if (status) params.set("status", status)
    if (lifecycleStatus) params.set("lifecycleStatus", lifecycleStatus)
    if (exService) params.set("exService", exService)
    if (supervisorId) params.set("supervisorId", supervisorId)
    if (verificationStatus) params.set("verificationStatus", verificationStatus)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (regionalOfficeId) params.set("regionalOfficeId", regionalOfficeId)
    return params.toString()
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      setNotice("")
      const qs = buildParams()
      const res = await fetch(`/api/guards/export${qs ? `?${qs}` : ""}`)
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `guards-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setNotice("Export downloaded successfully.")
    } catch {
      setNotice("Export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  const clearFilter = () => {
    setParwestId("")
    setName("")
    setCnic("")
    setStatus("")
    setLifecycleStatus("")
    setExService("")
    setSupervisorId("")
    setVerificationStatus("")
    setDateFrom("")
    setDateTo("")
    setRegionalOfficeId("")
    setNotice("Filters cleared.")
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Export Guards</h2>
          <p className="mt-1 text-sm text-muted-foreground">Filter and export guard records to Excel.</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Parwest ID" name="parwestId" value={parwestId} onChange={setParwestId} />
          <Field label="Name" name="name" value={name} onChange={setName} />
          <Field label="CNIC#" name="cnic" value={cnic} onChange={setCnic} />

          <SelectField
            label="Select Status (legacy)"
            name="current_status_id"
            placeholder="--Select Status--"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
          <SelectField
            label="Lifecycle Status"
            name="lifecycle_status_id"
            placeholder="--Select Lifecycle Status--"
            value={lifecycleStatus}
            onChange={setLifecycleStatus}
            options={LIFECYCLE_STATUS_OPTIONS}
          />
          <SelectField
            label="Ex Service"
            name="ex_service_id"
            placeholder="--Select Ex Service--"
            value={exService}
            onChange={setExService}
            options={EX_SERVICE_OPTIONS}
          />

          {/* Supervisor — fetched from DB */}
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Supervisor</label>
            <select name="supervisor_id" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="ui-select">
              <option value="">--Select Supervisor--</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <SelectField
            label="Verification Status"
            name="verification_status_id"
            placeholder="--Select Verification Status--"
            value={verificationStatus}
            onChange={setVerificationStatus}
            options={VERIFICATION_STATUS_OPTIONS}
          />

          {/* Regional Office */}
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Regional Office</label>
            <select
              name="regionalOfficeId"
              value={regionalOfficeId}
              onChange={(e) => setRegionalOfficeId(e.target.value)}
              className="ui-select"
            >
              <option value="">--Select Regional Office--</option>
              {regionalOffices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name} ({office.region.name})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From – To */}
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Date From</label>
            <input
              type="date"
              name="dateFrom"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="ui-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-muted)]">Date To</label>
            <input
              type="date"
              name="dateTo"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="ui-input"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={clearFilter} className="inline-flex items-center gap-2">
            <X className="h-4 w-4" />
            Clear Filter
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-2">
            Submit
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export to CSV"}
          </Button>
        </div>
        </CardContent>
      </Card>

      {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}
    </div>
  )
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
}: {
  label: string
  name?: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <input name={name || label} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="ui-input" />
    </div>
  )
}

function SelectField({
  label,
  name,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string
  name?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-[var(--text-muted)]">{label}</label>
      <select name={name || label} value={value} onChange={(e) => onChange(e.target.value)} className="ui-select">
        <option value="">{placeholder || label}</option>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
