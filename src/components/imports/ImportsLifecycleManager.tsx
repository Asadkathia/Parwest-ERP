"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog"
import { useEffect, useMemo, useState } from "react"
import DataTable from "@/components/shared/DataTable"
import { importLinks } from "@/lib/parity/screenConfigs"

type ImportModule = "users" | "guards" | "clients" | "inventory" | "loans"
const MODULES: ImportModule[] = ["users", "guards", "clients", "inventory", "loans"]

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

type PreviewRow = Record<string, string | number>

function parseCsv(text: string): PreviewRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return []
  const headers = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(",")
    const row: PreviewRow = {}
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || ""
    })
    return row
  })
}

/** Header row of a CSV string (first non-empty line). The draft/validate
 *  routes require an explicit `headers[]` alongside `rows[]`. */
function parseCsvHeaders(text: string): string[] {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  return firstLine ? firstLine.split(",").map((h) => h.trim()) : []
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
  if (moduleName === "loans") {
    return "parwest id,month,amount\nPW-00001,2026-05,5000\nPW-00002,2026-05,3000"
  }
  return "sku,name,storeCode,quantityOnHand,brand,status\nWT-001,Walkie Talkie,RO-L,12,Motorola,ACTIVE\nUF-001,Uniform Set,RO-L,50,Parwest,ACTIVE"
}

type RegistryEntry = {
  module: string
  subModule?: string
  label: string
  description?: string
  requiredHeaders?: string[]
  optionalHeaders?: string[]
}

type JobHistoryEntry = {
  id: string
  module: string
  subModule: string | null
  status: string
  totalRows: number
  successRows: number
  failedRows: number
  fileName: string | null
  createdAt: string
  finishedAt: string | null
  createdBy: { id: string; name: string | null; email: string | null } | null
}

type Props = { initialModule?: ImportModule; draftEditorEnabled?: boolean }

export default function ImportsLifecycleManager({ initialModule = "users", draftEditorEnabled = false }: Props) {
  const router = useRouter()
  const [moduleName, setModuleName] = useState<ImportModule>(MODULES.includes(initialModule) ? initialModule : "users")
  const [resumePrompt, setResumePrompt] = useState<{ existingDraftId: string } | null>(null)
  const [subModule, setSubModule] = useState<string>("")
  const [csvInput, setCsvInput] = useState(sampleCsv(initialModule))
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [validation, setValidation] = useState<ValidationSummary | null>(null)
  const [job, setJob] = useState<ImportJob | null>(null)
  const [loadingValidate, setLoadingValidate] = useState(false)
  const [loadingProcess, setLoadingProcess] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [registry, setRegistry] = useState<RegistryEntry[]>([])
  const [history, setHistory] = useState<JobHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const previewRows = useMemo(() => parseCsv(csvInput).slice(0, 50), [csvInput])

  // The registry entry for the currently-selected (module, sub-import). Drives
  // the "expected columns" panel so users know which headers are required.
  const selectedImport = useMemo(
    () =>
      registry.find((r) => (r.subModule ?? "") === subModule) ??
      registry.find((r) => !r.subModule) ??
      null,
    [registry, subModule],
  )

  // Load registry once + whenever the module changes (server is the
  // source of truth — clients should not hardcode the sub-import list).
  useEffect(() => {
    let cancelled = false
    fetch(`/api/imports/registry?module=${moduleName}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((payload) => {
        if (cancelled) return
        const list: RegistryEntry[] = Array.isArray(payload?.data) ? payload.data : []
        setRegistry(list)
      })
      .catch(() => setRegistry([]))
    return () => {
      cancelled = true
    }
  }, [moduleName])

  const queryString = subModule ? `?sub=${encodeURIComponent(subModule)}` : ""

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({ module: moduleName, take: "20" })
      if (subModule) params.set("subModule", subModule)
      const res = await fetch(`/api/imports/jobs?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) {
        setHistory([])
        return
      }
      const payload = await res.json()
      const list = Array.isArray(payload?.data) ? (payload.data as JobHistoryEntry[]) : []
      setHistory(list)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Refresh history whenever (module, subModule) changes or after a job
  // is created — keeps the list in sync with the current scope.
  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleName, subModule])

  const uploadBody = async () => {
    if (file) {
      const formData = new FormData()
      formData.set("file", file)
      return { body: formData, headers: undefined as HeadersInit | undefined }
    }
    return {
      body: JSON.stringify({ rows: parseCsv(csvInput), headers: parseCsvHeaders(csvInput) }),
      headers: { "Content-Type": "application/json" },
    }
  }

  const downloadTemplate = async () => {
    const res = await fetch(`/api/imports/${moduleName}/template${queryString}`)
    if (!res.ok) {
      setNotice({ type: "error", message: "Failed to download template." })
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${moduleName}${subModule ? `-${subModule}` : ""}-template.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadErrorsXlsx = async () => {
    if (!job?.jobId) return
    const res = await fetch(`/api/imports/jobs/${job.jobId}/errors?format=xlsx`)
    if (!res.ok) {
      setNotice({ type: "error", message: "Failed to download errors xlsx." })
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `import-errors-${job.jobId}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onValidate = async () => {
    setLoadingValidate(true)
    setNotice(null)
    try {
      const payload = await uploadBody()
      const response = await fetch(`/api/imports/${moduleName}/validate${queryString}`, {
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
      const response = await fetch(`/api/imports/${moduleName}/process${queryString}`, {
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
      loadHistory()
    } catch {
      setNotice({ type: "error", message: "Import process request failed." })
    } finally {
      setLoadingProcess(false)
    }
  }

  const onUploadOpenEditor = async () => {
    if (!file && !csvInput.trim()) {
      setNotice({ type: "error", message: "Choose a file or paste CSV first." })
      return
    }
    setLoadingProcess(true)
    setNotice(null)
    try {
      const payload = await uploadBody()
      const res = await fetch(`/api/imports/${moduleName}/draft${queryString}`, {
        method: "POST",
        headers: payload.headers,
        body: payload.body,
      })
      const data = await res.json()
      if (res.status === 409 && data?.data?.existingDraftId) {
        setResumePrompt({ existingDraftId: data.data.existingDraftId })
        return
      }
      if (!res.ok) {
        setNotice({ type: "error", message: data?.message || "Upload failed" })
        return
      }
      router.push(`/imports/drafts/${data.data.draftId}`)
    } catch {
      setNotice({ type: "error", message: "Upload request failed." })
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Import Module</label>
            <select
              className="ui-select"
              value={moduleName}
              onChange={(e) => {
                const value = e.target.value as ImportModule
                setModuleName(value)
                setSubModule("")
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
              <option value="loans">Guard Loans</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Sub-import</label>
            <select
              className="ui-select"
              value={subModule}
              onChange={(e) => {
                setSubModule(e.target.value)
                setValidation(null)
                setJob(null)
              }}
            >
              <option value="">— Top-level —</option>
              {registry
                .filter((r) => r.subModule)
                .map((r) => (
                  <option key={r.subModule} value={r.subModule}>
                    {r.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Upload File (.xlsx / .csv)</label>
            <input
              className="ui-input"
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="flex items-end flex-wrap gap-2">
            <Button variant="secondary" onClick={downloadTemplate}>Download Template</Button>
            {draftEditorEnabled ? (
              <Button onClick={onUploadOpenEditor} disabled={loadingProcess}>
                {loadingProcess ? "Uploading…" : "Upload & Open Editor"}
              </Button>
            ) : (
              <>
                <Button onClick={onValidate} disabled={loadingValidate}>
                  {loadingValidate ? "Validating..." : "Validate"}
                </Button>
                <Button variant="secondary" onClick={onProcess} disabled={loadingProcess}>
                  {loadingProcess ? "Processing..." : "Import"}
                </Button>
              </>
            )}
          </div>
        </div>
        {selectedImport &&
        ((selectedImport.requiredHeaders?.length ?? 0) > 0 ||
          (selectedImport.optionalHeaders?.length ?? 0) > 0) ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-3">
            <div className="text-sm font-medium text-[var(--text)]">
              Expected columns — {selectedImport.label}
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Required ({selectedImport.requiredHeaders?.length ?? 0})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(selectedImport.requiredHeaders ?? []).map((h) => (
                  <span
                    key={h}
                    className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
            {(selectedImport.optionalHeaders?.length ?? 0) > 0 ? (
              <details>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Optional ({selectedImport.optionalHeaders?.length ?? 0})
                </summary>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(selectedImport.optionalHeaders ?? []).map((h) => (
                    <span
                      key={h}
                      className="rounded border border-[var(--border)] bg-card px-2 py-0.5 text-xs text-[var(--text-muted)]"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
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
          getRowKey={(_row, index) => String(index)}
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

      <section className="ui-card space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">Recent Imports</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {moduleName}
              {subModule ? ` › ${subModule}` : ""} — your last 20 runs.
            </p>
          </div>
          <Button variant="secondary" onClick={loadHistory} disabled={historyLoading}>
            {historyLoading ? "Loading…" : "Refresh"}
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] italic">No previous imports for this module.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Success</th>
                  <th className="px-3 py-2 text-right">Failed</th>
                  <th className="px-3 py-2 text-left">By</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-[var(--surface-muted)]">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(h.createdAt).toLocaleString("en-PK", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          h.status === "COMPLETED"
                            ? "text-emerald-700"
                            : h.status === "FAILED"
                              ? "text-rose-700"
                              : h.status === "DRAFT"
                                ? "text-amber-700"
                                : "text-amber-700"
                        }
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{h.fileName || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.totalRows}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{h.successRows}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">{h.failedRows}</td>
                    <td className="px-3 py-2 truncate max-w-[160px]">
                      {h.createdBy?.name || h.createdBy?.email || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {h.status === "DRAFT" ? (
                        <Link
                          href={`/imports/drafts/${h.id}`}
                          className="text-xs text-[var(--brand)] hover:underline"
                        >
                          Continue
                        </Link>
                      ) : h.failedRows > 0 ? (
                        <a
                          href={`/api/imports/jobs/${h.id}/errors?format=xlsx`}
                          className="text-xs text-[var(--brand)] hover:underline"
                        >
                          Download errors
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {job ? (
        <section className="ui-card space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-[var(--text)]">Import Job</h3>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={refreshStatus} disabled={loadingStatus}>
                {loadingStatus ? "Refreshing..." : "Refresh Status"}
              </Button>
              <Button variant="secondary" onClick={downloadErrorsXlsx} disabled={!job.jobId}>
                Download Errors (.xlsx)
              </Button>
              <Button variant="secondary" onClick={downloadErrorsCsv} disabled={!job.jobId}>
                Errors (.csv)
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

      {resumePrompt ? (
        <AlertDialog open onOpenChange={() => setResumePrompt(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>You have an in-progress {moduleName} draft</AlertDialogTitle>
              <AlertDialogDescription>
                Resume editing where you left off, or discard it and start fresh?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setResumePrompt(null)}>Cancel</AlertDialogCancel>
              <Button
                variant="ghost"
                onClick={async () => {
                  const existingId = resumePrompt.existingDraftId
                  await fetch(`/api/imports/drafts/${existingId}`, { method: "DELETE" })
                  setResumePrompt(null)
                  onUploadOpenEditor()
                }}
              >
                Discard &amp; Start Over
              </Button>
              <AlertDialogAction onClick={() => router.push(`/imports/drafts/${resumePrompt.existingDraftId}`)}>
                Resume
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
