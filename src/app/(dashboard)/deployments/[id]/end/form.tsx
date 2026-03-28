"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertTriangle, ShieldOff, MapPin, Clock, Calendar,
  User, Building2, CheckCircle2
} from "lucide-react"

type Deployment = {
  id: string
  status: string
  shiftType: string
  designation: string | null
  deploymentDate: Date
  endDate: Date | null
  deploymentType: string | null
  deploymentNature: string | null
  dayShiftStart: string | null
  dayShiftEnd: string | null
  nightShiftStart: string | null
  nightShiftEnd: string | null
  deployedByName: string | null
  guard: {
    id: string
    name: string
    parwestId: string
    phone: string | null
    photoUrl: string | null
    isExService: boolean
    exServiceType: string | null
  }
  client: { id: string; name: string }
  branch: { id: string; name: string; city: string | null } | null
  regionalOffice: { id: string; name: string }
}

type Props = { deployment: Deployment }

const REVOKE_REASONS = [
  { id: "CLIENT_REQUEST", label: "Client Request", desc: "Client requested removal of this guard" },
  { id: "GUARD_REQUEST", label: "Guard Request", desc: "Guard voluntarily requested transfer/exit" },
  { id: "TRANSFER", label: "Transfer", desc: "Guard transferred to another deployment" },
  { id: "CONTRACT_END", label: "Contract Ended", desc: "Deployment contract period completed" },
  { id: "MISCONDUCT", label: "Misconduct", desc: "Guard removed due to disciplinary action" },
  { id: "ABSENT_WITHOUT_LEAVE", label: "Absent Without Leave (AWOL)", desc: "Guard abandoned post without authorization" },
  { id: "MEDICAL", label: "Medical Grounds", desc: "Guard unable to continue due to health" },
  { id: "TERMINATED", label: "Termination", desc: "Guard's employment terminated" },
  { id: "OTHER", label: "Other", desc: "Other reason — specify in notes" },
]

function formatDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function daysBetween(from: Date | string, to: Date | string) {
  const a = new Date(from); a.setHours(0, 0, 0, 0)
  const b = new Date(to);   b.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

function ShiftInfo({ dep }: { dep: Deployment }) {
  const shift = dep.shiftType
  const start = shift === "DAY" ? dep.dayShiftStart : dep.nightShiftStart
  const end   = shift === "DAY" ? dep.dayShiftEnd   : dep.nightShiftEnd
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
      shift === "DAY"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-indigo-50 text-indigo-700 border-indigo-200"
    }`}>
      <Clock className="h-3 w-3" />
      {shift === "DAY" ? "Day" : "Night"}
      {start && end ? ` · ${start} – ${end}` : ""}
    </span>
  )
}

export default function RevokeDeploymentForm({ deployment }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"form" | "confirm">("form")
  const [revokeDate, setRevokeDate] = useState(new Date().toISOString().split("T")[0])
  const [reasonCode, setReasonCode] = useState("")
  const [notes, setNotes] = useState("")

  const todayStr = new Date().toISOString().split("T")[0]
  const duration = daysBetween(deployment.deploymentDate, revokeDate)
  const guardType = deployment.guard.isExService
    ? `Ex-Service (${deployment.guard.exServiceType || "Unknown"})`
    : "Civilian"
  const selectedReason = REVOKE_REASONS.find((r) => r.id === reasonCode)

  const handleRevoke = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDate: revokeDate, reason: `[${reasonCode}] ${notes}`.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || "Failed to revoke deployment")
      }
      router.push(`/guards/${deployment.guard.id}?tab=deployments`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke deployment")
      setStep("form")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
          <ShieldOff className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Revoke Deployment</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Remove guard from deployment and stop attendance auto-generation
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Guard + Deployment Card */}
      <div className="ui-card p-5">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-4">Current Deployment</h2>
        <div className="flex items-start gap-4">
          {/* Guard avatar */}
          <div className="shrink-0">
            {deployment.guard.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={deployment.guard.photoUrl}
                alt={deployment.guard.name}
                className="h-16 w-16 rounded-full object-cover border-2 border-[var(--border)]"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-[var(--brand)]/10 border-2 border-[var(--border)] flex items-center justify-center">
                <span className="text-xl font-bold text-[var(--brand)]">
                  {deployment.guard.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Guard info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-[var(--text)]">{deployment.guard.name}</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {deployment.guard.parwestId} · {guardType}
                </p>
                {deployment.guard.phone ? (
                  <p className="text-sm text-[var(--text-muted)]">{deployment.guard.phone}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ACTIVE
                </span>
                <ShiftInfo dep={deployment} />
              </div>
            </div>

            {/* Deployment details grid */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Client</p>
                  <p className="font-medium text-[var(--text)]">{deployment.client.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Branch</p>
                  <p className="font-medium text-[var(--text)]">
                    {deployment.branch
                      ? `${deployment.branch.name}${deployment.branch.city ? `, ${deployment.branch.city}` : ""}`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Designation</p>
                  <p className="font-medium text-[var(--text)]">{deployment.designation || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Deployed On</p>
                  <p className="font-medium text-[var(--text)]">{formatDate(deployment.deploymentDate)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Nature</p>
                <p className="font-medium text-[var(--text)]">
                  {deployment.deploymentNature === "TEMPORARY" ? "Temporary" : "Permanent"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Deployed By</p>
                <p className="font-medium text-[var(--text)]">{deployment.deployedByName || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {step === "form" ? (
        <>
          {/* Warning */}
          <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Revoking this deployment will:</p>
              <ul className="space-y-0.5 list-disc list-inside text-amber-700">
                <li>Mark the deployment as <strong>INACTIVE</strong></li>
                <li>Stop automatic daily attendance generation for this guard</li>
                <li>Free up the guard for a new deployment</li>
              </ul>
            </div>
          </div>

          {/* Form */}
          <div className="ui-card p-5 space-y-5">
            {/* Revoke Date */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Revoke Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={revokeDate}
                onChange={(e) => setRevokeDate(e.target.value)}
                max={todayStr}
                min={new Date(deployment.deploymentDate).toISOString().split("T")[0]}
                className="ui-input"
              />
              {revokeDate && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Deployment duration: <strong>{duration} day{duration !== 1 ? "s" : ""}</strong>
                  {" "}({formatDate(deployment.deploymentDate)} → {formatDate(revokeDate)})
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Reason for Revocation <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REVOKE_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-start gap-3 rounded-[var(--radius-md)] border p-3 cursor-pointer transition-colors ${
                      reasonCode === r.id
                        ? "border-[var(--brand)] bg-[var(--brand)]/5"
                        : "border-[var(--border)] hover:border-[var(--brand)]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.id}
                      checked={reasonCode === r.id}
                      onChange={() => setReasonCode(r.id)}
                      className="mt-0.5 accent-[var(--brand)]"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--text)]">{r.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional context or instructions..."
                className="ui-textarea"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                disabled={!reasonCode || !revokeDate}
                onClick={() => setStep("confirm")}
                className="ui-btn ui-btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Confirm
              </button>
              <Link href={`/deployments/${deployment.id}`} className="ui-btn ui-btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </>
      ) : (
        /* Confirmation step */
        <div className="ui-card p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
            <CheckCircle2 className="h-6 w-6 text-[var(--brand)]" />
            <h2 className="text-base font-semibold">Confirm Revocation</h2>
          </div>

          <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] border border-[var(--border)] p-4 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <span className="text-[var(--text-muted)]">Guard</span>
                <p className="font-semibold">{deployment.guard.name} ({deployment.guard.parwestId})</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Client</span>
                <p className="font-semibold">{deployment.client.name}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Revoke Date</span>
                <p className="font-semibold">{formatDate(revokeDate)}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Reason</span>
                <p className="font-semibold">{selectedReason?.label}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Duration</span>
                <p className="font-semibold">{duration} day{duration !== 1 ? "s" : ""}</p>
              </div>
              {notes ? (
                <div className="col-span-2">
                  <span className="text-[var(--text-muted)]">Notes</span>
                  <p className="font-semibold">{notes}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium">
            This action cannot be undone. The guard will be freed from this deployment.
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleRevoke}
              className="ui-btn ui-btn-danger disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <ShieldOff className="h-4 w-4" />
              {loading ? "Revoking..." : "Confirm Revoke"}
            </button>
            <button
              type="button"
              onClick={() => setStep("form")}
              className="ui-btn ui-btn-secondary"
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}