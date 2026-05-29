"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/shadcn/button"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/shadcn/alert"
import { Badge } from "@/components/shadcn/badge"
import { useSession } from "next-auth/react"
type Region = { id: string; name: string }
type Office = { id: string; regionId: string; name: string }
type User = { id: string; name: string; roleId?: string | null; regionalOfficeId?: string | null; role?: { id: string; name: string } | null }
type Role = { id: string; name: string }
type ApiOffice = { id: string; regionId: string; name: string }

type ImpactedGuard = {
  id: string
  guardId: string
  parwestId: string
  guardName: string
  fromSupervisorId: string
  toSupervisorId: string
  status: string
}

export default function SwitchSupervisorManager() {
  const { data: sessionData } = useSession()
  const sessionUser = sessionData?.user as
    | { regionId?: string | null; regionalOfficeId?: string | null; roleScopeType?: "GLOBAL" | "REGIONAL" }
    | undefined
  const lockedRegionId = sessionUser?.roleScopeType === "REGIONAL" ? sessionUser?.regionId ?? null : null
  const lockedOfficeId = sessionUser?.roleScopeType === "REGIONAL" ? sessionUser?.regionalOfficeId ?? null : null

  const [regions, setRegions] = useState<Region[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [regionId, setRegionId] = useState(lockedRegionId ?? "")
  const [officeId, setOfficeId] = useState(lockedOfficeId ?? "")
  const [fromSupervisorId, setFromSupervisorId] = useState("")
  const [toSupervisorId, setToSupervisorId] = useState("")
  const [reason, setReason] = useState("")
  const [impacted, setImpacted] = useState<ImpactedGuard[]>([])
  const [result, setResult] = useState<"idle" | "previewed" | "switched">("idle")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadDependencies() {
      try {
        const regionParam = lockedRegionId
          ? `?regionId=${encodeURIComponent(lockedRegionId)}`
          : ""
        const [regionsRes, officesRes, usersRes, rolesRes] = await Promise.all([
          fetch("/api/regions", { cache: "no-store" }),
          fetch(`/api/regional-offices${regionParam}`, { cache: "no-store" }),
          fetch(`/api/users${regionParam}`, { cache: "no-store" }),
          fetch("/api/roles", { cache: "no-store" }),
        ])
        const [regionsJson, officesJson, usersJson, rolesJson] = await Promise.all([
          regionsRes.json().catch(() => []),
          officesRes.json().catch(() => []),
          usersRes.json().catch(() => []),
          rolesRes.json().catch(() => []),
        ])
        if (!regionsRes.ok || !officesRes.ok || !usersRes.ok || !rolesRes.ok) {
          throw new Error("Failed to load switch supervisor dependencies.")
        }
        if (cancelled) return
        setRegions(Array.isArray(regionsJson) ? regionsJson : [])
        setOffices(Array.isArray(officesJson) ? (officesJson as ApiOffice[]).map((o) => ({ id: o.id, regionId: o.regionId, name: o.name })) : [])
        setUsers(Array.isArray(usersJson) ? usersJson : [])
        setRoles(Array.isArray(rolesJson) ? rolesJson : [])
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load switch data.")
        }
      }
    }
    void loadDependencies()
    return () => {
      cancelled = true
    }
  }, [lockedRegionId])

  const officeOptions = useMemo(() => offices.filter((office) => !regionId || office.regionId === regionId), [offices, regionId])
  const supervisorRoleIds = useMemo(
    () => new Set(roles.filter((role) => /supervisor/i.test(role.name)).map((role) => role.id)),
    [roles]
  )
  const supervisorOptions = useMemo(
    () =>
      users.filter((user) => {
        const isSupervisor = (user.roleId && supervisorRoleIds.has(user.roleId)) || /supervisor/i.test(user.role?.name || "")
        const inOffice = !officeId || user.regionalOfficeId === officeId
        return isSupervisor && inOffice
      }),
    [users, supervisorRoleIds, officeId]
  )

  const canPreview = Boolean(regionId && officeId && fromSupervisorId && toSupervisorId)

  const preview = async () => {
    setNotice("")
    setError("")
    if (!canPreview) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        fromSupervisorId,
        toSupervisorId,
      })
      const response = await fetch(`/api/users/switch-supervisor?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload?.message || "Failed to preview switch.")
      // GET now wraps as `ok(rows)` → `{success, data:[...]}`. Accept either envelope or legacy raw.
      const impactedRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
      setImpacted(impactedRows)
      setResult("previewed")
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Failed to preview switch.")
      setImpacted([])
      setResult("idle")
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    setNotice("")
    setError("")
    setSubmitting(true)
    try {
      const response = await fetch("/api/users/switch-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromSupervisorId, toSupervisorId, reason: reason || null }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.message || "Failed to apply switch.")
      // POST now wraps the result as `ok({switchedCount, ...})`. Unwrap; fall back to raw for safety.
      const result = (payload?.data ?? payload) as { switchedCount?: number }
      setNotice(`Supervisor switched for ${result.switchedCount ?? 0} guards.`)
      setResult("switched")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to apply switch.")
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setRegionId("")
    setOfficeId("")
    setFromSupervisorId("")
    setToSupervisorId("")
    setReason("")
    setResult("idle")
    setImpacted([])
    setNotice("")
    setError("")
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Switch Supervisor</h2>
          <p className="mt-1 text-sm text-muted-foreground">region -&gt; reigional office -&gt; From Supervisor -&gt; To supervisor</p>
        </div>
      </div>
      {notice ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{notice}</AlertDescription></Alert> : null}
      {error ? <Alert className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 [&>svg]:text-rose-600 dark:[&>svg]:text-rose-300"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert> : null}

      <section className="ui-card p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!lockedRegionId && (
          <div>
            <label className="block text-sm mb-1 text-[var(--text-muted)]">region</label>
            <select value={regionId} onChange={(e) => { setRegionId(e.target.value); setOfficeId(""); setFromSupervisorId(""); setToSupervisorId("") }} className="ui-select">
              <option value="">Select region</option>
              {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
            </select>
          </div>
        )}
        {!lockedOfficeId && (
          <div>
            <label className="block text-sm mb-1 text-[var(--text-muted)]">reigional office</label>
            <select value={officeId} onChange={(e) => { setOfficeId(e.target.value); setFromSupervisorId(""); setToSupervisorId("") }} className="ui-select">
              <option value="">Select office</option>
              {officeOptions.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm mb-1 text-[var(--text-muted)]">From Supervisor</label>
          <select value={fromSupervisorId} onChange={(e) => setFromSupervisorId(e.target.value)} className="ui-select">
            <option value="">Select from supervisor</option>
            {supervisorOptions.map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 text-[var(--text-muted)]">To supervisor</label>
          <select value={toSupervisorId} onChange={(e) => setToSupervisorId(e.target.value)} className="ui-select">
            <option value="">Select to supervisor</option>
            {supervisorOptions.filter((item) => item.id !== fromSupervisorId).map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 text-[var(--text-muted)]">Reason</label>
          <textarea className="ui-textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for switch" />
        </div>

        <div className="md:col-span-2 lg:col-span-3 flex items-center gap-2">
          <Button disabled={!canPreview || loading} onClick={() => void preview()}>{loading ? "Previewing..." : "Preview"}</Button>
          <Button variant="secondary" disabled={result !== "previewed" || submitting} onClick={() => void submit()}>{submitting ? "Submitting..." : "Submit"}</Button>
          <Button variant="secondary" onClick={resetForm}>Reset</Button>
        </div>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[760px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Parwest ID</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">From</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">To</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {impacted.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Select values to preview impacted guards.</td></tr>
            ) : impacted.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-sm">{row.parwestId}</td>
                <td className="px-4 py-2 text-sm">{row.guardName}</td>
                <td className="px-4 py-2 text-sm">{supervisorOptions.find((u) => u.id === row.fromSupervisorId)?.name || row.fromSupervisorId}</td>
                <td className="px-4 py-2 text-sm">{supervisorOptions.find((u) => u.id === row.toSupervisorId)?.name || row.toSupervisorId}</td>
                <td className="px-4 py-2 text-sm"><Badge className={"font-bold bg-secondary text-secondary-foreground border-transparent"}>{result === "switched" ? "SWITCHED" : row.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
