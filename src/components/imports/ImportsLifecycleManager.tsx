"use client"

import Link from "next/link"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import { useMemo, useState } from "react"
import DataTable from "@/components/shared/DataTable"
import { importLinks } from "@/lib/parity/screenConfigs"

type ImportModule = "users" | "guards" | "clients" | "inventory"
const MODULES: ImportModule[] = ["users", "guards", "clients", "inventory"]

type ValidationError = {
  row: number
  field: string
  message: string
}

type ValidationSummary = {
  module: string
  totalRows: number
  validRows: number
  invalidRows: number
  valid: boolean
  errors: ValidationError[]
}

type ImportJob = {
  jobId: string
  module: string
  status: string
  totalRows: number
  processedRows: number
  successRows: number
  failedRows: number
  errors: ValidationError[]
}

type PreviewRow = Record<string, string | number> & { __rowId?: string | number }

function parseCsv(text: string): PreviewRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return []
  const headers = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line, index) => {
    const values = line.split(",")
    const row: PreviewRow = { __rowId: index }
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || ""
    })
    return row
  })
}

function sampleCsv(moduleName: ImportModule) {
  if (moduleName === "users") {
    return "name,email,role,regionalOfficeSeries,contactNumber\nAli Khan,ali@example.com,Manager,L,03001234567\nSara Malik,sara@example.com,Supervisor,K,03007654321"
  }
  if (moduleName === "guards") {
    return "name,cnic\nGuard One,35202-1234567-1\nGuard Two,35202-7654321-1"
  }
  if (moduleName === "clients") {
    return "name,type\nClient One,BANK\nClient Two,OTHER"
  }
  return "sku,name,storeCode,quantityOnHand,brand,status\nWT-001,Walkie Talkie,RO-L,12,Motorola,ACTIVE\nUF-001,Uniform Set,RO-L,50,Parwest,ACTIVE"
}

export default function ImportsLifecycleManager({ initialModule = "users" }: { initialModule?: ImportModule }) {
  const [moduleName, setModuleName] = useState<ImportModule>(MODULES.includes(initialModule) ? initialModule : "users")
  const [csvInput, setCsvInput] = useState(sampleCsv(initialModule))
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [validation, setValidation] = useState<ValidationSummary | null>(null)
  const [job, setJob] = useState<ImportJob | null>(null)
  const [loadingValidate, setLoadingValidate] = useState(false)
  const [loadingProcess, setLoadingProcess] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const previewRows = useMemo(() => parseCsv(csvInput).slice(0, 50), [csvInput])

  const uploadBody = async () => {
    if (file) {
      const formData = new FormData()
      formData.set("file", file)
      return { body: formData, headers: undefined as HeadersInit | undefined }
    }
    return {
      body: JSON.stringify({ rows: parseCsv(csvInput) }),
      headers: { "Content-Type": "application/json" },
    }
  }

  const onValidate = async () => {
    setLoadingValidate(true)
    setNotice(null)
    try {
      const payload = await uploadBody()
      const response = await fetch(`/api/imports/${moduleName}/validate`, {
        method: "POST",
        headers: payload.headers,
        body: payload.body,
      })
      const data = await response.json()
      if (!response.ok) {
        setNotice({ type: "error", message: data?.message || "Validation failed." })
        return
      }
      setValidation(data.data || null)
      setNotice({ type: "success", message: data?.data?.valid ? "Validation passed." : "Validation completed with errors." })
    } catch {
      setNotice({ type: "error", message: "Validation request failed." })
    } finally {
      setLoadingValidate(false)
    }
  }

  const onProcess = async () => {
    setLoadingProcess(true)
    setNotice(null)
    try {
      const payload = await uploadBody()
      const response = await fetch(`/api/imports/${moduleName}/process`, {
        method: "POST",
        headers: payload.headers,
        body: payload.body,
      })
      const data = await response.json()
      if (!response.ok) {
        setNotice({ type: "error", message: data?.message || "Import process failed." })
        return
      }
      setJob(data.data || null)
      setNotice({ type: "success", message: `Import job created: ${data?.data?.jobId}` })
    } catch {
      setNotice({ type: "error", message: "Import process request failed." })
    } finally {
      setLoadingProcess(false)
    }
  }

  const refreshStatus = async () => {
    if (!job?.jobId) return
    setLoadingStatus(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/imports/jobs/${job.jobId}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        setNotice({ type: "error", message: data?.message || "Failed to fetch import job." })
        return
      }
      setJob(data.data || null)
      setNotice({ type: "success", message: `Job ${data?.data?.status}` })
    } catch {
      setNotice({ type: "error", message: "Failed to fetch import job." })
    } finally {
      setLoadingStatus(false)
    }
  }

  const downloadErrorsCsv = async () => {
    if (!job?.jobId) return
    const response = await fetch(`/api/imports/jobs/${job.jobId}/errors?format=csv`)
    if (!response.ok) {
      setNotice({ type: "error", message: "Failed to download errors CSV." })
      return
    }
    const csv = await response.text()
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `import-errors-${job.jobId}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setNotice({ type: "success", message: "Error CSV downloaded." })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Imports"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Validate, process, and monitor import jobs with downloadable error reports."}</p></div></div>
        <div className="flex flex-wrap gap-2 justify-end">
          {importLinks.map((link) => (
            <Link key={link.href} href={link.href} className="ui-btn ui-btn-secondary">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {notice ? ((notice.type) === "success" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert> : <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{(notice.message)}</AlertDescription></Alert>) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Import Module</label>
            <select
              className="ui-select"
              value={moduleName}
              onChange={(e) => {
                const value = e.target.value as ImportModule
                setModuleName(value)
                setCsvInput(sampleCsv(value))
                setFile(null)
                setValidation(null)
                setJob(null)
              }}
            >
              <option value="users">Users</option>
              <option value="guards">Guards</option>
              <option value="clients">Clients</option>
              <option value="inventory">Inventory</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Upload CSV File</label>
            <input
              className="ui-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={onValidate} disabled={loadingValidate}>
              {loadingValidate ? "Validating..." : "Validate"}
            </Button>
            <Button variant="secondary" onClick={onProcess} disabled={loadingProcess}>
              {loadingProcess ? "Processing..." : "Import"}
            </Button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-1">CSV Content (used when no file is selected)</label>
          <textarea
            className="ui-textarea"
            rows={8}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="Paste CSV content"
          />
        </div>
      </CardContent>
      </Card>

      <section className="ui-card overflow-x-auto">
        <h3 className="text-base font-semibold text-[var(--text)] mb-3">Preview Rows</h3>
        <DataTable
          rows={previewRows}
          columns={
            previewRows.length > 0
              ? Object.keys(previewRows[0]).map((key) => ({ key, header: key }))
              : [{ key: "empty", header: "No Data", render: () => "-" }]
          }
          getRowKey={(row, index) => String(row.__rowId || index)}
          emptyText="No preview rows."
          searchable={false}
        />
      </section>

      {validation ? (
        <section className="ui-card space-y-3">
          <h3 className="text-base font-semibold text-[var(--text)]">Validation Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Module" value={validation.module} />
            <Stat label="Total" value={String(validation.totalRows)} />
            <Stat label="Valid" value={String(validation.validRows)} />
            <Stat label="Invalid" value={String(validation.invalidRows)} />
            <Stat label="Status" value={validation.valid ? "VALID" : "INVALID"} />
          </div>
          <DataTable
            rows={validation.errors}
            columns={[
              { key: "row", header: "Row" },
              { key: "field", header: "Field" },
              { key: "message", header: "Error" },
            ]}
            getRowKey={(row, index) => `${row.row}-${row.field}-${index}`}
            emptyText="No validation errors."
            searchable={false}
          />
        </section>
      ) : null}

      {job ? (
        <section className="ui-card space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-[var(--text)]">Import Job</h3>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={refreshStatus} disabled={loadingStatus}>
                {loadingStatus ? "Refreshing..." : "Refresh Status"}
              </Button>
              <Button variant="secondary" onClick={downloadErrorsCsv} disabled={!job.jobId}>
                Download Errors CSV
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Stat label="Job ID" value={job.jobId} />
            <Stat label="Status" value={job.status} />
            <Stat label="Total" value={String(job.totalRows)} />
            <Stat label="Processed" value={String(job.processedRows)} />
            <Stat label="Success" value={String(job.successRows)} />
            <Stat label="Failed" value={String(job.failedRows)} />
          </div>
          <DataTable
            rows={job.errors}
            columns={[
              { key: "row", header: "Row" },
              { key: "field", header: "Field" },
              { key: "message", header: "Error" },
            ]}
            getRowKey={(row, index) => `${row.row}-${row.field}-${index}`}
            emptyText="No job errors."
            searchable={false}
          />
        </section>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--text)] break-all">{value}</p>
    </div>
  )
}
