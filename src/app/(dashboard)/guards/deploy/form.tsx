"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { FileText, MapPin, Users, Shield, Calendar, Clock } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"
import Link from "next/link"

type Client = {
  id: string
  name: string
  type: string
}

type Branch = {
  id: string
  name: string
  code: string | null
  city: string | null
  address: string | null
  contactPerson: string | null
  supervisorName: string | null
  activeDeployments: number
}

type Guard = {
  id: string
  parwestId?: string | null
  name: string
  cnic: string
  phone: string
  photoUrl?: string | null
  regionalOfficeId: string
  designation?: string | null
  guardType?: string | null
  isExService?: boolean | null
  exServiceType?: string | null
  status?: string | null
  supervisorName?: string | null
}

type RegionalOffice = {
  id: string
  name: string
  seriesCode: string
  regionId: string
}

type GuardDeployment = {
  id: string
  status: string
  shiftType: string
  designation: string
  deploymentType: string | null
  deploymentNature: string | null
  deploymentDate: string
  endDate: string | null
  dayShiftStart: string | null
  dayShiftEnd: string | null
  nightShiftStart: string | null
  nightShiftEnd: string | null
  client: { id: string; name: string }
  branch: { id: string; name: string; city: string | null } | null
}

type AllDeploymentRow = {
  id: string
  status: string
  shiftType: string
  designation: string
  deploymentType: string | null
  deploymentDate: string
  endDate: string | null
  guard: {
    id: string
    parwestId: string
    name: string
    phone: string | null
    photoUrl: string | null
    isExService: boolean
    exServiceType: string | null
  }
  client: { id: string; name: string }
  branch: { id: string; name: string; city: string | null } | null
  regionalOffice: { id: string; name: string }
}

// ── Static option lists ────────────────────────────────────────────────────
const DESIGNATION_OPTIONS = [
  { id: "Guard", name: "Guard" },
  { id: "location supervisor", name: "Location Supervisor" },
  { id: "cpo", name: "CPO" },
  { id: "SO", name: "SO" },
  { id: "ASO", name: "ASO" },
  { id: "LSO", name: "LSO" },
  { id: "Receptionist", name: "Receptionist" },
  { id: "CCTV Operator", name: "CCTV Operator" },
  { id: "Complaint Receiver", name: "Complaint Receiver" },
]

const SHIFT_OPTIONS = [
  { id: "DAY", name: "Day" },
  { id: "NIGHT", name: "Night" },
]

const DEPLOYMENT_TYPE_OPTIONS = [
  { id: "REGULAR", name: "Regular" },
  { id: "OVERTIME", name: "Overtime" },
]

const DEPLOYMENT_NATURE_OPTIONS = [
  { id: "PERMANENT", name: "Permanent" },
  { id: "TEMPORARY", name: "Temporary" },
]

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function ShiftBadge({ shift }: { shift: string }) {
  const cls = shift === "DAY"
    ? "bg-amber-100 text-amber-800 border border-amber-200"
    : "bg-indigo-100 text-indigo-800 border border-indigo-200"
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <Clock className="h-3 w-3" />
      {shift}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const cls = status === "ACTIVE"
    ? "bg-emerald-500"
    : status === "PENDING"
    ? "bg-amber-400"
    : "bg-gray-400"
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
}

export default function DeployGuardForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branchesLoaded, setBranchesLoaded] = useState(false)
  const [guards, setGuards] = useState<Guard[]>([])
  const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])

  const [selectedClient, setSelectedClient] = useState("")
  const [selectedBranch, setSelectedBranch] = useState("")
  const [selectedGuard, setSelectedGuard] = useState("")
  const [selectedRegionalOffice, setSelectedRegionalOffice] = useState("")
  const [guardSupervisor, setGuardSupervisor] = useState<string>("—")

  const [clientGuardTypes, setClientGuardTypes] = useState<string[]>([])

  const [designation, setDesignation] = useState("")
  const [guardType, setGuardType] = useState("")
  const [shiftType, setShiftType] = useState("DAY")
  const [dayShiftStart, setDayShiftStart] = useState("08:00")
  const [dayShiftEnd, setDayShiftEnd] = useState("20:00")
  const [nightShiftStart, setNightShiftStart] = useState("20:00")
  const [nightShiftEnd, setNightShiftEnd] = useState("08:00")
  const [deploymentDate, setDeploymentDate] = useState(new Date().toISOString().split("T")[0])
  const [deploymentType, setDeploymentType] = useState("REGULAR")
  const [deploymentNature, setDeploymentNature] = useState("PERMANENT")
  const [isExtraGuard, setIsExtraGuard] = useState(false)
  const [comment, setComment] = useState("")
  const [salaryInput, setSalaryInput] = useState("")
  const [overtimeInput, setOvertimeInput] = useState("")

  // Guard deployment history
  const [guardDeployments, setGuardDeployments] = useState<GuardDeployment[]>([])
  const [guardDeploymentsLoading, setGuardDeploymentsLoading] = useState(false)

  // Guard eligibility
  const [eligibility, setEligibility] = useState<Eligibility>(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(false)

  // All deployments listing
  const [allDeployments, setAllDeployments] = useState<AllDeploymentRow[]>([])
  const [allDeploymentsLoading, setAllDeploymentsLoading] = useState(true)
  const [guardIdSearch, setGuardIdSearch] = useState("")
  const [guardLayoutView, setGuardLayoutView] = useState<"card" | "list">("card")

  useEffect(() => {
    loadRegionalOffices()
    loadAllDeployments()
  }, [])

  useEffect(() => {
    setSelectedClient("")
    setSelectedBranch("")
    setSelectedGuard("")
    if (!selectedRegionalOffice) {
      setClients([])
      setGuards([])
      return
    }
    loadClients(selectedRegionalOffice)
    loadGuards(selectedRegionalOffice)
  }, [selectedRegionalOffice])

  useEffect(() => {
    // Reset rate inputs whenever the selected guard changes — force conscious entry per guard.
    setSalaryInput("")
    setOvertimeInput("")
    if (!selectedGuard) {
      setGuardSupervisor("—")
      setGuardDeployments([])
      setDeploymentType("REGULAR")
      setEligibility(null)
      return
    }
    fetch(`/api/guards/${selectedGuard}/supervisor`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setGuardSupervisor(data?.supervisorName ?? "—"))
      .catch(() => setGuardSupervisor("—"))

    // Fetch guard's deployments to auto-detect overtime
    setGuardDeploymentsLoading(true)
    fetch(`/api/guards/${selectedGuard}/deployments`)
      .then((r) => r.json())
      .then((data: GuardDeployment[]) => {
        setGuardDeployments(data)
        const hasActive = data.some((d) => d.status === "ACTIVE")
        setDeploymentType(hasActive ? "OVERTIME" : "REGULAR")
      })
      .catch(() => {
        setGuardDeployments([])
        setDeploymentType("REGULAR")
      })
      .finally(() => setGuardDeploymentsLoading(false))

    // Fetch eligibility checks
    setEligibilityLoading(true)
    fetch(`/api/guards/${selectedGuard}/eligibility`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setEligibility(data))
      .catch(() => setEligibility(null))
      .finally(() => setEligibilityLoading(false))
  }, [selectedGuard])

  // Extra guard always means Temporary deployment
  useEffect(() => {
    if (isExtraGuard) setDeploymentNature("TEMPORARY")
  }, [isExtraGuard])

  const loadAllDeployments = async () => {
    try {
      const res = await fetch("/api/deployments")
      if (res.ok) {
        const data = await res.json() as AllDeploymentRow[]
        setAllDeployments(Array.isArray(data) ? data.slice(0, 24) : [])
      }
    } catch {
      setAllDeployments([])
    } finally {
      setAllDeploymentsLoading(false)
    }
  }

  const loadClientGuardTypes = async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/pricing-configs`)
      if (res.ok) {
        const data = await res.json() as Array<{ id: string; guardType: string; rate: number }>
        const types = [...new Set(data.map((c) => c.guardType).filter(Boolean))]
        setClientGuardTypes(types)
        setGuardType(types.length > 0 ? types[0] : "")
      }
    } catch {
      setClientGuardTypes([])
    }
  }

  useEffect(() => {
    setBranches([])
    setBranchesLoaded(false)
    setSelectedBranch("")
    if (!selectedClient) {
      setClientGuardTypes([])
      setGuardType("")
      return
    }
    loadBranches(selectedClient)
    loadClientGuardTypes(selectedClient)
  }, [selectedClient])

  const loadClients = async (regionalOfficeId: string) => {
    try {
      const res = await fetch(`/api/clients?regionalOfficeId=${regionalOfficeId}`)
      const data = await res.json()
      setClients(Array.isArray(data) && data.length > 0 ? data : [])
    } catch {
      setClients([])
    }
  }

  const loadBranches = async (clientId: string) => {
    setBranchesLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/branches`)
      const data = await res.json()
      setBranches(Array.isArray(data) ? data : [])
    } catch {
      setBranches([])
    } finally {
      setBranchesLoading(false)
      setBranchesLoaded(true)
    }
  }

  const loadGuards = async (regionalOfficeId: string) => {
    try {
      const res = await fetch(`/api/guards?regionalOfficeId=${regionalOfficeId}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setGuards(data.map((g: Guard & Record<string, unknown>) => ({
          id: g.id,
          parwestId: (g.parwestId as string | null) ?? null,
          name: g.name,
          cnic: g.cnic,
          phone: g.phone,
          photoUrl: (g.photoUrl as string | null) ?? null,
          regionalOfficeId: g.regionalOfficeId,
          designation: (g.designation as string | null) ?? null,
          guardType: (g.guardType as string | null) ?? null,
          isExService: (g.isExService as boolean | null) ?? null,
          exServiceType: (g.exServiceType as string | null) ?? null,
          status: (g.status as string | null) ?? null,
          supervisorName: (g.supervisorName as string | null) ?? null,
        })))
      } else {
        setGuards([])
      }
    } catch {
      setGuards([])
    }
  }

  const loadRegionalOffices = async () => {
    try {
      const res = await fetch("/api/regional-offices")
      const data = await res.json()
      setRegionalOffices(Array.isArray(data) ? data : [])
    } catch {
      setRegionalOffices([])
    }
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setNotice("")

    // Branch is required when the client has branches
    if (branchesLoaded && branches.length > 0 && !selectedBranch) {
      setError("Please select a branch. This client has branches and a branch must be chosen.")
      setLoading(false)
      return
    }

    // Daily Rate is required — payroll engine reads dep.salary ?? dep.rate ?? 0
    const parsedSalary = parseFloat(salaryInput)
    if (!salaryInput || Number.isNaN(parsedSalary) || parsedSalary <= 0) {
      setError("Daily Rate is required.")
      setLoading(false)
      return
    }
    const parsedOvertime = overtimeInput ? parseFloat(overtimeInput) : undefined
    if (overtimeInput && (Number.isNaN(parsedOvertime!) || parsedOvertime! < 0)) {
      setError("Overtime Hourly Rate must be a non-negative number.")
      setLoading(false)
      return
    }

    // Guard must pass all eligibility checks
    if (eligibility && !eligibility.eligible) {
      const failedChecks = Object.values(eligibility.checks).filter((c) => !c.pass)
      const details = failedChecks.map((c) => `${c.label}: ${c.message}`).join(" • ")
      setError(`Guard is not eligible for deployment — ${details}`)
      setLoading(false)
      return
    }

    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: selectedGuard,
          clientId: selectedClient,
          branchId: selectedBranch || null,
          regionalOfficeId: selectedRegionalOffice,
          designation,
          guardType,
          deploymentDate,
          shiftType,
          dayShiftStart: shiftType === "DAY" ? dayShiftStart : null,
          dayShiftEnd: shiftType === "DAY" ? dayShiftEnd : null,
          nightShiftStart: shiftType === "NIGHT" ? nightShiftStart : null,
          nightShiftEnd: shiftType === "NIGHT" ? nightShiftEnd : null,
          deploymentType,
          deploymentNature: isExtraGuard ? "TEMPORARY" : (deploymentNature || "PERMANENT"),
          isExtraGuard,
          comment: isExtraGuard ? comment : null,
          salary: parsedSalary,
          overtime: parsedOvertime,
          status: "ACTIVE",
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || "Failed to deploy guard")
      }

      const deployment = await res.json()
      if (deployment?.id) {
        router.push(`/deployments/${deployment.id}`)
      } else {
        setNotice("Guard deployed successfully.")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deploy guard")
    } finally {
      setLoading(false)
    }
  }

  const selectedGuardData = guards.find((g) => g.id === selectedGuard)
  const selectedBranchData = branches.find((b) => b.id === selectedBranch) ?? null

  const activeDeployments = guardDeployments.filter((d) => d.status === "ACTIVE")
  const isDoubleDuty = guardDeployments.some((d) => d.status === "ACTIVE")

  // Options derived from fetched data
  const regionalOfficeOptions = regionalOffices.map((o) => ({ id: o.id, name: `${o.name} (${o.seriesCode})` }))
  const clientOptions = clients.map((c) => ({ id: c.id, name: `${c.name} (${c.type})` }))
  const branchOptions = branches.map((b) => ({ id: b.id, name: b.city ? `${b.name} - ${b.city}` : b.name }))
  const guardOptions = guards
    .filter((g) => {
      if (!guardIdSearch.trim()) return true
      const q = guardIdSearch.trim().toLowerCase()
      return (g.parwestId ?? "").toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
    })
    .map((g) => ({
      id: g.id,
      name: g.parwestId ? `${g.parwestId} — ${g.name}` : g.name,
    }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SectionTitle title="Deploy Guards" subtitle="Guard deployment form" />

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Branch Details ─────────────────────────────────────────────── */}
        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[var(--brand)]" />
            Branch Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableCombobox
              label="Regional Office"
              required
              value={selectedRegionalOffice}
              onChange={setSelectedRegionalOffice}
              options={regionalOfficeOptions}
              placeholder="Select regional office..."
            />

            <SearchableCombobox
              label="Select Client"
              required
              value={selectedClient}
              onChange={setSelectedClient}
              options={clientOptions}
              placeholder={selectedRegionalOffice ? "Select client..." : "Select regional office first..."}
              disabled={!selectedRegionalOffice}
            />

            {/* Branch — required when client has branches, hidden when branchless */}
            {!selectedClient || branchesLoading ? (
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Branch</label>
                <div className="ui-input bg-slate-50 text-slate-400 text-sm flex items-center cursor-not-allowed">
                  {branchesLoading ? "Loading branches…" : "Select client first"}
                </div>
              </div>
            ) : branchesLoaded && branches.length === 0 ? (
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Branch</label>
                <div className="ui-input bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2 border-emerald-200">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Branchless Client — no branch required
                </div>
              </div>
            ) : (
              <SearchableCombobox
                label="Branch *"
                required
                value={selectedBranch}
                onChange={setSelectedBranch}
                options={branchOptions}
                placeholder="Select branch..."
              />
            )}

            <SearchableCombobox
              label="Deploy As"
              required
              value={designation}
              onChange={setDesignation}
              options={DESIGNATION_OPTIONS}
              placeholder="Select deployment role..."
            />
          </div>

          {selectedBranchData && (
            <div className="mt-4 p-4 rounded-[var(--radius-md)] border border-blue-200 bg-blue-50">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Branch Info</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="block text-xs text-blue-600">Supervisor</span>
                  <span className="font-medium text-blue-900">{selectedBranchData.supervisorName ?? "—"}</span>
                </div>
                <div>
                  <span className="block text-xs text-blue-600">Contact Person</span>
                  <span className="font-medium text-blue-900">{selectedBranchData.contactPerson ?? "—"}</span>
                </div>
                <div>
                  <span className="block text-xs text-blue-600">Total Deployments</span>
                  <span className="font-medium text-blue-900">{selectedBranchData.activeDeployments}</span>
                </div>
                <div>
                  <span className="block text-xs text-blue-600">Guard Types (Client)</span>
                  <span className="font-medium text-blue-900">
                    {clientGuardTypes.length > 0 ? clientGuardTypes.join(", ") : "No types configured"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Select Guard ───────────────────────────────────────────────── */}
        <section className={selectedGuardData ? "grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start" : ""}>
          <div className="ui-card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--brand)]" />
              Deploy Guards
            </h2>

            <div className="mb-3">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Filter by Guard ID / Name</label>
              <input
                type="text"
                value={guardIdSearch}
                onChange={(e) => setGuardIdSearch(e.target.value)}
                placeholder="e.g. PW-00123 or type a name..."
                className="ui-input"
              />
            </div>

            <SearchableCombobox
              label="Select Guard"
              required
              value={selectedGuard}
              onChange={setSelectedGuard}
              options={guardOptions}
              placeholder={selectedRegionalOffice ? "Select guard..." : "Select regional office first..."}
              disabled={!selectedRegionalOffice}
            />

            {/* Active deployments alert — shown when guard already deployed */}
            {!guardDeploymentsLoading && activeDeployments.length > 0 ? (
              <div className="mt-3 p-4 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50">
                <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">
                  Guard Already Deployed — Deployment Type set to Overtime
                </p>
                <div className="space-y-1.5">
                  {activeDeployments.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-2 text-sm text-amber-900 bg-white rounded border border-amber-200 px-3 py-2">
                      <ShiftBadge shift={d.shiftType} />
                      <span className="font-medium">{d.client.name}</span>
                      {d.branch && <span className="text-amber-600">· {d.branch.name}{d.branch.city ? `, ${d.branch.city}` : ""}</span>}
                      <span className="ml-auto text-xs text-amber-500">Since {formatDate(d.deploymentDate)}</span>
                      <Link
                        href={`/deployments/${d.id}/end`}
                        className="ml-2 text-xs font-semibold text-red-600 hover:text-red-800 underline shrink-0"
                      >
                        Revoke
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Guard Profile Card — appears when a guard is selected */}
          {selectedGuardData ? (
            <GuardProfileCard
              guard={selectedGuardData}
              supervisor={guardSupervisor}
              deployments={guardDeployments}
              loading={guardDeploymentsLoading}
              eligibility={eligibility}
              eligibilityLoading={eligibilityLoading}
            />
          ) : null}
        </section>

        {/* ── Double-duty banner ─────────────────────────────────────────── */}
        {isDoubleDuty ? (
          <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold text-amber-800 mb-0.5">Double Duty Detected</p>
            This guard is already deployed today. Creating a second deployment will record a
            DOUBLE DUTY day — both deployments will pay independently at their own daily rate.
          </div>
        ) : null}

        {/* ── Shift & Deployment Options ─────────────────────────────────── */}
        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--brand)]" />
            Shift &amp; Deployment Options
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableCombobox
              label="Shift"
              value={shiftType}
              onChange={setShiftType}
              options={SHIFT_OPTIONS}
              placeholder="Select shift..."
            />

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Deployment Date</label>
              <input name="deployment_date" type="date" value={deploymentDate} onChange={(e) => setDeploymentDate(e.target.value)} required className="ui-input" />
            </div>

            {shiftType === "DAY" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Day Shift Start</label>
                  <input name="day_shift_start" type="time" value={dayShiftStart} onChange={(e) => setDayShiftStart(e.target.value)} className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Day Shift End</label>
                  <input name="day_shift_end" type="time" value={dayShiftEnd} onChange={(e) => setDayShiftEnd(e.target.value)} className="ui-input" />
                </div>
              </>
            ) : null}

            {shiftType === "NIGHT" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Night Shift Start</label>
                  <input name="night_shift_start" type="time" value={nightShiftStart} onChange={(e) => setNightShiftStart(e.target.value)} className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Night Shift End</label>
                  <input name="night_shift_end" type="time" value={nightShiftEnd} onChange={(e) => setNightShiftEnd(e.target.value)} className="ui-input" />
                </div>
              </>
            ) : null}

            {/* ── Daily Rate (per-day pay for THIS deployment row) ──────── */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                {isDoubleDuty
                  ? "Daily Rate for this Double-Duty Deployment (PKR)"
                  : "Daily Rate (PKR)"}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
                required
                placeholder="e.g. 1500"
                className="ui-input"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {isDoubleDuty
                  ? "This is a second deployment for this guard today (double duty). Enter the daily rate for THIS deployment — the first deployment's rate is unaffected. Both will pay independently."
                  : "Per-day rate for this deployment. Each deployment row pays one day at this rate."}
              </p>
            </div>

            {/* ── Overtime Hourly Rate (optional) ───────────────────────── */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Overtime Hourly Rate (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={overtimeInput}
                onChange={(e) => setOvertimeInput(e.target.value)}
                placeholder="Optional"
                className="ui-input"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Optional. Used when overtime hours are recorded against this deployment via /payroll/overtime.
              </p>
            </div>

            {activeDeployments.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                  Deployment Type <span className="text-xs text-[var(--text-muted)] font-normal">(metadata only — does not change pay rate)</span>
                </label>
                <div className="ui-input bg-amber-50 text-amber-800 text-sm flex items-center gap-2 cursor-not-allowed border-amber-200">
                  <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" /></svg>
                  Overtime / Double Duty
                  <span className="ml-auto text-xs text-amber-600 font-medium">Locked — already deployed</span>
                </div>
              </div>
            ) : (
              <SearchableCombobox
                label="Deployment (metadata only — does not change pay rate)"
                value={deploymentType}
                onChange={setDeploymentType}
                options={DEPLOYMENT_TYPE_OPTIONS}
                placeholder="Select deployment type..."
              />
            )}
            {/* postAllowance / extraHours removed — deprecated under new payroll model. Track via /payroll/extra-hours instead. */}

            {/* Deployment Nature — locked to Temporary when Extra Guard is checked */}
            {isExtraGuard ? (
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Deployment Nature</label>
                <div className="ui-input bg-slate-50 text-slate-500 text-sm flex items-center gap-2 cursor-not-allowed">
                  <span>Temporary</span>
                  <span className="ml-auto text-xs text-slate-400">(Extra Guard)</span>
                </div>
              </div>
            ) : (
              <SearchableCombobox
                label="Deployment Nature"
                value={deploymentNature}
                onChange={setDeploymentNature}
                options={DEPLOYMENT_NATURE_OPTIONS}
                placeholder="Select nature..."
              />
            )}

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  name="isExtra"
                  type="checkbox"
                  checked={isExtraGuard}
                  onChange={(e) => setIsExtraGuard(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                Extra Guard (Comment Required)
              </label>
            </div>

            {isExtraGuard ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Comment <span className="text-red-500">*</span></label>
                <textarea
                  name="Add Comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required={isExtraGuard}
                  rows={3}
                  placeholder="Explain why this is an extra guard..."
                  className="ui-textarea"
                />
              </div>
            ) : null}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <ActionButton type="submit" disabled={loading}>{loading ? "Deploying..." : "Save"}</ActionButton>
          <ActionButton type="button" variant="secondary" onClick={() => router.back()}>Cancel</ActionButton>
          <ActionButton type="button" variant="secondary">Revoke Deployment</ActionButton>
          <ActionButton type="button" variant="secondary">Change Deployment</ActionButton>
          <input type="checkbox" name="check" className="h-4 w-4 self-center accent-[var(--brand)]" />
        </div>
      </form>

      {/* ── Deployment Listings ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--brand)]" />
            Guard Deployments
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => setGuardLayoutView("card")}
                className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${guardLayoutView === "card" ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Cards
              </button>
              <button
                type="button"
                onClick={() => setGuardLayoutView("list")}
                className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${guardLayoutView === "list" ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"}`}
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                List
              </button>
            </div>
            <Link href="/deployments" className="text-sm text-[var(--brand)] hover:underline font-medium">
              View All
            </Link>
          </div>
        </div>

        {allDeploymentsLoading ? (
          <div className="ui-card p-8 text-center text-[var(--text-muted)]">Loading deployments...</div>
        ) : allDeployments.length === 0 ? (
          <div className="ui-card p-8 text-center text-[var(--text-muted)]">No deployments found.</div>
        ) : guardLayoutView === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {allDeployments.map((dep) => (
              <DeploymentCard key={dep.id} deployment={dep} />
            ))}
          </div>
        ) : (
          <div className="ui-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Guard</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Client / Branch</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Shift</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {allDeployments.map((dep) => (
                  <tr key={dep.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/deployments/${dep.id}`} className="hover:text-[var(--brand)]">
                        <div className="font-medium text-[var(--text)]">{dep.guard.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">{dep.guard.parwestId}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text)]">{dep.client.name}</div>
                      {dep.branch && <div className="text-xs text-[var(--text-muted)]">{dep.branch.name}{dep.branch.city ? ` · ${dep.branch.city}` : ""}</div>}
                    </td>
                    <td className="px-4 py-3"><ShiftBadge shift={dep.shiftType} /></td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{dep.deploymentType === "OVERTIME" ? "Overtime" : "Regular"}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{formatDate(dep.deploymentDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        dep.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
                        dep.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        <StatusDot status={dep.status} />
                        {dep.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Guard Profile Card ─────────────────────────────────────────────────────
type EligibilityCheck = { pass: boolean; label: string; message: string }
type Eligibility = { eligible: boolean; checks: Record<string, EligibilityCheck> } | null

function GuardProfileCard({
  guard,
  supervisor,
  deployments,
  loading,
  eligibility,
  eligibilityLoading,
}: {
  guard: Guard
  supervisor: string
  deployments: GuardDeployment[]
  loading: boolean
  eligibility: Eligibility
  eligibilityLoading: boolean
}) {
  const guardTypeLabel = guard.isExService
    ? `Ex-Service (${guard.exServiceType || "Unknown"})`
    : guard.isExService === false
    ? "Civilian"
    : guard.guardType || "—"

  const active = deployments.filter((d) => d.status === "ACTIVE")
  const past = deployments.filter((d) => d.status !== "ACTIVE").slice(0, 4)

  return (
    <div className="ui-card p-5 space-y-4 sticky top-4">
      {/* Photo + identity */}
      <div className="flex items-center gap-3">
        {guard.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guard.photoUrl}
            alt={guard.name}
            className="h-16 w-16 rounded-full object-cover border-2 border-[var(--border)] shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-[var(--brand)]/10 border-2 border-[var(--border)] flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-[var(--brand)]">
              {guard.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-[var(--text)] text-base truncate">{guard.name}</p>
          {guard.parwestId && (
            <p className="text-xs text-[var(--text-muted)]">{guard.parwestId}</p>
          )}
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            guard.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
            guard.status === "PRESENT" ? "bg-blue-100 text-blue-700" :
            guard.status === "DEFAULT" ? "bg-gray-100 text-gray-600" :
            guard.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
            guard.status === "INACTIVE" || guard.status === "TERMINATED" ? "bg-red-100 text-red-700" :
            guard.status === "BLACKLISTED" ? "bg-red-200 text-red-900" :
            "bg-gray-100 text-gray-600"
          }`}>
            {guard.status ?? "UNKNOWN"}
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="block text-[var(--text-muted)]">Phone</span>
          <span className="font-medium text-[var(--text)]">{guard.phone || "—"}</span>
        </div>
        <div>
          <span className="block text-[var(--text-muted)]">Type</span>
          <span className="font-medium text-[var(--text)]">{guardTypeLabel}</span>
        </div>
        <div className="col-span-2">
          <span className="block text-[var(--text-muted)]">Supervisor</span>
          <span className="font-medium text-[var(--text)]">{supervisor}</span>
        </div>
      </div>

      {/* ── Eligibility Checks ─────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
          Deployment Eligibility
        </p>
        {eligibilityLoading ? (
          <p className="text-xs text-[var(--text-muted)]">Checking eligibility…</p>
        ) : eligibility ? (
          <div className="space-y-1.5">
            {/* Overall badge */}
            <div className={`flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold border ${
              eligibility.eligible
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <span className={`h-2 w-2 rounded-full shrink-0 ${eligibility.eligible ? "bg-emerald-500" : "bg-red-500"}`} />
              {eligibility.eligible ? "Eligible for Deployment" : "Not Eligible for Deployment"}
            </div>
            {/* Individual checks */}
            {Object.values(eligibility.checks).map((check) => (
              <div key={check.label} className="flex items-start gap-2 text-xs">
                {check.pass ? (
                  <svg className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
                <div>
                  <span className={`font-semibold ${check.pass ? "text-[var(--text)]" : "text-red-700"}`}>
                    {check.label}
                  </span>
                  <span className="text-[var(--text-muted)] ml-1">— {check.message}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic">Could not load eligibility data</p>
        )}
      </div>

      {/* Active deployments */}
      {loading ? (
        <p className="text-xs text-[var(--text-muted)]">Loading deployments…</p>
      ) : active.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Currently Deployed</p>
          <div className="space-y-2">
            {active.map((d) => (
              <div key={d.id} className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ShiftBadge shift={d.shiftType} />
                  <span className="font-semibold text-emerald-800">{d.client.name}</span>
                </div>
                {d.branch && (
                  <span className="text-emerald-600">{d.branch.name}{d.branch.city ? `, ${d.branch.city}` : ""}</span>
                )}
                <div className="text-emerald-500 mt-0.5">Since {formatDate(d.deploymentDate)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-[var(--text-muted)] italic">No active deployments</div>
      )}

      {/* Past deployments */}
      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Recent History</p>
          <div className="space-y-1.5">
            {past.map((d) => (
              <div key={d.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="font-medium text-[var(--text)] truncate">{d.client.name}</span>
                  <ShiftBadge shift={d.shiftType} />
                </div>
                <div className="text-[var(--text-muted)] mt-0.5">
                  {formatDate(d.deploymentDate)} → {d.endDate ? formatDate(d.endDate) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Deployment Card ────────────────────────────────────────────────────────
function DeploymentCard({ deployment: dep }: { deployment: AllDeploymentRow }) {
  const guardType = dep.guard.isExService
    ? `Ex-Service (${dep.guard.exServiceType || "Unknown"})`
    : "Civilian"

  const shiftLabel = dep.shiftType === "DAY" ? "Day" : dep.shiftType === "NIGHT" ? "Night" : dep.shiftType

  return (
    <Link href={`/deployments/${dep.id}`} className="block group">
      <div className="ui-card p-4 hover:shadow-md transition-shadow border border-[var(--border)] hover:border-[var(--brand)]/40">
        {/* Guard identity row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative shrink-0">
            {dep.guard.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dep.guard.photoUrl}
                alt={dep.guard.name}
                className="h-11 w-11 rounded-full object-cover border-2 border-[var(--border)]"
              />
            ) : (
              <div className="h-11 w-11 rounded-full bg-[var(--brand)]/10 border-2 border-[var(--border)] flex items-center justify-center">
                <span className="text-sm font-bold text-[var(--brand)]">
                  {dep.guard.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${dep.status === "ACTIVE" ? "bg-emerald-500" : dep.status === "PENDING" ? "bg-amber-400" : "bg-gray-400"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--text)] text-sm truncate group-hover:text-[var(--brand)] transition-colors">
              {dep.guard.name}
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate">{dep.guard.parwestId}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              dep.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
              dep.status === "PENDING" ? "bg-amber-100 text-amber-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              <StatusDot status={dep.status} />
              {dep.status}
            </span>
          </div>
        </div>

        {/* Guard type */}
        <p className="text-xs text-[var(--text-muted)] mb-3">{guardType}</p>

        {/* Deployment details */}
        <div className="space-y-1.5 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-medium text-[var(--text)] truncate block">{dep.client.name}</span>
              {dep.branch && (
                <span className="text-xs text-[var(--text-muted)] truncate block">
                  {dep.branch.name}{dep.branch.city ? ` · ${dep.branch.city}` : ""}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
              dep.shiftType === "DAY"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}>
              <Clock className="h-3 w-3" />
              {shiftLabel}
            </span>
            {dep.deploymentType && (
              <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-muted)] px-2 py-0.5 rounded-full">
                {dep.deploymentType === "OVERTIME" ? "Overtime" : "Regular"}
              </span>
            )}
            <span className="text-xs text-[var(--text-muted)] ml-auto flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(dep.deploymentDate)}
            </span>
          </div>
        </div>

        {/* Designation */}
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">Role: </span>
          <span className="text-xs font-medium text-[var(--text)]">{dep.designation || "—"}</span>
        </div>
      </div>
    </Link>
  )
}

// ── SearchableCombobox ─────────────────────────────────────────────────────
function SearchableCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = "Search...",
  disabled = false,
  required = false,
}: {
  label: string
  value: string
  onChange: (id: string) => void
  options: { id: string; name: string }[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const selected = options.find((o) => o.id === value)
  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
        {label}{required ? <span className="text-red-500 ml-1">*</span> : null}
      </label>
      <div ref={ref} className="relative">
        <div
          className={`ui-select flex cursor-pointer items-center justify-between gap-2${disabled ? " opacity-50 pointer-events-none bg-slate-100" : ""}`}
          onClick={() => { if (!disabled) { setOpen((v) => !v); setQuery("") } }}
        >
          <span className={selected ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
            {selected ? selected.name : placeholder}
          </span>
          <svg className="h-4 w-4 shrink-0 text-[var(--text-muted)]" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg">
            <div className="p-2 border-b border-[var(--border)]">
              <input
                autoFocus
                className="ui-input py-1 text-sm"
                placeholder="Type to search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setOpen(false); setQuery("") }
                  if (e.key === "Enter" && filtered.length > 0) {
                    onChange(filtered[0].id)
                    setOpen(false)
                    setQuery("")
                  }
                }}
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[var(--text-muted)]">No results found</div>
              ) : (
                filtered.map((option) => {
                  // Detect "ID — Name" pattern and split for two-line rendering
                  const dashIdx = option.name.indexOf(" — ")
                  const hasIdPrefix = dashIdx !== -1
                  const idPart = hasIdPrefix ? option.name.slice(0, dashIdx) : null
                  const namePart = hasIdPrefix ? option.name.slice(dashIdx + 3) : option.name
                  return (
                    <div
                      key={option.id}
                      className={`cursor-pointer px-3 py-2 text-sm hover:bg-[var(--primary)]/10 ${option.id === value ? "text-[var(--primary)]" : "text-[var(--text)]"}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onChange(option.id)
                        setOpen(false)
                        setQuery("")
                      }}
                    >
                      {hasIdPrefix ? (
                        <>
                          <span className="font-semibold">{idPart}</span>
                          <span className="text-[var(--text-muted)]"> — </span>
                          <span>{namePart}</span>
                        </>
                      ) : (
                        option.name
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}