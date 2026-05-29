"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Card, CardContent } from "@/components/shadcn/card"
type Region = { id: string; name: string }
type Client = { id: string; name: string }
type Branch = { id: string; name: string }

type DeploymentRate = {
  id: string
  region: { id: string; name: string } | null
  client: { id: string; name: string } | null
  branch: { id: string; name: string } | null
  deployAs: string | null
  guardType: string | null
  shiftType: string | null
  salary: number | null
  overtime: number | null
  extraHours: number | null
  postAllowance: number | null
  createdAt: string
}

export default function DeploymentRatesForm() {
  const [regions, setRegions] = useState<Region[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [branches, setBranches] = useState<Branch[]>([])

  const [regionId, setRegionId] = useState("")
  const [clientId, setClientId] = useState("")
  const [branchId, setBranchId] = useState("")
  const [deployAs, setDeployAs] = useState("")
  const [guardType, setGuardType] = useState("")
  const [shiftType, setShiftType] = useState("DAY")

  const [salary, setSalary] = useState("")
  const [overtime, setOvertime] = useState("")
  const [extraHours, setExtraHours] = useState("")
  const [postAllowance, setPostAllowance] = useState("")

  const [recentRates, setRecentRates] = useState<DeploymentRate[]>([])
  const [showEntries, setShowEntries] = useState("10")
  const [tableSearch, setTableSearch] = useState("")
  const [selectDate, setSelectDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const loadMasterData = async () => {
    try {
      const [regionsRes, clientsRes] = await Promise.all([fetch("/api/regions"), fetch("/api/clients?status=ACTIVE")])
      if (regionsRes.ok) {
        const regionData = await regionsRes.json()
        setRegions(Array.isArray(regionData) ? regionData : [])
      } else {
        setRegions([])
      }
      if (clientsRes.ok) {
        const clientData = await clientsRes.json()
        setClients(Array.isArray(clientData) ? clientData : [])
      } else {
        setClients([])
      }
    } catch {
      setRegions([])
      setClients([])
    }
  }

  const loadBranches = async (selectedClientId: string) => {
    if (!selectedClientId) {
      setBranches([])
      return
    }
    try {
      const response = await fetch(`/api/clients/${selectedClientId}/branches`)
      if (!response.ok) {
        setBranches([])
        return
      }
      setBranches(await response.json())
    } catch {
      setBranches([])
    }
  }

  const loadRecentRates = async () => {
    try {
      const response = await fetch("/api/deployment-rates")
      if (!response.ok) {
        setRecentRates([])
        return
      }
      setRecentRates(await response.json())
    } catch {
      setRecentRates([])
    }
  }

  useEffect(() => {
    loadMasterData()
    loadRecentRates()
  }, [])

  useEffect(() => {
    loadBranches(clientId)
    setBranchId("")
  }, [clientId])

  const getPreviousRates = async () => {
    try {
      setError("")
      setSuccess("")
      const params = new URLSearchParams()
      if (regionId) params.set("regionId", regionId)
      if (clientId) params.set("clientId", clientId)
      if (branchId) params.set("branchId", branchId)
      if (deployAs) params.set("deployAs", deployAs)
      if (guardType) params.set("guardType", guardType)
      if (shiftType) params.set("shiftType", shiftType)
      params.set("latest", "true")

      const response = await fetch(`/api/deployment-rates?${params.toString()}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Failed to fetch previous rates")
      }

      const latest = await response.json()
      if (!latest) {
        setError("No previous rate found for selected filters")
        return
      }

      setSalary(latest.salary?.toString() || "")
      setOvertime(latest.overtime?.toString() || "")
      setExtraHours(latest.extraHours?.toString() || "")
      setPostAllowance(latest.postAllowance?.toString() || "")
      setSuccess("Previous rates loaded")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch previous rates")
    }
  }

  const saveRate = async () => {
    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const response = await fetch("/api/deployment-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionId: regionId || null,
          clientId: clientId || null,
          branchId: branchId || null,
          deployAs,
          guardType,
          shiftType,
          salary,
          overtime,
          extraHours,
          postAllowance,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Failed to save rate")
      }

      setSuccess("Deployment rate saved")
      await loadRecentRates()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save rate")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold tracking-tight">{"Deployments Rate Updation"}</h2><p className="mt-1 text-sm text-muted-foreground">{"Configure salary, overtime, extra hours and post allowance rates"}</p></div></div>

      {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}
      {success ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert> : null}

      <Card>
        <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Region</label>
            <select name="region_id_on_user_profile" value={regionId} onChange={(e) => setRegionId(e.target.value)} className="ui-select">
              <option value="">--Select Region--</option>
              {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Client</label>
            <select name="client_id_on_user_profile" value={clientId} onChange={(e) => setClientId(e.target.value)} className="ui-select">
              <option value="">--Select Client--</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Branch</label>
            <select name="branch_id_on_user_profile" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="ui-select" disabled={!clientId}>
              <option value="">Nothing selected</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Deploy As</label>
            <select name="deployGuardAsDesignation[]" value={deployAs} onChange={(e) => setDeployAs(e.target.value)} className="ui-select">
              <option value="">Nothing selected</option>
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Guard&apos;s Type</label>
            <select name="guard_type" value={guardType} onChange={(e) => setGuardType(e.target.value)} className="ui-select">
              <option value="">Nothing selected</option>
              <option value="Guard">Guard</option>
              <option value="Ex-Service">Ex-Service</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm text-[var(--text-muted)] mb-1">Shift</label>
            <div className="flex gap-4 text-sm mt-2">
              <label className="inline-flex items-center gap-2">
                <input name="shift_type" type="radio" checked={shiftType === "DAY"} onChange={() => setShiftType("DAY")} className="h-4 w-4 accent-[var(--brand)]" />
                <span>Day</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input name="shift_type" type="radio" checked={shiftType === "NIGHT"} onChange={() => setShiftType("NIGHT")} className="h-4 w-4 accent-[var(--brand)]" />
                <span>Night</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input name="shift_type" type="radio" checked={shiftType === "BOTH"} onChange={() => setShiftType("BOTH")} className="h-4 w-4 accent-[var(--brand)]" />
                <span>Both</span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><label className="block text-sm text-[var(--text-muted)] mb-1">Salary</label><input name="salary" value={salary} onChange={(e) => setSalary(e.target.value)} className="ui-input" placeholder="Guards salary" type="number" /></div>
          <div><label className="block text-sm text-[var(--text-muted)] mb-1">Overtime</label><input name="overtime" value={overtime} onChange={(e) => setOvertime(e.target.value)} className="ui-input" placeholder="Guards overtime pay" type="number" /></div>
          <div><label className="block text-sm text-[var(--text-muted)] mb-1">Extra Hours</label><input name="extra_hours" value={extraHours} onChange={(e) => setExtraHours(e.target.value)} className="ui-input" placeholder="Extra hours salary" type="number" /></div>
          <div><label className="block text-sm text-[var(--text-muted)] mb-1">Post Allowance</label><input name="post_allowance" value={postAllowance} onChange={(e) => setPostAllowance(e.target.value)} className="ui-input" placeholder="Guards post allowance" type="number" /></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={getPreviousRates}>Get Previous Rates</Button>
          <Button type="button" onClick={saveRate} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
        </div>
        </CardContent>
      </Card>

      <section className="ui-card overflow-x-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-[var(--surface-muted)] px-4 py-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Show 102550100 entries</label>
            <select name="Show 102550100 entries" value={showEntries} onChange={(e) => setShowEntries(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
              {["10", "25", "50", "100"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Search:</label>
              <input name="Search:" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="rounded-md border px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Select Date</label>
              <input name="Select Date" type="date" value={selectDate} onChange={(e) => setSelectDate(e.target.value)} className="rounded-md border px-2 py-1 text-sm" />
            </div>
          </div>
        </div>
        <table className="w-full min-w-[1200px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Region</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Client</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Branch</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Deploy As</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Type</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Shift</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Salary</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Overtime</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Extra Hours</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Post Allowance</th>
              <th className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {recentRates.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No rates found.</td></tr>
            ) : (
              recentRates
                .filter((rate) => {
                  if (!tableSearch.trim()) return true
                  const q = tableSearch.toLowerCase()
                  return (
                    (rate.region?.name || "").toLowerCase().includes(q) ||
                    (rate.client?.name || "").toLowerCase().includes(q) ||
                    (rate.branch?.name || "").toLowerCase().includes(q) ||
                    (rate.deployAs || "").toLowerCase().includes(q) ||
                    (rate.guardType || "").toLowerCase().includes(q)
                  )
                })
                .filter((rate) => {
                  if (!selectDate) return true
                  return new Date(rate.createdAt).toISOString().slice(0, 10) === selectDate
                })
                .slice(0, Number.parseInt(showEntries, 10) || 10)
                .map((rate) => (
                <tr key={rate.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-4 py-3 text-sm">{rate.region?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.client?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.branch?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.deployAs || "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.guardType || "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.shiftType || "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.salary ?? "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.overtime ?? "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.extraHours ?? "—"}</td>
                  <td className="px-4 py-3 text-sm">{rate.postAllowance ?? "—"}</td>
                  <td className="px-4 py-3 text-sm">{new Date(rate.createdAt).toLocaleDateString("en-US")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
