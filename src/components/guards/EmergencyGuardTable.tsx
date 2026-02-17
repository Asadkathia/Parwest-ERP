"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import StatusChip from "@/components/ui/status-chip"
import { EmergencyGuardRow, EmergencyReason } from "@/lib/mockData"

function urgencyVariant(urgency: EmergencyGuardRow["urgency"]) {
  if (urgency === "HIGH") return "danger"
  if (urgency === "MEDIUM") return "warning"
  return "neutral"
}

export default function EmergencyGuardTable({ rows }: { rows: EmergencyGuardRow[] }) {
  const [data, setData] = useState(rows)
  const [filter, setFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL")
  const [name, setName] = useState("")
  const [cnic, setCnic] = useState("")
  const [phone, setPhone] = useState("")
  const [selectedReasons, setSelectedReasons] = useState<EmergencyReason[]>(["PROFILE_INCOMPLETE"])

  const filtered = useMemo(() => {
    if (filter === "ALL") return data
    return data.filter((row) => row.urgency === filter)
  }, [data, filter])

  const markEscalated = (id: string) => {
    setData((prev) => prev.map((row) => (row.id === id ? { ...row, urgency: "HIGH" } : row)))
  }

  const toggleReason = (reason: EmergencyReason) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((item) => item !== reason) : [...prev, reason]
    )
  }

  const addEmergencyGuard = () => {
    const guardName = name.trim()
    if (!guardName) return

    const reasons: EmergencyReason[] = selectedReasons.length > 0 ? selectedReasons : ["PROFILE_INCOMPLETE"]
    const urgency = reasons.length >= 2 ? "HIGH" : reasons[0] === "PROFILE_INCOMPLETE" ? "LOW" : "MEDIUM"

    setData((prev) => [
      {
        id: `emergency-${crypto.randomUUID()}`,
        parwestId: `EMG-${String(prev.length + 1).padStart(4, "0")}`,
        name: guardName,
        cnic: cnic.trim() || undefined,
        phone: phone.trim() || null,
        status: "PENDING_DOCS",
        urgency,
        reasons,
        source: "manual",
      },
      ...prev,
    ])

    setName("")
    setCnic("")
    setPhone("")
    setSelectedReasons(["PROFILE_INCOMPLETE"])
  }

  return (
    <section className="space-y-3">
      <div className="ui-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">Add Emergency Guard</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="ui-input"
            placeholder="Guard name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="ui-input"
            placeholder="CNIC"
            value={cnic}
            onChange={(e) => setCnic(e.target.value)}
          />
          <input
            className="ui-input"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["CNIC_EXPIRY_SOON", "MISSING_VERIFICATION", "MISSING_PLEDGED_DOCS", "PROFILE_INCOMPLETE"] as EmergencyReason[]).map((reason) => (
            <button
              key={reason}
              type="button"
              className={`ui-chip ${selectedReasons.includes(reason) ? "ui-chip-warning" : "ui-chip-neutral"}`}
              onClick={() => toggleReason(reason)}
            >
              {reason}
            </button>
          ))}
        </div>
        <div>
          <ActionButton onClick={addEmergencyGuard}>Add as Emergency Guard</ActionButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((chip) => (
          <button
            key={chip}
            type="button"
            className={`ui-chip ${filter === chip ? "ui-chip-success" : "ui-chip-neutral"}`}
            onClick={() => setFilter(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[980px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Parwest ID</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Guard</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">CNIC</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Phone</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Urgency</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Reasons</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-sm text-[var(--text)]">{row.parwestId}</td>
                <td className="px-4 py-2 text-sm text-[var(--text)]">{row.name}</td>
                <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{row.cnic || "—"}</td>
                <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{row.phone || "—"}</td>
                <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{row.status}</td>
                <td className="px-4 py-2 text-sm"><StatusChip label={row.urgency} variant={urgencyVariant(row.urgency)} /></td>
                <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{row.reasons.join(", ")}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton className="px-2.5 py-1.5 text-xs">Assign Temporarily</ActionButton>
                    <ActionButton className="px-2.5 py-1.5 text-xs" variant="secondary" onClick={() => markEscalated(row.id)}>Mark Escalated</ActionButton>
                    {row.source === "manual" ? (
                      <Link href="/guards/new" className="ui-btn ui-btn-secondary px-2.5 py-1.5 text-xs">Complete Profile</Link>
                    ) : (
                      <Link href={`/guards/${row.id}`} className="ui-btn ui-btn-secondary px-2.5 py-1.5 text-xs">Open Profile</Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
