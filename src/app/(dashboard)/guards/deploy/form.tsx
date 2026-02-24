"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DollarSign, FileText, MapPin, Users } from "lucide-react"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

type Region = {
  id: string
  name: string
}

type Client = {
  id: string
  name: string
  type: string
}

type Branch = {
  id: string
  name: string
  code: string
  city: string
}

type Guard = {
  id: string
  name: string
  cnic: string
  phone: string
  regionalOfficeId: string
}

type RegionalOffice = {
  id: string
  name: string
  seriesCode: string
  regionId: string
}

const LEGACY_REGIONS: Region[] = [
  { id: "legacy-region-punjab", name: "Punjab" },
  { id: "legacy-region-sindh", name: "Sindh" },
  { id: "legacy-region-kpk", name: "KPK" },
  { id: "legacy-region-balochistan", name: "Balochistan" },
]

const LEGACY_REGIONAL_OFFICES: RegionalOffice[] = [
  { id: "legacy-head-office-lahore", name: "head office lahore", seriesCode: "LHR", regionId: "legacy-region-punjab" },
  { id: "legacy-islamabad", name: "islamabad", seriesCode: "ISB", regionId: "legacy-region-punjab" },
  { id: "legacy-quetta", name: "quetta", seriesCode: "QTA", regionId: "legacy-region-balochistan" },
  { id: "legacy-peshawar", name: "peshawar", seriesCode: "PEW", regionId: "legacy-region-kpk" },
  { id: "legacy-karachi", name: "karachi", seriesCode: "KHI", regionId: "legacy-region-sindh" },
  { id: "legacy-faisalabad", name: "faisalabad", seriesCode: "FSD", regionId: "legacy-region-punjab" },
]

const LEGACY_CLIENTS: Client[] = [
  { id: "legacy-client-nbp", name: "National Bank of Pakistan", type: "bank" },
  { id: "legacy-client-scb", name: "Standard Chartered Bank Limited Pakistan", type: "bank" },
  { id: "legacy-client-ubl", name: "United Bank Limited", type: "bank" },
  { id: "legacy-client-mcb", name: "MCB Bank Ltd", type: "bank" },
  { id: "legacy-client-fbl", name: "Faysal Bank Limited", type: "bank" },
  { id: "legacy-client-summit", name: "Summit Bank Limited", type: "bank" },
  { id: "legacy-client-meezan", name: "Meezan Bank Limited", type: "bank" },
  { id: "legacy-client-bahl", name: "Bank Al Habib Limited", type: "bank" },
  { id: "legacy-client-samba", name: "Samba Bank Limited", type: "bank" },
]

const LEGACY_BRANCHES_BY_CLIENT: Record<string, Branch[]> = {
  "legacy-client-nbp": [
    { id: "legacy-branch-nbp-ho", name: "NBP Head Office", code: "NBP-HO", city: "Lahore" },
    { id: "legacy-branch-nbp-jail", name: "NBP Jail Road", code: "NBP-JR", city: "Lahore" },
  ],
  "legacy-client-scb": [
    { id: "legacy-branch-scb-main", name: "SCB Main Branch", code: "SCB-MAIN", city: "Karachi" },
    { id: "legacy-branch-scb-cantt", name: "SCB Cantt Branch", code: "SCB-CNT", city: "Lahore" },
  ],
  "legacy-client-ubl": [
    { id: "legacy-branch-ubl-gulberg", name: "UBL Gulberg", code: "UBL-GLB", city: "Lahore" },
  ],
  "legacy-client-mcb": [
    { id: "legacy-branch-mcb-fsd", name: "MCB Faisalabad", code: "MCB-FSD", city: "Faisalabad" },
  ],
}

const LEGACY_GUARDS: Guard[] = [
  { id: "legacy-guard-1", name: "Muhammad Usman", cnic: "35202-7833617-5", phone: "+92-300-1111111", regionalOfficeId: "legacy-head-office-lahore" },
  { id: "legacy-guard-2", name: "Muhammad Junaid", cnic: "37201-2345678-9", phone: "+92-300-2222222", regionalOfficeId: "legacy-faisalabad" },
  { id: "legacy-guard-3", name: "Akbar Ali", cnic: "38403-0948145-3", phone: "+92-300-3333333", regionalOfficeId: "legacy-gujranwala" },
]

export default function DeployGuardForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const [regions, setRegions] = useState<Region[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [regionalOffices, setRegionalOffices] = useState<RegionalOffice[]>([])

  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedClient, setSelectedClient] = useState("")
  const [selectedBranch, setSelectedBranch] = useState("")
  const [selectedGuard, setSelectedGuard] = useState("")
  const [selectedRegionalOffice, setSelectedRegionalOffice] = useState("")

  const [designation, setDesignation] = useState("")
  const [guardType, setGuardType] = useState("Security Guard")
  const [salary, setSalary] = useState("")
  const [overtime, setOvertime] = useState("")
  const [extraHours, setExtraHours] = useState("")
  const [postAllowance, setPostAllowance] = useState("")
  const [shiftType, setShiftType] = useState("DAY")
  const [dayShiftStart, setDayShiftStart] = useState("08:00")
  const [dayShiftEnd, setDayShiftEnd] = useState("20:00")
  const [nightShiftStart, setNightShiftStart] = useState("20:00")
  const [nightShiftEnd, setNightShiftEnd] = useState("08:00")
  const [deploymentDate, setDeploymentDate] = useState(new Date().toISOString().split("T")[0])
  const [deploymentType, setDeploymentType] = useState("REGULAR")
  const [isExtraGuard, setIsExtraGuard] = useState(false)
  const [comment, setComment] = useState("")
  const [guardDeploymentStatus, setGuardDeploymentStatus] = useState("ACTIVE")

  useEffect(() => {
    loadRegions()
    loadClients()
    loadRegionalOffices()
  }, [])

  useEffect(() => {
    if (selectedRegion) loadGuards(selectedRegion)
  }, [selectedRegion])

  useEffect(() => {
    if (selectedClient) loadBranches(selectedClient)
  }, [selectedClient])

  const loadRegions = async () => {
    try {
      const res = await fetch("/api/regions")
      const data = await res.json()
      setRegions(Array.isArray(data) && data.length > 0 ? data : LEGACY_REGIONS)
    } catch {
      setRegions(LEGACY_REGIONS)
    }
  }

  const loadClients = async () => {
    try {
      const res = await fetch("/api/clients")
      const data = await res.json()
      setClients(Array.isArray(data) && data.length > 0 ? data : LEGACY_CLIENTS)
    } catch {
      setClients(LEGACY_CLIENTS)
    }
  }

  const loadBranches = async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/branches`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setBranches(data)
      } else {
        setBranches(LEGACY_BRANCHES_BY_CLIENT[clientId] || [])
      }
    } catch {
      setBranches(LEGACY_BRANCHES_BY_CLIENT[clientId] || [])
    }
  }

  const loadGuards = async (regionId: string) => {
    try {
      const res = await fetch(`/api/guards?regionId=${regionId}&status=ACTIVE`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setGuards(data)
      } else {
        setGuards(LEGACY_GUARDS)
      }
    } catch {
      setGuards(LEGACY_GUARDS)
    }
  }

  const loadRegionalOffices = async () => {
    try {
      const res = await fetch("/api/regional-offices")
      const data = await res.json()
      setRegionalOffices(Array.isArray(data) && data.length > 0 ? data : LEGACY_REGIONAL_OFFICES)
    } catch {
      setRegionalOffices(LEGACY_REGIONAL_OFFICES)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setNotice("")

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
          salary: salary ? parseFloat(salary) : null,
          overtime: overtime ? parseFloat(overtime) : null,
          extraHours: extraHours ? parseFloat(extraHours) : null,
          postAllowance: postAllowance ? parseFloat(postAllowance) : null,
          dayShiftStart: shiftType === "DAY" || shiftType === "BOTH" ? dayShiftStart : null,
          dayShiftEnd: shiftType === "DAY" || shiftType === "BOTH" ? dayShiftEnd : null,
          nightShiftStart: shiftType === "NIGHT" || shiftType === "BOTH" ? nightShiftStart : null,
          nightShiftEnd: shiftType === "NIGHT" || shiftType === "BOTH" ? nightShiftEnd : null,
          deploymentType,
          isExtraGuard,
          comment: isExtraGuard ? comment : null,
          status: guardDeploymentStatus || "ACTIVE",
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to deploy guard")
      }

      const deployment = await res.json()
      if (deployment?.id) {
        router.push(`/deployments/${deployment.id}`)
      } else {
        setNotice("Guard deployed successfully.")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedGuardData = guards.find((g) => g.id === selectedGuard)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SectionTitle title="Deploy Guards" subtitle="Guard deployment form" />

      {error ? <InlineAlert type="error" message={error} /> : null}
      {notice ? <InlineAlert type="success" message={notice} /> : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[var(--brand)]" />
            Branch Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Region <span className="text-red-500">*</span></label>
              <select name="region_id_on_user_profile" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} required className="ui-select">
                <option value="">--Select Region--</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Regional Office</label>
              <select name="regional_office_id" value={selectedRegionalOffice} onChange={(e) => setSelectedRegionalOffice(e.target.value)} required className="ui-select">
                <option value="">Nothing selected</option>
                {regionalOffices
                  .filter((ro) => !selectedRegion || ro.regionId === selectedRegion)
                  .map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name} ({office.seriesCode})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Select Client <span className="text-red-500">*</span></label>
              <select name="client_id_on_user_profile" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} required className="ui-select">
                <option value="">--Select Client--</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Branch</label>
              <select name="branch_id_on_user_profile" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} disabled={!selectedClient} className="ui-select disabled:bg-slate-100">
                <option value="">Nothing selected</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} - {branch.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Deploy as</label>
              <select name="deploy_as" value={designation} onChange={(e) => setDesignation(e.target.value)} required className="ui-select">
                <option value="">--Select Deployment Type--</option>
                <option value="Guard">Guard</option>
                <option value="location supervisor">location supervisor</option>
                <option value="cpo">cpo</option>
                <option value="SO">SO</option>
                <option value="ASO">ASO</option>
                <option value="LSO">LSO</option>
                <option value="Receptionist">Receptionist</option>
                <option value="CCTV Operator">CCTV Operator</option>
                <option value="Complaint Receiver">Complaint Receiver</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Guard's Type</label>
              <select name="guard_type" value={guardType} onChange={(e) => setGuardType(e.target.value)} required className="ui-select">
                <option value="">Type</option>
                <option value="Guard">Guard</option>
                <option value="Ex-Service">Ex-Service</option>
              </select>
            </div>
          </div>
        </section>

        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--brand)]" />
            Deploy Guards
          </h2>

          <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Select Guard</label>
            <select name="guard_id" value={selectedGuard} onChange={(e) => setSelectedGuard(e.target.value)} required disabled={!selectedRegion} className="ui-select disabled:bg-slate-100">
              <option value="">--Select Guard--</option>
              {guards.map((guard) => (
                <option key={guard.id} value={guard.id}>
                  {guard.name} - {guard.cnic} - {guard.phone}
                </option>
              ))}
            </select>
          </div>

          {selectedGuardData ? (
            <div className="mt-4 p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]">
              <h3 className="font-medium mb-2">Selected Guard Details:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Guard's Name</label>
                  <input value={selectedGuardData.name} readOnly className="ui-input bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Guard's Designations</label>
                  <input value={designation || "Designation"} readOnly className="ui-input bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Guard's Type</label>
                  <input value={guardType || "Type"} readOnly className="ui-input bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Supervisor Name</label>
                  <input name="Supervisor Name" value="—" readOnly className="ui-input bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Manager Name</label>
                  <input name="Manager Name" value="—" readOnly className="ui-input bg-slate-50" />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[var(--brand)]" />
            Financial Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Salary</label>
              <input name="salary" type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Guards salary" className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Overtime</label>
              <input name="overtime" type="number" value={overtime} onChange={(e) => setOvertime(e.target.value)} placeholder="Guards Overtime Pay" className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Extra Hours</label>
              <input name="extra_hours" type="number" value={extraHours} onChange={(e) => setExtraHours(e.target.value)} placeholder="Extra hours salary" className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Post Allowance</label>
              <input name="post_allowance" type="number" value={postAllowance} onChange={(e) => setPostAllowance(e.target.value)} placeholder="Guards post allowance" className="ui-input" />
            </div>
          </div>
        </section>

        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--brand)]" />
            Shift & Deployment Options
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Shift</label>
              <div className="flex gap-4 text-sm mt-2">
                <label className="inline-flex items-center gap-2">
                  <input name="shift" type="radio" checked={shiftType === "DAY"} onChange={() => setShiftType("DAY")} className="h-4 w-4 accent-[var(--brand)]" />
                  <span>Day</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input name="shift" type="radio" checked={shiftType === "NIGHT"} onChange={() => setShiftType("NIGHT")} className="h-4 w-4 accent-[var(--brand)]" />
                  <span>Night</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input name="shift" type="radio" checked={shiftType === "BOTH"} onChange={() => setShiftType("BOTH")} className="h-4 w-4 accent-[var(--brand)]" />
                  <span>Both</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Deployment Date</label>
              <input name="deployment_date" type="date" value={deploymentDate} onChange={(e) => setDeploymentDate(e.target.value)} required className="ui-input" />
            </div>

            {(shiftType === "DAY" || shiftType === "BOTH") ? (
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

            {(shiftType === "NIGHT" || shiftType === "BOTH") ? (
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

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Deployment</label>
              <select name="deployment_type" value={deploymentType} onChange={(e) => setDeploymentType(e.target.value)} className="ui-select">
                <option value="REGULAR">Regular</option>
                <option value="OVERTIME">Overtime</option>
              </select>
            </div>
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

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Guard Deployment Status*</label>
              <select name="Select Action:" value={guardDeploymentStatus} onChange={(e) => setGuardDeploymentStatus(e.target.value)} className="ui-select">
                <option value="">Select Status</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
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
    </div>
  )
}
