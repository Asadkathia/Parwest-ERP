"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import SectionTitle from "@/components/ui/section-title"
import StatusChip from "@/components/ui/status-chip"

type Region = { id: string; name: string }
type Office = { id: string; regionId: string; name: string }
type Supervisor = { id: string; officeId: string; name: string }

type ImpactedGuard = { id: string; name: string; fromSupervisor: string; toSupervisor: string; status: string }

const regions: Region[] = [
  { id: "lahore", name: "Lahore" },
  { id: "karachi", name: "Karachi" },
]
const offices: Office[] = [
  { id: "office-lhr", regionId: "lahore", name: "Lahore Head Office" },
  { id: "office-gul", regionId: "lahore", name: "Gulberg Office" },
  { id: "office-khi", regionId: "karachi", name: "Karachi Regional Office" },
]
const supervisors: Supervisor[] = [
  { id: "sup-1", officeId: "office-lhr", name: "Fazal Mehdi" },
  { id: "sup-2", officeId: "office-lhr", name: "Muhammad Aslam" },
  { id: "sup-3", officeId: "office-gul", name: "Haider Ali" },
  { id: "sup-4", officeId: "office-khi", name: "Safdar Ali" },
]

export default function SwitchSupervisorManager() {
  const [regionId, setRegionId] = useState("")
  const [officeId, setOfficeId] = useState("")
  const [fromSupervisorId, setFromSupervisorId] = useState("")
  const [toSupervisorId, setToSupervisorId] = useState("")
  const [reason, setReason] = useState("")
  const [result, setResult] = useState<"idle" | "previewed" | "switched">("idle")

  const officeOptions = useMemo(() => offices.filter((office) => !regionId || office.regionId === regionId), [regionId])
  const supervisorOptions = useMemo(() => supervisors.filter((sup) => !officeId || sup.officeId === officeId), [officeId])

  const impacted: ImpactedGuard[] = useMemo(() => {
    const from = supervisors.find((item) => item.id === fromSupervisorId)
    const to = supervisors.find((item) => item.id === toSupervisorId)
    if (!from || !to) return []
    return [
      { id: "PW-00001", name: "Test Guard One", fromSupervisor: from.name, toSupervisor: to.name, status: "PENDING" },
      { id: "PW-00002", name: "Test Guard Two", fromSupervisor: from.name, toSupervisor: to.name, status: "PENDING" },
    ]
  }, [fromSupervisorId, toSupervisorId])

  const canPreview = Boolean(regionId && officeId && fromSupervisorId && toSupervisorId)

  return (
    <div className="space-y-6">
      <SectionTitle title="Switch Supervisor" subtitle="Region -> office -> from supervisor -> to supervisor workflow" />

      <section className="ui-card p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm mb-1 text-[var(--text-muted)]">Region</label>
          <select value={regionId} onChange={(e) => { setRegionId(e.target.value); setOfficeId(""); setFromSupervisorId(""); setToSupervisorId("") }} className="ui-select">
            <option value="">Select region</option>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 text-[var(--text-muted)]">Regional Office</label>
          <select value={officeId} onChange={(e) => { setOfficeId(e.target.value); setFromSupervisorId(""); setToSupervisorId("") }} className="ui-select">
            <option value="">Select office</option>
            {officeOptions.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 text-[var(--text-muted)]">From Supervisor</label>
          <select value={fromSupervisorId} onChange={(e) => setFromSupervisorId(e.target.value)} className="ui-select">
            <option value="">Select from supervisor</option>
            {supervisorOptions.map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 text-[var(--text-muted)]">To Supervisor</label>
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
          <ActionButton disabled={!canPreview} onClick={() => setResult("previewed")}>Preview</ActionButton>
          <ActionButton variant="secondary" disabled={result !== "previewed"} onClick={() => setResult("switched")}>Switch</ActionButton>
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
                <td className="px-4 py-2 text-sm">{row.id}</td>
                <td className="px-4 py-2 text-sm">{row.name}</td>
                <td className="px-4 py-2 text-sm">{row.fromSupervisor}</td>
                <td className="px-4 py-2 text-sm">{row.toSupervisor}</td>
                <td className="px-4 py-2 text-sm"><StatusChip label={result === "switched" ? "SWITCHED" : row.status} variant={result === "switched" ? "success" : "warning"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
