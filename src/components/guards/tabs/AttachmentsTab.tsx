"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Upload, FileText, Trash2, Eye, RefreshCw, Download, History, ChevronDown, ChevronUp, X } from "lucide-react"

type PrereqRow = {
  docTypeId: string
  docTypeName: string
  isActive: boolean
  docCategory: string
  isSystemGenerated: boolean
  prereqId: string | null
  status: string
  verificationStatus: string | null
  hasAttachment: boolean
  attachmentName: string | null
  documentUrl: string | null
  verifiedAt: string | null
  verifiedBy: string | null
  updatedAt: string | null
}

type HistoryRecord = {
  id: string
  attachmentData: string | null
  attachmentName: string | null
  documentUrl: string | null
  uploadedBy: string | null
  uploadedAt: string
}

interface AttachmentsTabProps {
  guardId: string
  canCreate?: boolean
  canDelete?: boolean
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

// Resolve a viewable URL for either a data: URL (base64 attachment) or a
// regular HTTP url. For data: URLs we materialize a Blob so the browser
// can preview PDFs/images natively without choking on huge data: strings.
function resolveViewableUrl(data: string): string {
  if (data.startsWith("data:")) {
    const blob = dataURLtoBlob(data)
    return URL.createObjectURL(blob)
  }
  return data
}

// Open `data` in `win` (a window already opened synchronously inside the
// user-gesture handler). If `win` is null (popup blocked), fall back to a
// best-effort navigation in the current tab.
function openDocumentInWindow(win: Window | null, data: string) {
  const url = resolveViewableUrl(data)
  if (win && !win.closed) {
    win.location.href = url
  } else {
    // Fallback path. We do NOT pass "noopener,noreferrer" here because
    // that causes window.open to return null, which trips popup blockers
    // when called after an await — same trap that broke ticket #44.
    window.open(url, "_blank")
  }
}

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(",")
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new Blob([u8arr], { type: mime })
}

function downloadFile(data: string, name: string) {
  const a = document.createElement("a")
  a.href = data
  a.download = name
  a.click()
}

async function fetchAttachmentPayload(
  guardId: string,
  prereqId: string | null
): Promise<string | null> {
  if (!prereqId) return null
  try {
    const res = await fetch(`/api/guards/${guardId}/prerequisites/${prereqId}`)
    if (!res.ok) return null
    const payload = await res.json()
    return payload.attachmentData || payload.documentUrl || null
  } catch {
    return null
  }
}

// Open the popup synchronously (still inside the click's user-gesture stack)
// then resolve the attachment payload and navigate the popup. Opening AFTER
// an async await is blocked by Safari/Firefox/Chrome popup blockers, which
// is what made #44 reproducible in QA.
async function viewAttachment(guardId: string, row: PrereqRow) {
  const win = window.open("about:blank", "_blank")
  const data = row.documentUrl || (await fetchAttachmentPayload(guardId, row.prereqId))
  if (!data) {
    win?.close()
    return
  }
  openDocumentInWindow(win, data)
}

async function downloadAttachment(guardId: string, row: PrereqRow) {
  const data = row.documentUrl || (await fetchAttachmentPayload(guardId, row.prereqId))
  if (data) downloadFile(data, row.attachmentName || row.docTypeName)
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-PK", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ── History Panel ──────────────────────────────────────────────────────────────
function HistoryPanel({
  guardId,
  prereqId,
  colSpan,
  onClose,
}: {
  guardId: string
  prereqId: string
  colSpan: number
  onClose: () => void
}) {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/guards/${guardId}/prerequisites/${prereqId}/history`)
      .then((r) => r.ok ? r.json() : [])
      .then(setRecords)
      .finally(() => setLoading(false))
  }, [guardId, prereqId])

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Attached Document — Version History
            </h4>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          {loading ? (
            <p className="text-xs text-[var(--text-muted)]">Loading history...</p>
          ) : records.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No previous versions found.</p>
          ) : (
            <div className="space-y-2">
              {records.map((rec, i) => {
                const data = rec.attachmentData || rec.documentUrl
                return (
                  <div key={rec.id} className="flex items-center justify-between rounded border border-[var(--border)] bg-white px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-muted)] font-mono">v{records.length - i}</span>
                      <span className="font-medium text-[var(--text)]">{rec.attachmentName || "—"}</span>
                      <span className="text-[var(--text-muted)]">· {rec.uploadedBy || "Unknown"} · {formatDateTime(rec.uploadedAt)}</span>
                    </div>
                    {data && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const win = window.open("about:blank", "_blank")
                            openDocumentInWindow(win, data)
                          }}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                        <button
                          onClick={() => downloadFile(data, rec.attachmentName || "document")}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          <Download className="h-3 w-3" /> Download
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Doc name → API slug mapping ───────────────────────────────────────────────
const DOC_SLUG_MAP: Record<string, string> = {
  "Form A (Without Sign)": "form-a",
  "Form B (Without Sign and Thumb Impressions)": "form-b",
  "Employee Card": "employee-card",
  "Personal Verification Guard Guarantors": "personal-verification",
  "Training Certificate": "training-certificate",
  "Character Certificate": "character-certificate",
  "Guard Documents Checklist": "checklist",
  "Medical Certificate": "medical-certificate",
  "Guard Antecedents Verification": "antecedents",
  "Iqrar Nama": "iqrar-nama",
}

// ── System Document Row (separate template vs attached columns) ────────────────
function SystemDocRow({
  row,
  guardId,
  uploading,
  deleting,
  onUploadClick,
  onDelete,
  canCreate,
  canDelete,
}: {
  row: PrereqRow
  guardId: string
  uploading: string | null
  deleting: string | null
  onUploadClick: (name: string) => void
  onDelete: (row: PrereqRow) => void
  canCreate: boolean
  canDelete: boolean
}) {
  const [showHistory, setShowHistory] = useState(false)
  const hasAttached = row.hasAttachment || !!row.documentUrl
  const isUploadingThis = uploading === row.docTypeName
  const isDeletingThis = deleting === row.prereqId

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors">
        {/* Document Name */}
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <span className="font-medium text-[var(--text)]">{row.docTypeName}</span>
          </div>
        </td>

        {/* System Template actions */}
        <td className="px-4 py-3">
          {(() => {
            const slug = DOC_SLUG_MAP[row.docTypeName]
            if (!slug) return (
              <span className="text-xs text-[var(--text-muted)] opacity-50">—</span>
            )
            const url = `/api/guards/${guardId}/system-doc/${slug}`
            return (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => window.open(url, "_blank")}
                  title="View system-generated document"
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <Eye className="h-3 w-3" /> View
                </button>
                <a
                  href={url}
                  download={`${row.docTypeName}.html`}
                  title="Download system-generated document"
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors"
                >
                  <Download className="h-3 w-3" /> Download
                </a>
              </div>
            )
          })()}
        </td>

        {/* Attached By */}
        <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
          {hasAttached ? (row.verifiedBy || "—") : "—"}
        </td>

        {/* Attached At */}
        <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
          {hasAttached ? formatDate(row.updatedAt) : "—"}
        </td>

        {/* Attached Document actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {hasAttached && (
              <>
                <button
                  onClick={() => viewAttachment(guardId, row)}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  <Eye className="h-3 w-3" /> View
                </button>
                <button
                  onClick={() => downloadAttachment(guardId, row)}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              </>
            )}
            {canCreate && (
              <button
                onClick={() => onUploadClick(row.docTypeName)}
                disabled={isUploadingThis}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] border border-[var(--border)] transition-colors disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {isUploadingThis ? "Uploading..." : hasAttached ? "Replace" : "Upload"}
              </button>
            )}
            {hasAttached && row.prereqId && (
              <>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] border border-[var(--border)] transition-colors"
                  title="Version history"
                >
                  <History className="h-3 w-3" />
                  {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {canDelete && (
                  <button
                    onClick={() => onDelete(row)}
                    disabled={isDeletingThis}
                    className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    {isDeletingThis ? "..." : "Delete"}
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
      {showHistory && row.prereqId && (
        <HistoryPanel
          guardId={guardId}
          prereqId={row.prereqId}
          colSpan={5}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  )
}

// ── Regular Attachment Row ─────────────────────────────────────────────────────
function DocRow({
  row,
  guardId,
  uploading,
  deleting,
  onUploadClick,
  onDelete,
  canCreate,
  canDelete,
}: {
  row: PrereqRow
  guardId: string
  uploading: string | null
  deleting: string | null
  onUploadClick: (name: string) => void
  onDelete: (row: PrereqRow) => void
  canCreate: boolean
  canDelete: boolean
}) {
  const [showHistory, setShowHistory] = useState(false)
  const hasFile = row.hasAttachment || !!row.documentUrl
  const isUploadingThis = uploading === row.docTypeName
  const isDeletingThis = deleting === row.prereqId

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors">
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className={`h-4 w-4 shrink-0 ${hasFile ? "text-blue-500" : "text-[var(--text-muted)]"}`} />
            <span className="font-medium text-[var(--text)]">{row.docTypeName}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{row.verifiedBy || "—"}</td>
        <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{hasFile ? formatDate(row.updatedAt) : "—"}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {hasFile && (
              <>
                <button
                  onClick={() => viewAttachment(guardId, row)}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  <Eye className="h-3 w-3" /> View
                </button>
                <button
                  onClick={() => downloadAttachment(guardId, row)}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              </>
            )}
            {canCreate && (
              <button
                onClick={() => onUploadClick(row.docTypeName)}
                disabled={isUploadingThis}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] border border-[var(--border)] transition-colors disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {isUploadingThis ? "Uploading..." : hasFile ? "Replace" : "Upload"}
              </button>
            )}
            {hasFile && row.prereqId && (
              <>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] border border-[var(--border)] transition-colors"
                  title="Version history"
                >
                  <History className="h-3 w-3" />
                  {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {canDelete && (
                  <button
                    onClick={() => onDelete(row)}
                    disabled={isDeletingThis}
                    className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    {isDeletingThis ? "..." : "Delete"}
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
      {showHistory && row.prereqId && (
        <HistoryPanel
          guardId={guardId}
          prereqId={row.prereqId}
          colSpan={4}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AttachmentsTab({ guardId, canCreate = false, canDelete = false }: AttachmentsTabProps) {
  const [rows, setRows] = useState<PrereqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingDocType, setPendingDocType] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/guards/${guardId}/prerequisites`)
      if (!res.ok) throw new Error("Failed to load")
      const all: PrereqRow[] = await res.json()
      setRows(all)
    } catch {
      setError("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [guardId])

  useEffect(() => { load() }, [load])

  const handleUploadClick = (docTypeName: string) => {
    setPendingDocType(docTypeName)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingDocType) return
    e.target.value = ""
    setUploading(pendingDocType)
    try {
      const base64 = await readFileAsBase64(file)
      const res = await fetch(`/api/guards/${guardId}/prerequisites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docTypeName: pendingDocType, attachmentData: base64, attachmentName: file.name }),
      })
      if (!res.ok) throw new Error("Upload failed")
      await load()
    } catch {
      setError("Failed to upload document")
    } finally {
      setUploading(null)
      setPendingDocType(null)
    }
  }

  const handleDelete = async (row: PrereqRow) => {
    if (!row.prereqId) return
    setDeleting(row.prereqId)
    try {
      const res = await fetch(`/api/guards/${guardId}/prerequisites/${row.prereqId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      await load()
    } catch {
      setError("Failed to remove document")
    } finally {
      setDeleting(null)
    }
  }

  const systemDocs = rows.filter((r) => r.isSystemGenerated)
  const attachmentDocs = rows.filter((r) => !r.isSystemGenerated && r.docCategory === "ATTACHMENT" && r.isActive)

  if (loading) return <div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading attachments...</div>

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--text)]">Attachments</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── System-Generated Documents ── */}
      <div className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">System Documents</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Download the system template, fill it in, then upload the completed copy back.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] w-[28%]">Document Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] w-[18%]">
                  System Template
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Attached By</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Attached At</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Attached Document</th>
              </tr>
            </thead>
            <tbody>
              {systemDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                    System documents are loading...
                  </td>
                </tr>
              ) : systemDocs.map((row) => (
                <SystemDocRow
                  key={row.docTypeId}
                  row={row}
                  guardId={guardId}
                  uploading={uploading}
                  deleting={deleting}
                  onUploadClick={handleUploadClick}
                  onDelete={handleDelete}
                  canCreate={canCreate}
                  canDelete={canDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Additional Attachments ── */}
      <div className="ui-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Additional Attachments</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Configured in <strong>Guards → Prerequisites</strong>. Add document types with category <em>Attachment</em>.
            </p>
          </div>
          {attachmentDocs.length > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              {attachmentDocs.filter((r) => r.hasAttachment || r.documentUrl).length} / {attachmentDocs.length} uploaded
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] w-[40%]">Document Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Attached By</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Attached At</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attachmentDocs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                    No attachment document types configured. Go to{" "}
                    <strong>Guards → Prerequisites</strong> and add types with category <em>Attachment Document</em>.
                  </td>
                </tr>
              ) : attachmentDocs.map((row) => (
                <DocRow
                  key={row.docTypeId}
                  row={row}
                  guardId={guardId}
                  uploading={uploading}
                  deleting={deleting}
                  onUploadClick={handleUploadClick}
                  onDelete={handleDelete}
                  canCreate={canCreate}
                  canDelete={canDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
