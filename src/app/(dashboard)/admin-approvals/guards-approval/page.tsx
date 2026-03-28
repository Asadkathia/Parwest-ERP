"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldAlert, Check, X as XIcon, Clock, AlertTriangle } from "lucide-react"
import Link from "next/link"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import { Card, CardBody } from "@/components/ui/card"

type AgeConfig = { id: string; minAge: number; maxAge: number }
type AgeApproval = {
  id: string
  guardAge: number
  reason: string
  status: string
  requestedBy: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  notes: string | null
  createdAt: string
  guard: { id: string; parwestId: string; name: string; cnic: string; status: string; regionalOffice: { name: string } | null }
}

export default function GuardsApprovalPage() {
  // Age config state
  const [ageConfig, setAgeConfig] = useState<AgeConfig | null>(null)
  const [ageConfigLoading, setAgeConfigLoading] = useState(true)
  const [ageConfigSaving, setAgeConfigSaving] = useState(false)
  const [ageConfigError, setAgeConfigError] = useState("")
  const [ageConfigSuccess, setAgeConfigSuccess] = useState("")
  const [editMinAge, setEditMinAge] = useState("")
  const [editMaxAge, setEditMaxAge] = useState("")

  // Age approvals state
  const [approvals, setApprovals] = useState<AgeApproval[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(true)
  const [approvalsError, setApprovalsError] = useState("")
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [reviewModalApproval, setReviewModalApproval] = useState<AgeApproval | null>(null)
  const [approvalsFilter, setApprovalsFilter] = useState("PENDING")

  const loadAgeConfig = useCallback(async () => {
    setAgeConfigLoading(true)
    try {
      const res = await fetch("/api/guard-age-config")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAgeConfig(data)
      setEditMinAge(String(data.minAge))
      setEditMaxAge(String(data.maxAge))
    } catch {
      setAgeConfigError("Failed to load age config")
    } finally {
      setAgeConfigLoading(false)
    }
  }, [])

  const saveAgeConfig = async () => {
    const minAge = parseInt(editMinAge)
    const maxAge = parseInt(editMaxAge)
    if (!Number.isFinite(minAge) || !Number.isFinite(maxAge)) { setAgeConfigError("Enter valid numbers"); return }
    if (minAge >= maxAge) { setAgeConfigError("Min age must be less than max age"); return }
    setAgeConfigSaving(true)
    setAgeConfigError("")
    setAgeConfigSuccess("")
    try {
      const res = await fetch("/api/guard-age-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minAge, maxAge }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed") }
      const data = await res.json()
      setAgeConfig(data)
      setAgeConfigSuccess("Age limits saved successfully.")
      setTimeout(() => setAgeConfigSuccess(""), 3000)
    } catch (err: unknown) {
      setAgeConfigError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setAgeConfigSaving(false)
    }
  }

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true)
    setApprovalsError("")
    try {
      const res = await fetch(`/api/guard-age-approvals?status=${approvalsFilter}`)
      if (!res.ok) throw new Error()
      setApprovals(await res.json())
    } catch {
      setApprovalsError("Failed to load approval requests")
    } finally {
      setApprovalsLoading(false)
    }
  }, [approvalsFilter])

  const handleReview = async (action: "APPROVE" | "REJECT") => {
    if (!reviewModalApproval) return
    setReviewingId(reviewModalApproval.id)
    try {
      const res = await fetch(`/api/guard-age-approvals/${reviewModalApproval.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: reviewNotes || null }),
      })
      if (!res.ok) throw new Error()
      setReviewModalApproval(null)
      setReviewNotes("")
      await loadApprovals()
    } catch {
      setApprovalsError("Failed to process review")
    } finally {
      setReviewingId(null)
    }
  }

  useEffect(() => { loadAgeConfig() }, [loadAgeConfig])
  useEffect(() => { loadApprovals() }, [loadApprovals])

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Guards Approval"
        subtitle="Manage guard age limits and review age approval requests."
      />

      {/* ── Age Limit Configuration ── */}
      <Card>
        <CardBody className="space-y-4">
          <SectionTitle
            title="Guard Age Limit Configuration"
            subtitle="Set the minimum and maximum permitted age for guard enrollment. Guards outside these limits will require admin approval."
          />
          {ageConfigError && <InlineAlert type="error" message={ageConfigError} />}
          {ageConfigSuccess && <InlineAlert type="success" message={ageConfigSuccess} />}
          {ageConfigLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading...</p>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
                  Minimum Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editMinAge}
                  onChange={(e) => setEditMinAge(e.target.value)}
                  className="ui-input w-28"
                  placeholder="18"
                />
                <p className="mt-1 text-xs text-gray-400">Underage threshold</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
                  Maximum Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editMaxAge}
                  onChange={(e) => setEditMaxAge(e.target.value)}
                  className="ui-input w-28"
                  placeholder="45"
                />
                <p className="mt-1 text-xs text-gray-400">Overage threshold</p>
              </div>
              <ActionButton onClick={saveAgeConfig} disabled={ageConfigSaving}>
                {ageConfigSaving ? "Saving..." : "Save Limits"}
              </ActionButton>
            </div>
          )}
          <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <strong>How it works:</strong> When a guard&apos;s age is below the minimum or above the maximum, the system will still
            enroll the guard but flag it as <em>Pending Age Approval</em>. An approval request will appear in the section below for admin review.
          </p>
        </CardBody>
      </Card>

      {/* ── Age Approval Requests ── */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <SectionTitle
              title="Age Approval Requests"
              subtitle="Guards whose age is outside configured limits require your approval to be enrolled."
            />
            <div className="flex items-center gap-2">
              {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setApprovalsFilter(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    approvalsFilter === s
                      ? s === "PENDING" ? "bg-orange-500 text-white"
                        : s === "APPROVED" ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                      : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--border)]"
                  }`}
                >
                  {s}
                </button>
              ))}
              <button onClick={loadApprovals} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Refresh</button>
            </div>
          </div>

          {approvalsError && <InlineAlert type="error" message={approvalsError} />}

          {approvalsLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading...</p>
          ) : approvals.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed px-6 py-10 text-center text-sm text-[var(--text-muted)]">
              {approvalsFilter === "PENDING" ? "No pending age approval requests." : `No ${approvalsFilter.toLowerCase()} requests.`}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    {["#", "Guard", "Parwest ID", "Age", "Reason", "Requested By", "Status", "Actions"].map((h) => (
                      <th key={h} className="bg-[var(--surface-muted)] px-4 py-2 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((ap, idx) => (
                    <tr key={ap.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <td className="px-4 py-3 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/guards/${ap.guard.id}`} className="font-medium text-[var(--brand)] hover:underline">
                          {ap.guard.name}
                        </Link>
                        <p className="text-xs text-[var(--text-muted)]">{ap.guard.cnic}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{ap.guard.parwestId}</td>
                      <td className="px-4 py-3 font-semibold">{ap.guardAge} yrs</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          ap.reason === "UNDERAGE" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                        }`}>
                          <AlertTriangle className="h-3 w-3" />
                          {ap.reason === "UNDERAGE" ? "Underage" : "Overage"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{ap.requestedBy || "—"}</td>
                      <td className="px-4 py-3">
                        {ap.status === "PENDING" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                        {ap.status === "APPROVED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <Check className="h-3 w-3" /> Approved
                          </span>
                        )}
                        {ap.status === "REJECTED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            <XIcon className="h-3 w-3" /> Rejected
                          </span>
                        )}
                        {ap.reviewedBy && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">by {ap.reviewedBy}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {ap.status === "PENDING" ? (
                          <button
                            onClick={() => { setReviewModalApproval(ap); setReviewNotes("") }}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                          >
                            <ShieldAlert className="h-3 w-3" /> Review
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">
                            {ap.reviewedAt ? new Date(ap.reviewedAt).toLocaleDateString() : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Review Modal */}
      {reviewModalApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-orange-500" />
                Age Approval Review
              </h3>
              <button onClick={() => setReviewModalApproval(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-md bg-gray-50 border px-4 py-3 space-y-1">
                <p className="text-sm font-semibold">{reviewModalApproval.guard.name}</p>
                <p className="text-xs text-gray-500">Parwest ID: {reviewModalApproval.guard.parwestId} · CNIC: {reviewModalApproval.guard.cnic}</p>
                <p className="text-xs text-gray-500">Age: <strong>{reviewModalApproval.guardAge} years</strong></p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  reviewModalApproval.reason === "UNDERAGE" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                }`}>
                  <AlertTriangle className="h-3 w-3" />
                  {reviewModalApproval.reason === "UNDERAGE" ? "Underage" : "Overage"}
                </span>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes / Reason (optional)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="ui-input resize-none"
                  placeholder="Add a note for this decision..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={() => setReviewModalApproval(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview("REJECT")}
                disabled={!!reviewingId}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <XIcon className="h-4 w-4" /> Reject
              </button>
              <button
                onClick={() => handleReview("APPROVE")}
                disabled={!!reviewingId}
                className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}