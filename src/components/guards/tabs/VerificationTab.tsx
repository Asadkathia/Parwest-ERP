"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { CheckCircle, XCircle, Clock, Eye, ShieldCheck, X, Upload, FileText } from "lucide-react"

type PrereqRow = {
  docTypeId: string
  docTypeName: string
  isActive: boolean
  docCategory: string
  isSystemGenerated: boolean
  prereqId: string | null
  status: string
  verificationStatus: string | null
  attachmentData: string | null
  attachmentName: string | null
  documentUrl: string | null
  uploadedBy: string | null
  uploadedAt: string | null
  verifiedAt: string | null
  verifiedBy: string | null
  editedBy: string | null
  editedAt: string | null
  expiryDate: string | null
  comments: string | null
  updatedAt: string | null
}

const VERIFICATION_STATUSES = [
  { value: "REQUEST_SUBMITTED", label: "Request Submitted" },
  { value: "REQUEST_NOT_SUBMITTED", label: "Request Not Submitted" },
  { value: "VERIFIED", label: "Verified" },
  { value: "NON_VERIFIED", label: "Non Verified" },
  { value: "LETTER_ISSUED", label: "Letter Issued" },
  { value: "LETTER_NOT_ISSUED", label: "Letter Not Issued" },
  { value: "FEEDBACK_RECEIVED", label: "Feedback Received" },
  { value: "FEEDBACK_PENDING", label: "Feedback Pending" },
]

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

function viewDocument(row: PrereqRow) {
  const data = row.attachmentData || row.documentUrl
  if (!data) return
  const win = window.open()
  if (!win) return
  if (data.startsWith("data:")) {
    win.document.write(`<html><body style="margin:0"><iframe src="${data}" width="100%" height="100%" style="border:none"></iframe></body></html>`)
  } else {
    win.location.href = data
  }
}

interface VerificationTabProps {
  guardId: string
}

export default function VerificationTab({ guardId }: VerificationTabProps) {
  const [rows, setRows] = useState<PrereqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [verifyModal, setVerifyModal] = useState<PrereqRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUploadDocType, setPendingUploadDocType] = useState<string | null>(null)

  // Modal form state
  const [modalVerifStatus, setModalVerifStatus] = useState("")
  const [modalComments, setModalComments] = useState("")
  const [modalExpiry, setModalExpiry] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/guards/${guardId}/prerequisites`)
      if (!res.ok) throw new Error("Failed to load")
      const data: PrereqRow[] = await res.json()
      // Only show VERIFICATION category docs
      setRows(data.filter((r) => r.docCategory === "VERIFICATION" && r.isActive))
    } catch {
      setError("Failed to load verification data")
    } finally {
      setLoading(false)
    }
  }, [guardId])

  useEffect(() => { load() }, [load])

  // Upload document directly from verification tab
  const handleUploadClick = (docTypeName: string) => {
    setPendingUploadDocType(docTypeName)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUploadDocType) return
    e.target.value = ""
    setUploading(pendingUploadDocType)
    try {
      const base64 = await readFileAsBase64(file)
      const res = await fetch(`/api/guards/${guardId}/prerequisites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docTypeName: pendingUploadDocType, attachmentData: base64, attachmentName: file.name }),
      })
      if (!res.ok) throw new Error("Upload failed")
      await load()
    } catch {
      setError("Failed to upload document")
    } finally {
      setUploading(null)
      setPendingUploadDocType(null)
    }
  }

  const openVerifyModal = (row: PrereqRow) => {
    setVerifyModal(row)
    setModalVerifStatus(row.verificationStatus || "")
    setModalComments(row.comments || "")
    setModalExpiry(row.expiryDate ? row.expiryDate.split("T")[0] : "")
  }

  const handleSaveVerification = async () => {
    if (!verifyModal?.prereqId) return
    setSaving(true)
    try {
      // Derive simplified status from verification status
      let status = "PENDING"
      if (modalVerifStatus === "VERIFIED") status = "VERIFIED"
      else if (modalVerifStatus === "NON_VERIFIED") status = "REJECTED"

      const res = await fetch(`/api/guards/${guardId}/prerequisites/${verifyModal.prereqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          verificationStatus: modalVerifStatus || null,
          comments: modalComments || null,
          expiryDate: modalExpiry || null,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      setVerifyModal(null)
      await load()
    } catch {
      setError("Failed to save verification")
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" }) : "—"

  const verifiedCount = rows.filter((r) => r.status === "VERIFIED").length
  const uploadedCount = rows.filter((r) => r.attachmentData || r.documentUrl).length
  const pendingCount = rows.filter((r) => r.isActive && !(r.attachmentData || r.documentUrl)).length

  if (loading) return <div className="py-12 text-center text-sm text-gray-500">Loading verifications...</div>

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Verification Status</h2>
        <div className="flex items-center gap-4 text-sm">
          <span><span className="text-gray-500">Verified: </span><span className="font-semibold text-green-600">{verifiedCount}/{rows.length}</span></span>
          <span><span className="text-gray-500">Docs Uploaded: </span><span className="font-semibold text-blue-600">{uploadedCount}</span></span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
              <Clock className="h-3 w-3" /> {pendingCount} doc{pendingCount > 1 ? "s" : ""} missing
            </span>
          )}
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Guard status warning */}
      {verifiedCount < rows.length && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Guard status is <strong>PENDING</strong> — {rows.length - verifiedCount} verification{rows.length - verifiedCount > 1 ? "s" : ""} not yet complete.
            Guard cannot be deployed until all verifications are done.
          </span>
        </div>
      )}
      {verifiedCount === rows.length && rows.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>All verifications complete. Guard is eligible for deployment.</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Document</th>
              <th className="px-4 py-3 text-left">Uploaded File</th>
              <th className="px-4 py-3 text-left">Verification Status</th>
              <th className="px-4 py-3 text-left">Uploaded By</th>
              <th className="px-4 py-3 text-left">Uploaded Date</th>
              <th className="px-4 py-3 text-left">Verified By</th>
              <th className="px-4 py-3 text-left">Verified Date</th>
              <th className="px-4 py-3 text-left">Edited By</th>
              <th className="px-4 py-3 text-left">Expiry</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                  No verification document types configured. Go to <strong>Guards → Prerequisites</strong> and add document types with category <em>Verification Document</em>.
                </td>
              </tr>
            ) : rows.map((row, idx) => {
              const hasFile = !!(row.attachmentData || row.documentUrl)
              const isUploadingThis = uploading === row.docTypeName
              return (
                <tr key={row.docTypeId} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{row.docTypeName}</td>
                  <td className="px-4 py-3">
                    {hasFile ? (
                      <button onClick={() => viewDocument(row)} className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                        <FileText className="h-3 w-3" />
                        {row.attachmentName || "View"}
                      </button>
                    ) : (
                      <span className="text-xs text-orange-500 font-medium">Not Uploaded</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <VerifBadge status={row.status} verificationStatus={row.verificationStatus} hasFile={hasFile} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{row.uploadedBy || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.uploadedAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{row.verifiedBy || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.verifiedAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {row.editedBy ? (
                      <span title={row.editedAt ? `Edited: ${formatDate(row.editedAt)}` : undefined}>
                        {row.editedBy}
                        {row.editedAt && <span className="block text-gray-400">{formatDate(row.editedAt)}</span>}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.expiryDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* Upload button — always shown in verification tab */}
                      <button
                        onClick={() => handleUploadClick(row.docTypeName)}
                        disabled={isUploadingThis}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        title={hasFile ? "Replace document" : "Upload document"}
                      >
                        <Upload className="h-3 w-3" />
                        {isUploadingThis ? "..." : hasFile ? "Replace" : "Upload"}
                      </button>
                      {/* Verify button — requires file */}
                      <button
                        onClick={() => openVerifyModal(row)}
                        disabled={!hasFile}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={!hasFile ? "Upload document first" : "Set verification status"}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {row.prereqId && hasFile ? "Update" : "Verify"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Verification Modal */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-base font-semibold">Set Verification Status</h3>
              <button onClick={() => setVerifyModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                {verifyModal.docTypeName}
              </div>
              {(verifyModal.attachmentData || verifyModal.documentUrl) && (
                <button onClick={() => viewDocument(verifyModal)} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Eye className="h-4 w-4" /> View Uploaded Document
                </button>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Verification Status <span className="text-red-500">*</span></label>
                <select
                  value={modalVerifStatus}
                  onChange={(e) => setModalVerifStatus(e.target.value)}
                  className="ui-select"
                >
                  <option value="">-- Select Status --</option>
                  {VERIFICATION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Expiry Date (optional)</label>
                <input type="date" value={modalExpiry} onChange={(e) => setModalExpiry(e.target.value)} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Comments</label>
                <textarea value={modalComments} onChange={(e) => setModalComments(e.target.value)} rows={3} className="ui-input resize-none" placeholder="Optional notes..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button onClick={() => setVerifyModal(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSaveVerification}
                disabled={saving || !modalVerifStatus}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : <><CheckCircle className="h-4 w-4" /> Submit</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VerifBadge({ status, verificationStatus, hasFile }: { status: string; verificationStatus: string | null; hasFile: boolean }) {
  if (!hasFile) {
    return <div className="flex items-center gap-1 text-orange-500"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Not Uploaded</span></div>
  }
  if (status === "VERIFIED" || verificationStatus === "VERIFIED") {
    return <div className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /><span className="text-xs font-medium">Verified</span></div>
  }
  if (status === "REJECTED" || verificationStatus === "NON_VERIFIED") {
    return <div className="flex items-center gap-1 text-red-600"><XCircle className="h-4 w-4" /><span className="text-xs font-medium">Rejected</span></div>
  }
  if (verificationStatus) {
    const label: Record<string, string> = {
      REQUEST_SUBMITTED: "Request Submitted",
      REQUEST_NOT_SUBMITTED: "Not Submitted",
      LETTER_ISSUED: "Letter Issued",
      LETTER_NOT_ISSUED: "Letter Not Issued",
      FEEDBACK_RECEIVED: "Feedback Received",
      FEEDBACK_PENDING: "Feedback Pending",
    }
    return <div className="flex items-center gap-1 text-blue-600"><Clock className="h-4 w-4" /><span className="text-xs font-medium">{label[verificationStatus] || verificationStatus}</span></div>
  }
  return <div className="flex items-center gap-1 text-blue-500"><Clock className="h-4 w-4" /><span className="text-xs font-medium">Uploaded — Pending</span></div>
}
