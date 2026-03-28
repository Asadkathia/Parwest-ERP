"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { FileCheck2, Plus, Eye, Download, Undo2, Trash2, X, FileText, Clock, History, AlertTriangle } from "lucide-react"

type HistoryEntry = {
  id: string
  action: string
  performedBy: string | null
  performedAt: string
  details: string | null
}

type PledgedDocRecord = {
  id: string
  guardId: string
  documentTypeName: string
  receivedBy: string | null
  receivedAt: string
  returnedBy: string | null
  returnedAt: string | null
  status: string
  returnType: string | null
  returnConditionId: string | null
  returnCondition: { id: string; name: string } | null
  returnReason: string | null
  expectedReturnDate: string | null
  attachmentData: string | null
  attachmentName: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  history: HistoryEntry[]
}

type PledgeableDocType = {
  id: string
  name: string
  description: string | null
}

type ReturnCondition = {
  id: string
  name: string
  description: string | null
}

interface PledgedDocumentsTabProps {
  guardId: string
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  return `${d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })} ${d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}`
}

function isOverdue(record: PledgedDocRecord): boolean {
  if (record.status !== "HELD" || !record.expectedReturnDate) return false
  return new Date(record.expectedReturnDate) < new Date()
}

function openDoc(data: string) {
  const win = window.open()
  if (!win) return
  if (data.startsWith("data:")) {
    const arr = data.split(",")
    const mime = arr[0].match(/:(.*?);/)![1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8 = new Uint8Array(n)
    while (n--) u8[n] = bstr.charCodeAt(n)
    win.location.href = URL.createObjectURL(new Blob([u8], { type: mime }))
  } else {
    win.location.href = data
  }
}

function downloadDoc(data: string, name: string) {
  const a = document.createElement("a")
  a.href = data
  a.download = name
  a.click()
}

export default function PledgedDocumentsTab({ guardId }: PledgedDocumentsTabProps) {
  const [records, setRecords] = useState<PledgedDocRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Add modal
  const [showAdd, setShowAdd] = useState(false)
  const [docTypes, setDocTypes] = useState<PledgeableDocType[]>([])
  const [docTypesLoading, setDocTypesLoading] = useState(false)
  const [selectedType, setSelectedType] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [addFile, setAddFile] = useState<File | null>(null)
  const [addFileData, setAddFileData] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [addError, setAddError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Return modal
  const [returnRec, setReturnRec] = useState<PledgedDocRecord | null>(null)
  const [returnType, setReturnType] = useState<"CLEARANCE" | "TEMPORARY">("CLEARANCE")
  const [returnConditions, setReturnConditions] = useState<ReturnCondition[]>([])
  const [returnCondId, setReturnCondId] = useState("")
  const [returnReason, setReturnReason] = useState("")
  const [expectedReturnDate, setExpectedReturnDate] = useState("")
  const [returnError, setReturnError] = useState("")
  const [returning, setReturning] = useState(false)

  // History modal
  const [historyRec, setHistoryRec] = useState<PledgedDocRecord | null>(null)

  // Delete confirm
  const [deleteRec, setDeleteRec] = useState<PledgedDocRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/guards/${guardId}/pledged-docs`)
      if (!res.ok) throw new Error()
      setRecords(await res.json())
    } catch {
      setError("Failed to load pledged document records.")
    } finally {
      setLoading(false)
    }
  }, [guardId])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setShowAdd(true)
    setSelectedType("")
    setAddNotes("")
    setAddFile(null)
    setAddFileData(null)
    setAddError("")
    setDocTypesLoading(true)
    fetch("/api/guard-pledgeable-documents")
      .then((r) => r.ok ? r.json() : [])
      .then(setDocTypes)
      .finally(() => setDocTypesLoading(false))
  }

  const openReturn = (rec: PledgedDocRecord) => {
    setReturnRec(rec)
    setReturnType("CLEARANCE")
    setReturnCondId("")
    setReturnReason("")
    setExpectedReturnDate("")
    setReturnError("")
    // Load return conditions
    fetch("/api/pledge-return-conditions")
      .then((r) => r.ok ? r.json() : [])
      .then(setReturnConditions)
      .catch(() => setReturnConditions([]))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAddFile(file)
    if (!file) { setAddFileData(null); return }
    const reader = new FileReader()
    reader.onload = () => setAddFileData(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleAdd = async () => {
    if (!selectedType) { setAddError("Please select a document type."); return }
    setSubmitting(true)
    setAddError("")
    try {
      const res = await fetch(`/api/guards/${guardId}/pledged-docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTypeName: selectedType,
          attachmentData: addFileData ?? undefined,
          attachmentName: addFile?.name ?? undefined,
          notes: addNotes || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Failed to add record")
      }
      setShowAdd(false)
      await load()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add record")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturn = async () => {
    if (!returnRec) return
    if (returnType === "TEMPORARY" && !returnCondId && !returnReason.trim()) {
      setReturnError("Select a condition or enter a reason for temporary issuance.")
      return
    }
    setReturning(true)
    setReturnError("")
    try {
      const res = await fetch(`/api/guards/${guardId}/pledged-docs/${returnRec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnType,
          returnConditionId: returnType === "TEMPORARY" && returnCondId ? returnCondId : null,
          returnReason: returnType === "TEMPORARY" && returnReason.trim() ? returnReason.trim() : null,
          expectedReturnDate: returnType === "TEMPORARY" && expectedReturnDate ? expectedReturnDate : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Failed to process return")
      }
      setReturnRec(null)
      await load()
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : "Failed to process return")
    } finally {
      setReturning(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteRec) return
    setDeleting(true)
    try {
      await fetch(`/api/guards/${guardId}/pledged-docs/${deleteRec.id}`, { method: "DELETE" })
      setDeleteRec(null)
      await load()
    } catch { /* silent */ } finally {
      setDeleting(false)
    }
  }

  const overdueCount = records.filter(isOverdue).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-[var(--text)]">Pledged Documents</h2>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} overdue
            </span>
          )}
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table Card */}
      <div className="ui-card overflow-hidden">
        {loading ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">Loading...</p>
        ) : records.length === 0 ? (
          <div className="py-16 text-center">
            <FileCheck2 className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)]">No pledged documents found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                  {["#", "Document", "Received By", "Received At", "Return Type", "Returned By", "Returned At", "Expected Return", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((rec, idx) => {
                  const hasFile = !!rec.attachmentData
                  const isHeld = rec.status === "HELD"
                  const overdue = isOverdue(rec)
                  return (
                    <tr
                      key={rec.id}
                      className={`border-b border-[var(--border)] last:border-0 transition-colors ${overdue ? "bg-red-50 hover:bg-red-100" : "hover:bg-[var(--surface-muted)]"}`}
                    >
                      <td className="px-4 py-3 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                          <span className="font-medium text-[var(--text)]">{rec.documentTypeName}</span>
                          {overdue && <span title="Expected return date passed"><AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" /></span>}
                        </div>
                        {rec.notes && <p className="mt-0.5 text-xs text-[var(--text-muted)] pl-6">{rec.notes}</p>}
                        {rec.returnReason && <p className="mt-0.5 text-xs text-orange-700 pl-6">Reason: {rec.returnReason}</p>}
                        {rec.returnCondition && <p className="mt-0.5 text-xs text-orange-700 pl-6">Condition: {rec.returnCondition.name}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{rec.receivedBy || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{fmt(rec.receivedAt)}</td>
                      <td className="px-4 py-3">
                        {rec.returnType ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            rec.returnType === "TEMPORARY" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {rec.returnType === "TEMPORARY" ? "Temporary" : "Clearance"}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{rec.returnedBy || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{fmt(rec.returnedAt)}</td>
                      <td className="px-4 py-3 text-xs">
                        {rec.expectedReturnDate ? (
                          <span className={overdue ? "font-semibold text-red-700" : "text-[var(--text-muted)]"}>
                            {fmt(rec.expectedReturnDate)}
                            {overdue && " ⚠"}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isHeld
                            ? overdue ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                          {isHeld && overdue ? "OVERDUE" : rec.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {isHeld && (
                            <button
                              onClick={() => openReturn(rec)}
                              className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 border border-orange-200 transition-colors"
                            >
                              <Undo2 className="h-3 w-3" /> Return
                            </button>
                          )}
                          {rec.history.length > 0 && (
                            <button
                              onClick={() => setHistoryRec(rec)}
                              className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 border border-purple-200 transition-colors"
                            >
                              <History className="h-3 w-3" /> History
                            </button>
                          )}
                          {hasFile && (
                            <>
                              <button
                                onClick={() => openDoc(rec.attachmentData!)}
                                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 transition-colors"
                              >
                                <Eye className="h-3 w-3" /> View
                              </button>
                              <button
                                onClick={() => downloadDoc(rec.attachmentData!, rec.attachmentName || rec.documentTypeName)}
                                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                              >
                                <Download className="h-3 w-3" /> Download
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setDeleteRec(rec)}
                            className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h3 className="text-base font-semibold text-[var(--text)]">Add Pledged Document</h3>
              <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              {addError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</div>
              )}
              <div>
                <label className="ui-label">Select Document Type <span className="text-red-500">*</span></label>
                {docTypesLoading ? (
                  <p className="text-sm text-[var(--text-muted)]">Loading types...</p>
                ) : (
                  <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="ui-select">
                    <option value="">— Select a type —</option>
                    {docTypes.map((dt) => (
                      <option key={dt.id} value={dt.name}>{dt.name}</option>
                    ))}
                  </select>
                )}
                {docTypes.length === 0 && !docTypesLoading && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    No types configured. Go to <strong>Guards → Prerequisites → Pledged Document Types</strong> to add types.
                  </p>
                )}
              </div>
              <div>
                <label className="ui-label">
                  Upload Document <span className="text-xs font-normal text-[var(--text-muted)]">(optional)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="ui-input text-sm"
                />
                {addFile && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <FileText className="h-3 w-3" /> {addFile.name}
                  </p>
                )}
              </div>
              <div>
                <label className="ui-label">
                  Notes <span className="text-xs font-normal text-[var(--text-muted)]">(optional)</span>
                </label>
                <textarea
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional notes..."
                  className="ui-input resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={submitting || !selectedType}
                className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Modal ── */}
      {returnRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h3 className="text-base font-semibold text-[var(--text)]">Return Document</h3>
              <button onClick={() => setReturnRec(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-[var(--text)]">
                Returning: <strong>{returnRec.documentTypeName}</strong>
              </p>

              {returnError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{returnError}</div>
              )}

              {/* Return type */}
              <div>
                <label className="ui-label">Return Type <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="CLEARANCE"
                      checked={returnType === "CLEARANCE"}
                      onChange={() => setReturnType("CLEARANCE")}
                    />
                    <span className="text-sm font-medium">On Clearance</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="TEMPORARY"
                      checked={returnType === "TEMPORARY"}
                      onChange={() => setReturnType("TEMPORARY")}
                    />
                    <span className="text-sm font-medium">Temporary Issuance</span>
                  </label>
                </div>
                {returnType === "CLEARANCE" && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Document is permanently returned — guard is cleared.</p>
                )}
                {returnType === "TEMPORARY" && (
                  <p className="mt-1 text-xs text-orange-700">Document is issued temporarily and must be returned by the expected date.</p>
                )}
              </div>

              {/* Temporary fields */}
              {returnType === "TEMPORARY" && (
                <>
                  <div>
                    <label className="ui-label">Return Condition <span className="text-xs font-normal text-[var(--text-muted)]">(optional)</span></label>
                    <select
                      value={returnCondId}
                      onChange={(e) => setReturnCondId(e.target.value)}
                      className="ui-select"
                    >
                      <option value="">— Select a condition —</option>
                      {returnConditions.map((rc) => (
                        <option key={rc.id} value={rc.id}>{rc.name}</option>
                      ))}
                    </select>
                    {returnConditions.length === 0 && (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">No conditions configured. Add them in Prerequisites.</p>
                    )}
                  </div>
                  <div>
                    <label className="ui-label">Reason <span className="text-xs font-normal text-[var(--text-muted)]">(if no condition selected)</span></label>
                    <input
                      type="text"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Explain reason for temporary issuance..."
                      className="ui-input"
                    />
                  </div>
                  <div>
                    <label className="ui-label">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Expected Return Date <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="ui-input"
                    />
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Row will turn red if document is not returned by this date.</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
              <button
                onClick={() => setReturnRec(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={returning || (returnType === "TEMPORARY" && !expectedReturnDate)}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" />
                {returning ? "Processing..." : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ── */}
      {historyRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">Document History</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{historyRec.documentTypeName}</p>
              </div>
              <button onClick={() => setHistoryRec(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {historyRec.history.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No history available.</p>
              ) : historyRec.history.map((h) => {
                let details: Record<string, unknown> = {}
                try { if (h.details) details = JSON.parse(h.details) } catch { /* ignore */ }
                return (
                  <div key={h.id} className="rounded-lg border border-[var(--border)] p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        h.action === "CREATED" ? "bg-blue-100 text-blue-800" :
                        h.action === "RETURNED" ? "bg-green-100 text-green-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {h.action}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">{fmtDateTime(h.performedAt)}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">By: <span className="font-medium text-[var(--text)]">{h.performedBy || "System"}</span></p>
                    {h.action === "RETURNED" && (
                      <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                        {details.returnType != null && <p>Return Type: <span className="font-medium">{String(details.returnType)}</span></p>}
                        {details.returnReason != null && <p>Reason: <span className="font-medium">{String(details.returnReason)}</span></p>}
                        {details.expectedReturnDate != null && <p>Expected Return: <span className="font-medium">{fmt(String(details.expectedReturnDate))}</span></p>}
                      </div>
                    )}
                    {h.action === "CREATED" && details.notes != null && (
                      <p className="text-xs text-[var(--text-muted)]">Notes: <span className="font-medium">{String(details.notes)}</span></p>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end border-t border-[var(--border)] px-6 py-4">
              <button
                onClick={() => setHistoryRec(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h3 className="text-base font-semibold text-red-700">Delete Record</h3>
              <button onClick={() => setDeleteRec(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[var(--text)]">
                Delete the record for <strong>{deleteRec.documentTypeName}</strong>? This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
              <button
                onClick={() => setDeleteRec(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}