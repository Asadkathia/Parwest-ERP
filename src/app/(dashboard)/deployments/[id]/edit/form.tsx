"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  RefreshCw, MapPin, Clock, ArrowRight, Building2,
  Calendar, User, AlertTriangle, CheckCircle2
} from "lucide-react"
import Link from "next/link"

type Branch = {
  id: string
  name: string
  city: string | null
  address: string | null
}

type Client = {
  id: string
  name: string
  branches: Branch[]
}

type RegionalOffice = {
  id: string
  name: string
  seriesCode: string
}

type Deployment = {
  id: string
  guardId: string
  clientId: string
  branchId: string | null
  regionalOfficeId: string
  deploymentDate: Date
  designation: string | null
  shiftType: string
  status: string
  deploymentType: string | null
  deploymentNature: string | null
  isExtraGuard: boolean
  comment: string | null
  notes: string | null
  guardType: string | null
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
  client: { id: string; name: string; branches: Branch[] }
  branch: { id: string; name: string } | null
  regionalOffice: { id: string; name: string; seriesCode: string }
}

type Props = {
  deployment: Deployment
  clients: Client[]
  regionalOffices: RegionalOffice[]
  // guards not needed — guard stays the same on change
}

const DESIGNATION_OPTIONS = [
  "Guard", "Location Supervisor", "CPO", "SO", "ASO", "LSO",
  "Receptionist", "CCTV Operator", "Complaint Receiver",
]

const CHANGE_REASONS = [
  { id: "CLIENT_TRANSFER", label: "Client Transfer", desc: "Moving guard to a different client" },
  { id: "BRANCH_TRANSFER", label: "Branch Transfer", desc: "Moved to a different branch of same client" },
  { id: "SHIFT_CHANGE", label: "Shift Change", desc: "Changing from day to night shift or vice versa" },
  { id: "ROLE_CHANGE", label: "Role/Designation Change", desc: "Guard's role or designation is changing" },
  { id: "OPERATIONAL", label: "Operational Requirement", desc: "Business or operational need" },
  { id: "OTHER", label: "Other", desc: "Other reason — specify in notes" },
]

function formatDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function ComboBox({
  label, value, onChange, options, placeholder = "Select...", required = false, disabled = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { id: string; name: string }[]
  placeholder?: string; required?: boolean; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ("") }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const sel = options.find((o) => o.id === value)
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())) : options
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
        {label}{required ? <span className="text-red-500 ml-1">*</span> : null}
      </label>
      <div ref={ref} className="relative">
        <div
          className={`ui-select flex cursor-pointer items-center justify-between gap-2${disabled ? " opacity-50 pointer-events-none bg-slate-100" : ""}`}
          onClick={() => { if (!disabled) setOpen((v) => !v) }}
        >
          <span className={sel ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
            {sel ? sel.name : placeholder}
          </span>
          <svg className="h-4 w-4 shrink-0 text-[var(--text-muted)]" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg">
            <div className="p-2 border-b border-[var(--border)]">
              <input autoFocus className="ui-input py-1 text-sm" placeholder="Search..." value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setOpen(false); setQ("") }
                  if (e.key === "Enter" && filtered.length > 0) { onChange(filtered[0].id); setOpen(false); setQ("") }
                }}
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0
                ? <div className="px-3 py-2 text-sm text-[var(--text-muted)]">No results</div>
                : filtered.map((o) => (
                  <div key={o.id}
                    className={`cursor-pointer px-3 py-2 text-sm hover:bg-[var(--primary)]/10 ${o.id === value ? "font-semibold text-[var(--primary)]" : "text-[var(--text)]"}`}
                    onMouseDown={(e) => { e.preventDefault(); onChange(o.id); setOpen(false); setQ("") }}
                  >
                    {o.name}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChangeDeploymentForm({ deployment, clients, regionalOffices }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"form" | "confirm">("form")

  // New deployment values — prefilled with current values
  const [clientId, setClientId] = useState(deployment.clientId)
  const [branchId, setBranchId] = useState(deployment.branchId || "")
  const [regionalOfficeId, setRegionalOfficeId] = useState(deployment.regionalOfficeId)
  const [shiftType, setShiftType] = useState(deployment.shiftType)
  const [designation, setDesignation] = useState(deployment.designation || "Guard")
  const [deploymentType, setDeploymentType] = useState(deployment.deploymentType || "REGULAR")
  const [deploymentNature, setDeploymentNature] = useState(deployment.deploymentNature || "PERMANENT")
  const [dayShiftStart, setDayShiftStart] = useState(deployment.dayShiftStart || "08:00")
  const [dayShiftEnd, setDayShiftEnd] = useState(deployment.dayShiftEnd || "20:00")
  const [nightShiftStart, setNightShiftStart] = useState(deployment.nightShiftStart || "20:00")
  const [nightShiftEnd, setNightShiftEnd] = useState(deployment.nightShiftEnd || "08:00")
  const [isExtraGuard, setIsExtraGuard] = useState(deployment.isExtraGuard)
  const [changeReason, setChangeReason] = useState("")
  const [notes, setNotes] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0])

  // Branches for selected client
  const [availableBranches, setAvailableBranches] = useState<Branch[]>(deployment.client.branches)

  const todayStr = new Date().toISOString().split("T")[0]
  const minDate = new Date(deployment.deploymentDate).toISOString().split("T")[0]

  useEffect(() => {
    const client = clients.find((c) => c.id === clientId)
    setAvailableBranches(client?.branches || [])
    if (client && clientId !== deployment.clientId) setBranchId("")
  }, [clientId, clients, deployment.clientId])

  // Extra guard always temporary
  useEffect(() => { if (isExtraGuard) setDeploymentNature("TEMPORARY") }, [isExtraGuard])

  // Detect what changed
  const changes: { field: string; from: string; to: string }[] = []
  const currentClient = clients.find((c) => c.id === deployment.clientId)
  const newClient = clients.find((c) => c.id === clientId)
  const currentBranch = deployment.client.branches.find((b) => b.id === deployment.branchId)
  const newBranch = availableBranches.find((b) => b.id === branchId)

  if (clientId !== deployment.clientId) {
    changes.push({ field: "Client", from: currentClient?.name || deployment.clientId, to: newClient?.name || clientId })
  }
  if (branchId !== (deployment.branchId || "")) {
    changes.push({ field: "Branch", from: currentBranch?.name || "None", to: newBranch?.name || "None" })
  }
  if (shiftType !== deployment.shiftType) {
    changes.push({ field: "Shift", from: deployment.shiftType, to: shiftType })
  }
  if (designation !== (deployment.designation || "")) {
    changes.push({ field: "Designation", from: deployment.designation || "—", to: designation })
  }
  if (deploymentType !== (deployment.deploymentType || "REGULAR")) {
    changes.push({ field: "Deployment Type", from: deployment.deploymentType || "REGULAR", to: deploymentType })
  }
  if (deploymentNature !== (deployment.deploymentNature || "PERMANENT")) {
    changes.push({ field: "Nature", from: deployment.deploymentNature || "PERMANENT", to: deploymentNature })
  }
  if (regionalOfficeId !== deployment.regionalOfficeId) {
    const curOffice = regionalOffices.find((o) => o.id === deployment.regionalOfficeId)
    const newOffice = regionalOffices.find((o) => o.id === regionalOfficeId)
    changes.push({ field: "Regional Office", from: curOffice?.name || deployment.regionalOfficeId, to: newOffice?.name || regionalOfficeId })
  }

  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }))
  const branchOptions = availableBranches.map((b) => ({ id: b.id, name: b.city ? `${b.name} · ${b.city}` : b.name }))
  const officeOptions = regionalOffices.map((o) => ({ id: o.id, name: `${o.name} (${o.seriesCode})` }))
  const designationOptions = DESIGNATION_OPTIONS.map((d) => ({ id: d, name: d }))

  const guardType = deployment.guard.isExService
    ? `Ex-Service (${deployment.guard.exServiceType || "Unknown"})`
    : "Civilian"

  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/deployments/${deployment.id}/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveDate,
          changeReason,
          clientId,
          branchId: branchId || null,
          regionalOfficeId,
          shiftType,
          designation,
          deploymentType,
          deploymentNature,
          isExtraGuard,
          dayShiftStart: shiftType === "DAY" ? dayShiftStart : null,
          dayShiftEnd: shiftType === "DAY" ? dayShiftEnd : null,
          nightShiftStart: shiftType === "NIGHT" ? nightShiftStart : null,
          nightShiftEnd: shiftType === "NIGHT" ? nightShiftEnd : null,
          notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || "Failed to change deployment")
      }
      const result = await res.json()
      router.push(`/deployments/${result.newDeployment.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change deployment")
      setStep("form")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-[var(--brand)]/10 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 text-[var(--brand)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Change Deployment</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Ends the current deployment and creates a new one with updated details
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Guard Card */}
      <div className="ui-card p-5">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Guard</h2>
        <div className="flex items-center gap-4">
          {deployment.guard.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={deployment.guard.photoUrl} alt={deployment.guard.name}
              className="h-14 w-14 rounded-full object-cover border-2 border-[var(--border)]" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-[var(--brand)]/10 border-2 border-[var(--border)] flex items-center justify-center">
              <span className="text-lg font-bold text-[var(--brand)]">{deployment.guard.name.charAt(0)}</span>
            </div>
          )}
          <div>
            <h3 className="font-bold text-[var(--text)]">{deployment.guard.name}</h3>
            <p className="text-sm text-[var(--text-muted)]">{deployment.guard.parwestId} · {guardType}</p>
            {deployment.guard.phone ? <p className="text-sm text-[var(--text-muted)]">{deployment.guard.phone}</p> : null}
          </div>
          <div className="ml-auto text-right text-sm">
            <p className="text-xs text-[var(--text-muted)]">Deployed since</p>
            <p className="font-semibold">{formatDate(deployment.deploymentDate)}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">by {deployment.deployedByName || "—"}</p>
          </div>
        </div>
      </div>

      {/* Current vs New — side by side comparison */}
      {step === "form" ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Current (read-only) */}
            <div className="ui-card p-5">
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Current Deployment
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Client · Branch</p>
                    <p className="font-medium">{deployment.client.name}</p>
                    {deployment.branch ? <p className="text-[var(--text-muted)]">{deployment.branch.name}</p> : null}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Shift</p>
                    <p className="font-medium">{deployment.shiftType}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Designation</p>
                    <p className="font-medium">{deployment.designation || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-[var(--text-muted)] mt-0.5" />
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Regional Office</p>
                    <p className="font-medium">{deployment.regionalOffice.name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Type · Nature</p>
                  <p className="font-medium">{deployment.deploymentType || "REGULAR"} · {deployment.deploymentNature || "PERMANENT"}</p>
                </div>
              </div>
            </div>

            {/* New (editable) */}
            <div className="ui-card p-5">
              <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-4 flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-[var(--brand)]" />
                New Deployment Details
              </h2>
              <div className="space-y-4">
                <ComboBox label="Client" required value={clientId} onChange={setClientId} options={clientOptions} />
                <ComboBox label="Branch" value={branchId} onChange={setBranchId} options={branchOptions}
                  placeholder="Select branch..." disabled={!clientId} />
                <ComboBox label="Regional Office" required value={regionalOfficeId} onChange={setRegionalOfficeId}
                  options={officeOptions} />

                {/* Shift */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Shift</label>
                  <div className="flex gap-2">
                    {["DAY", "NIGHT"].map((s) => (
                      <button key={s} type="button"
                        onClick={() => setShiftType(s)}
                        className={`flex-1 py-2 text-sm font-medium rounded-[var(--radius-md)] border transition-colors ${
                          shiftType === s
                            ? s === "DAY"
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-indigo-100 text-indigo-800 border-indigo-300"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)]/40"
                        }`}
                      >
                        {s === "DAY" ? "☀ Day" : "🌙 Night"}
                      </button>
                    ))}
                  </div>
                  {shiftType === "DAY" ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Start</label>
                        <input type="time" value={dayShiftStart} onChange={(e) => setDayShiftStart(e.target.value)} className="ui-input text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">End</label>
                        <input type="time" value={dayShiftEnd} onChange={(e) => setDayShiftEnd(e.target.value)} className="ui-input text-sm" />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Start</label>
                        <input type="time" value={nightShiftStart} onChange={(e) => setNightShiftStart(e.target.value)} className="ui-input text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">End</label>
                        <input type="time" value={nightShiftEnd} onChange={(e) => setNightShiftEnd(e.target.value)} className="ui-input text-sm" />
                      </div>
                    </div>
                  )}
                </div>

                <ComboBox label="Designation" value={designation} onChange={setDesignation} options={designationOptions} />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Deployment Type</label>
                    <select value={deploymentType} onChange={(e) => setDeploymentType(e.target.value)} className="ui-select text-sm">
                      <option value="REGULAR">Regular</option>
                      <option value="OVERTIME">Overtime</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Nature</label>
                    {isExtraGuard ? (
                      <div className="ui-input bg-slate-50 text-slate-500 text-sm cursor-not-allowed">Temporary</div>
                    ) : (
                      <select value={deploymentNature} onChange={(e) => setDeploymentNature(e.target.value)} className="ui-select text-sm">
                        <option value="PERMANENT">Permanent</option>
                        <option value="TEMPORARY">Temporary</option>
                      </select>
                    )}
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isExtraGuard} onChange={(e) => setIsExtraGuard(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                  Extra Guard
                </label>
              </div>
            </div>
          </div>

          {/* Change details */}
          <div className="ui-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Change Details</h2>

            {/* Effective Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input type="date" required value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  min={minDate} max={todayStr} className="ui-input" />
                <p className="mt-1 text-xs text-[var(--text-muted)]">Current deployment ends on this date; new one starts</p>
              </div>
            </div>

            {/* Change reason */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Reason for Change <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {CHANGE_REASONS.map((r) => (
                  <label key={r.id}
                    className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border p-3 cursor-pointer transition-colors ${
                      changeReason === r.id
                        ? "border-[var(--brand)] bg-[var(--brand)]/5"
                        : "border-[var(--border)] hover:border-[var(--brand)]/40"
                    }`}
                  >
                    <input type="radio" name="changeReason" value={r.id} checked={changeReason === r.id}
                      onChange={() => setChangeReason(r.id)} className="mt-0.5 accent-[var(--brand)]" />
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Additional context for this change..." className="ui-textarea" />
            </div>

            <div className="flex gap-3 pt-2 border-t border-[var(--border)]">
              <button type="button"
                disabled={!changeReason || !effectiveDate || changes.length === 0}
                onClick={() => setStep("confirm")}
                className="ui-btn ui-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review Changes
              </button>
              <Link href={`/deployments/${deployment.id}`} className="ui-btn ui-btn-secondary">Cancel</Link>
            </div>

            {changes.length === 0 && changeReason ? (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> No changes detected — modify at least one field above.
              </p>
            ) : null}
          </div>
        </>
      ) : (
        /* Confirmation */
        <div className="ui-card p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
            <CheckCircle2 className="h-6 w-6 text-[var(--brand)]" />
            <div>
              <h2 className="text-base font-semibold">Confirm Deployment Change</h2>
              <p className="text-sm text-[var(--text-muted)]">Review changes before applying</p>
            </div>
          </div>

          {/* Changes summary */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Changes ({changes.length})</h3>
            <div className="space-y-2">
              {changes.map((c) => (
                <div key={c.field} className="flex items-center gap-3 text-sm bg-[var(--surface-muted)] rounded-[var(--radius-md)] px-4 py-2.5">
                  <span className="font-medium text-[var(--text)] w-32 shrink-0">{c.field}</span>
                  <span className="text-[var(--text-muted)] line-through">{c.from}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--brand)] shrink-0" />
                  <span className="font-semibold text-[var(--brand)]">{c.to}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm bg-[var(--surface-muted)] rounded-[var(--radius-md)] p-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Effective Date</p>
              <p className="font-semibold flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-[var(--brand)]" />
                {formatDate(effectiveDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Reason</p>
              <p className="font-semibold">{CHANGE_REASONS.find((r) => r.id === changeReason)?.label}</p>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <strong>What will happen:</strong> Current deployment ends on {formatDate(effectiveDate)}.
            A new deployment starts on the same date with the updated details.
            Attendance auto-generation continues under the new deployment.
          </div>

          <div className="flex gap-3">
            <button type="button" disabled={loading} onClick={handleSubmit}
              className="ui-btn ui-btn-primary disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {loading ? "Applying..." : "Apply Change"}
            </button>
            <button type="button" onClick={() => setStep("form")} className="ui-btn ui-btn-secondary">
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}