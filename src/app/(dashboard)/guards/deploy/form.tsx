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

export default function DeployGuardForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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
      setRegions(data)
    } catch {
      setRegions([])
    }
  }

  const loadClients = async () => {
    try {
      const res = await fetch("/api/clients")
      const data = await res.json()
      setClients(data)
    } catch {
      setClients([])
    }
  }

  const loadBranches = async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}/branches`)
      const data = await res.json()
      setBranches(data)
    } catch {
      setBranches([])
    }
  }

  const loadGuards = async (regionId: string) => {
    try {
      const res = await fetch(`/api/guards?regionId=${regionId}&status=ACTIVE`)
      const data = await res.json()
      setGuards(data)
    } catch {
      setGuards([])
    }
  }

  const loadRegionalOffices = async () => {
    try {
      const res = await fetch("/api/regional-offices")
      const data = await res.json()
      setRegionalOffices(data)
    } catch {
      setRegionalOffices([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

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
          status: "ACTIVE",
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to deploy guard")
      }

      const deployment = await res.json()
      router.push(`/deployments/${deployment.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedGuardData = guards.find((g) => g.id === selectedGuard)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SectionTitle title="Deploy Guard" subtitle="Assign a guard to a client site" />

      {error ? <InlineAlert type="error" message={error} /> : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[var(--brand)]" />
            Location & Assignment
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Region <span className="text-red-500">*</span></label>
              <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} required className="ui-select">
                <option value="">--Select Region--</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Regional Office <span className="text-red-500">*</span></label>
              <select value={selectedRegionalOffice} onChange={(e) => setSelectedRegionalOffice(e.target.value)} required className="ui-select">
                <option value="">--Select Regional Office--</option>
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
              <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} required className="ui-select">
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
              <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} disabled={!selectedClient} className="ui-select disabled:bg-slate-100">
                <option value="">--Select Branch--</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} - {branch.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Deploy As (Designation) <span className="text-red-500">*</span></label>
              <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} required placeholder="e.g., Security Guard, Supervisor" className="ui-input" />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Guard Type <span className="text-red-500">*</span></label>
              <select value={guardType} onChange={(e) => setGuardType(e.target.value)} required className="ui-select">
                <option value="Security Guard">Security Guard</option>
                <option value="Supervisor">Supervisor</option>
                <option value="CPO">CPO</option>
                <option value="Ex-Service">Ex-Service</option>
              </select>
            </div>
          </div>
        </section>

        <section className="ui-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--brand)]" />
            Select Guard
          </h2>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Guard <span className="text-red-500">*</span></label>
            <select value={selectedGuard} onChange={(e) => setSelectedGuard(e.target.value)} required disabled={!selectedRegion} className="ui-select disabled:bg-slate-100">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div><span className="font-medium">Name:</span> {selectedGuardData.name}</div>
                <div><span className="font-medium">CNIC:</span> {selectedGuardData.cnic}</div>
                <div><span className="font-medium">Phone:</span> {selectedGuardData.phone}</div>
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
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Salary (Monthly)</label>
              <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="25000" className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Overtime</label>
              <input type="number" value={overtime} onChange={(e) => setOvertime(e.target.value)} placeholder="0" className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Extra Hours</label>
              <input type="number" value={extraHours} onChange={(e) => setExtraHours(e.target.value)} placeholder="0" className="ui-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Post Allowance</label>
              <input type="number" value={postAllowance} onChange={(e) => setPostAllowance(e.target.value)} placeholder="0" className="ui-input" />
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
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Shift Type <span className="text-red-500">*</span></label>
              <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} required className="ui-select">
                <option value="DAY">Day Shift</option>
                <option value="NIGHT">Night Shift</option>
                <option value="BOTH">Both Shifts</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Deployment Date <span className="text-red-500">*</span></label>
              <input type="date" value={deploymentDate} onChange={(e) => setDeploymentDate(e.target.value)} required className="ui-input" />
            </div>

            {(shiftType === "DAY" || shiftType === "BOTH") ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Day Shift Start</label>
                  <input type="time" value={dayShiftStart} onChange={(e) => setDayShiftStart(e.target.value)} className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Day Shift End</label>
                  <input type="time" value={dayShiftEnd} onChange={(e) => setDayShiftEnd(e.target.value)} className="ui-input" />
                </div>
              </>
            ) : null}

            {(shiftType === "NIGHT" || shiftType === "BOTH") ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Night Shift Start</label>
                  <input type="time" value={nightShiftStart} onChange={(e) => setNightShiftStart(e.target.value)} className="ui-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Night Shift End</label>
                  <input type="time" value={nightShiftEnd} onChange={(e) => setNightShiftEnd(e.target.value)} className="ui-input" />
                </div>
              </>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Deployment Type</label>
              <select value={deploymentType} onChange={(e) => setDeploymentType(e.target.value)} className="ui-select">
                <option value="REGULAR">Regular</option>
                <option value="OVERTIME">Overtime</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text)]">
                <input
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
        </div>
      </form>
    </div>
  )
}
