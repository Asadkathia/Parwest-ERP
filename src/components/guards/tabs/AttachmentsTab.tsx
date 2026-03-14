"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Upload, FileText, Trash2, Eye, RefreshCw } from "lucide-react"

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
  updatedAt: string | null
}

interface AttachmentsTabProps {
  guardId: string
}

export default function AttachmentsTab({ guardId }: AttachmentsTabProps) {
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
      if (!res.ok) throw new Error("Failed to load attachments")
      setRows(await res.json())
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
        body: JSON.stringify({
          docTypeName: pendingDocType,
          attachmentData: base64,
          attachmentName: file.name,
        }),
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
      const res = await fetch(`/api/guards/${guardId}/prerequisites/${row.prereqId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      await load()
    } catch {
      setError("Failed to remove document")
    } finally {
      setDeleting(null)
    }
  }

  const handleView = (row: PrereqRow) => {
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

  const uploaded = rows.filter((r) => r.attachmentData || r.documentUrl)
  const missing = rows.filter((r) => r.isActive && !r.attachmentData && !r.documentUrl)

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500">Loading attachments...</div>
  }

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Attachments</h2>
        <button onClick={load} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Summary banner */}
      <div className="flex gap-4 rounded-lg border bg-gray-50 px-4 py-3 text-sm">
        <span className="text-green-700 font-medium">{uploaded.length} uploaded</span>
        <span className="text-gray-400">|</span>
        <span className="text-orange-600 font-medium">{missing.length} pending</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-600">{rows.length} total required</span>
      </div>

      {/* Documents table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const hasFile = !!(row.attachmentData || row.documentUrl)
              const isUploadingThis = uploading === row.docTypeName
              const isDeletingThis = deleting === row.prereqId

              return (
                <tr key={row.docTypeId} className={`border-t ${!row.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">
                    {row.docTypeName}
                    {!row.isActive && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {hasFile ? (
                      <div className="flex items-center gap-1 text-blue-700">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="max-w-[160px] truncate text-xs">{row.attachmentName || "document"}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No file</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} verificationStatus={row.verificationStatus} hasFile={hasFile} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {row.updatedAt && hasFile ? new Date(row.updatedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {hasFile && (
                        <button
                          onClick={() => handleView(row)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      )}
                      <button
                        onClick={() => handleUploadClick(row.docTypeName)}
                        disabled={isUploadingThis}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        <Upload className="h-3 w-3" />
                        {isUploadingThis ? "Uploading..." : hasFile ? "Replace" : "Upload"}
                      </button>
                      {hasFile && row.prereqId && (
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={isDeletingThis}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          {isDeletingThis ? "..." : "Remove"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No prerequisite document types configured. Go to Guards → Prerequisites to add them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status, verificationStatus, hasFile }: { status: string; verificationStatus: string | null; hasFile: boolean }) {
  if (!hasFile) {
    return <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Not Uploaded</span>
  }
  if (verificationStatus === "VERIFIED" || status === "VERIFIED") {
    return <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Verified</span>
  }
  if (status === "REJECTED") {
    return <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rejected</span>
  }
  return <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Uploaded — Pending Review</span>
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}
