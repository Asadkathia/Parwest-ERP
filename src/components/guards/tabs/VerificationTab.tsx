"use client"

import { useState, useEffect, useCallback } from "react"
import { CheckCircle, XCircle, Clock, Eye, ShieldCheck, X, FileText } from "lucide-react"

type PrereqRow = {
  docTypeId: string
  docTypeName: string
  isActive: boolean
  prereqId: string | null
  status: string
  verificationStatus: string | null
  attachmentData: string | null
  attachmentName: string | null
  documentUrl: string | null
  verifiedAt: string | null
  verifiedBy: string | null
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
  { value: "FEEDBACK_RECEIVED", label: "Feed Back Received" },
  { value: "FEEDBACK_PENDING", label: "Feed Back Pending" },
]

interface VerificationTabProps {
  guardId: string
}

export default function VerificationTab({ guardId }: VerificationTabProps) {
  const [rows, setRows] = useState<PrereqRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [verifyModal, setVerifyModal] = useState<PrereqRow | null>(null)
  const [saving, setSaving] = useState(false)

  // Modal form state
  const [modalStatus, setModalStatus] = useState("")
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
      setRows(data.filter((r) => r.isActive))
    } catch {
      setError("Failed to load verification data")
    } finally {
      setLoading(false)
    }
  }, [guardId])

  useEffect(() => { load() }, [load])

  const openVerifyModal = (row: PrereqRow) => {
    setVerifyModal(row)
    setModalStatus(row.status || "PENDING")
    setModalVerifStatus(row.verificationStatus || "")
    setModalComments(row.comments || "")
    setModalExpiry(row.expiryDate ? row.expiryDate.split("T")[0] : "")
  }

  const handleSaveVerification = async () => {
    if (!verifyModal?.prereqId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/guards/${guardId}/prerequisites/${verifyModal.prereqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: modalStatus,
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

  const handleViewAttachment = (row: PrereqRow) => {
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

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" }) : "—"

  const verifiedCount = rows.filter((r) => r.status === "VERIFIED").length
  const uploadedCount = rows.filter((r) => r.attachmentData || r.documentUrl).length
  const pendingCount = rows.filter((r) => (r.attachmentData || r.documentUrl) && r.status === "PENDING").length

  if (loading) return <div className="py-12 text-center text-sm text-gray-500">Loading verifications...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Verification Status</h2>
        <div className="flex items-center gap-4 text-sm">
          <span><span className="text-gray-500">Verified: </span><span className="font-semibold text-green-600">{verifiedCount}/{rows.length}</span></span>
          <span><span className="text-gray-500">Uploaded: </span><span className="font-semibold text-blue-600">{uploadedCount}</span></span>
          {pendingCount > 0 && <span><span className="text-gray-500">Pending Review: </span><span className="font-semibold text-orange-500">{pendingCount}</span></span>}
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Document Type</th>
              <th className="px-4 py-3 text-left">Attachment</th>
              <th className="px-4 py-3 text-left">Verification Status</th>
              <th className="px-4 py-3 text-left">Verified By</th>
              <th className="px-4 py-3 text-left">Verified Date</th>
              <th className="px-4 py-3 text-left">Expiry</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No prerequisite document types configured.</td></tr>
            ) : rows.map((row, idx) => {
              const hasFile = !!(row.attachmentData || row.documentUrl)
              return (
                <tr key={row.docTypeId} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{row.docTypeName}</td>
                  <td className="px-4 py-3">
                    {hasFile ? (
                      <button onClick={() => handleViewAttachment(row)} className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
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
                  <td className="px-4 py-3 text-xs text-gray-600">{row.verifiedBy || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.verifiedAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.expiryDate)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openVerifyModal(row)}
                      disabled={!hasFile}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title={!hasFile ? "Document must be uploaded first" : "Add/Update Verification"}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {row.prereqId && hasFile ? "Update" : "Verify"}
                    </button>
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
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-base font-semibold">Guard Verification</h3>
              <button onClick={() => setVerifyModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {/* Doc type */}
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                {verifyModal.docTypeName}
              </div>

              {/* View attachment */}
              {(verifyModal.attachmentData || verifyModal.documentUrl) && (
                <button
                  onClick={() => handleViewAttachment(verifyModal)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Eye className="h-4 w-4" /> View Uploaded Document
                </button>
              )}

              {/* Verification Status (detailed) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Select Verification Status</label>
                <select
                  value={modalVerifStatus}
                  onChange={(e) => {
                    setModalVerifStatus(e.target.value)
                    // Auto-set simplified status
                    if (e.target.value === "VERIFIED") setModalStatus("VERIFIED")
                    else if (e.target.value === "NON_VERIFIED") setModalStatus("REJECTED")
                    else setModalStatus("PENDING")
                  }}
                  className="ui-select"
                >
                  <option value="">-- Select Verification Status --</option>
                  {VERIFICATION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Expiry Date (optional)</label>
                <input
                  type="date"
                  value={modalExpiry}
                  onChange={(e) => setModalExpiry(e.target.value)}
                  className="ui-input"
                />
              </div>

              {/* Comments */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Comments</label>
                <textarea
                  value={modalComments}
                  onChange={(e) => setModalComments(e.target.value)}
                  rows={3}
                  className="ui-input resize-none"
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={() => setVerifyModal(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
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
    return (
      <div className="flex items-center gap-1 text-orange-500">
        <Clock className="h-4 w-4" />
        <span className="text-xs font-medium">Not Uploaded</span>
      </div>
    )
  }
  if (status === "VERIFIED" || verificationStatus === "VERIFIED") {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Verified</span>
      </div>
    )
  }
  if (status === "REJECTED" || verificationStatus === "NON_VERIFIED") {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <XCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Rejected</span>
      </div>
    )
  }
  if (verificationStatus) {
    const label = { REQUEST_SUBMITTED: "Request Submitted", REQUEST_NOT_SUBMITTED: "Not Submitted", LETTER_ISSUED: "Letter Issued", LETTER_NOT_ISSUED: "Letter Not Issued", FEEDBACK_RECEIVED: "Feedback Received", FEEDBACK_PENDING: "Feedback Pending" }[verificationStatus] || verificationStatus
    return (
      <div className="flex items-center gap-1 text-blue-600">
        <Clock className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1 text-blue-500">
      <Clock className="h-4 w-4" />
      <span className="text-xs font-medium">Uploaded — Pending</span>
    </div>
  )
}
