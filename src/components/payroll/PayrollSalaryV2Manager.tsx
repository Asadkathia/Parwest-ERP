"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import RegionUrlPicker from "@/components/access/RegionUrlPicker"

type Client = { id: string; name: string }
type Office = { id: string; name: string }
type Region = { id: string; name: string }
type BranchRow = {
  sr: number
  branchId: string | null
  branchCode: string | null
  branchName: string
  clientId: string | null
  clientName: string
  region: string
  deployGuards: number
  extraGuards: number
  totalSalary: number
  managerId: string | null
}
type Summary = {
  month: string
  summary: {
    activeClients: number
    totalLocations: number
    totalGuards: number
    totalSalary: number
  }
  guardsByType: { Civilian: number; Army: number; Other: number }
  avgSalaryRates: { Civilian: number; Army: number }
  attendanceStats: {
    totalDays: number
    extraDays: number
  }
  branches: BranchRow[]
}

const ALL_COLUMNS = [
  { id: "sr", label: "Sr" },
  { id: "branchCode", label: "Branch Code" },
  { id: "branchName", label: "Branch Name" },
  { id: "clientName", label: "Client" },
  { id: "region", label: "Region" },
  { id: "deployGuards", label: "Deploy Guards" },
  { id: "extraGuards", label: "Extra Guards" },
  { id: "totalSalary", label: "Total Salary" },
] as const

type PayrollSalaryV2ManagerProps = {
  canCreate?: boolean
  effectiveRegionId?: string | null
  regions?: Region[]
  locked?: boolean
}

export default function PayrollSalaryV2Manager({
  canCreate = false,
  effectiveRegionId = null,
  regions = [],
  locked = false,
}: PayrollSalaryV2ManagerProps = {}) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [regionalOfficeId, setRegionalOfficeId] = useState("")
  const [clientId, setClientId] = useState("")
  const [offices, setOffices] = useState<Office[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(ALL_COLUMNS.map((c) => c.id)))

  useEffect(() => {
    // Scope option lists to the gate-selected region. For REGIONAL users the
    // server enforces scope regardless; for SuperAdmin we forward `?regionId=`
    // so the dropdowns only contain offices/clients for the picked region.
    const officesUrl = effectiveRegionId
      ? `/api/regional-offices?regionId=${encodeURIComponent(effectiveRegionId)}`
      : "/api/regional-offices"
    const clientsUrl = effectiveRegionId
      ? `/api/clients?regionId=${encodeURIComponent(effectiveRegionId)}`
      : "/api/clients"
    fetch(officesUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.offices ?? data.rows ?? []
        setOffices(list.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })))
      })
      .catch(() => {})
    fetch(clientsUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.clients ?? data.rows ?? []
        setClients(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
    // Reset stale selections that may not exist in the new region.
    setRegionalOfficeId("")
    setClientId("")
  }, [effectiveRegionId])

  const generate = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    setFetchError(null)
    const params = new URLSearchParams()
    params.set("month", `${month}-01`)
    if (regionalOfficeId) params.set("regionalOfficeId", regionalOfficeId)
    if (clientId) params.set("clientId", clientId)
    if (effectiveRegionId) params.set("regionId", effectiveRegionId)
    try {
      const res = await fetch(`/api/payroll/salary-v2/summary?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSummary(await res.json())
    } catch (e) {
      setFetchError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [month, regionalOfficeId, clientId, effectiveRegionId])

  useEffect(() => {
    generate()
  }, [generate])

  const calculateSalary = async () => {
    setBusy(true)
    setMessage(null)
    const res = await fetch("/api/payroll/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: `${month}-01`,
        regionalOfficeId: regionalOfficeId || undefined,
        clientId: clientId || undefined,
        regionId: effectiveRegionId || undefined,
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) {
      setMessage(
        `Calculated ${data.calculated} rows.${data.warnings?.length ? ` ${data.warnings.length} zero-salary warning(s).` : ""}`
      )
      generate()
    } else {
      setMessage(`Error: ${data.error ?? "Failed."}`)
    }
  }

  const exportIndex = () => {
    if (!summary) return
    const header = ALL_COLUMNS.map((c) => c.label)
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [header.join(",")]
      .concat(
        summary.branches.map((b) =>
          [b.sr, b.branchCode, b.branchName, b.clientName, b.region, b.deployGuards, b.extraGuards, b.totalSalary]
            .map(escape)
            .join(",")
        )
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `salary-v2-index-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleCol = (id: string) =>
    setVisibleCols((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const visibleColumns = useMemo(() => ALL_COLUMNS.filter((c) => visibleCols.has(c.id)), [visibleCols])

  return (
    <PayrollPageShell
      title="Payroll — Salary V2"
      subtitle="Salary dashboard and per-branch rollup."
    >
      <section className="ui-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[200px_200px_1fr_1fr_auto_auto_auto] gap-3 items-end">
          <div>
            <RegionUrlPicker
              regions={regions}
              locked={locked}
              includeGlobalOption={!locked}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Salary Month *
            </label>
            <input
              type="month"
              className="ui-input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Regional Office
            </label>
            <select
              className="ui-select"
              value={regionalOfficeId}
              onChange={(e) => setRegionalOfficeId(e.target.value)}
            >
              <option value="">All Regions</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Client
            </label>
            <select className="ui-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <ActionButton onClick={generate} disabled={loading}>
            {loading ? "Loading…" : "Generate"}
          </ActionButton>
          {canCreate && (
            <ActionButton onClick={calculateSalary} disabled={busy}>
              {busy ? "Calculating…" : "Calculate Salary"}
            </ActionButton>
          )}
          <ActionButton variant="secondary" onClick={exportIndex} disabled={!summary}>
            Export Index
          </ActionButton>
        </div>
        {message && <p className="text-sm">{message}</p>}
        {fetchError && (
          <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
            Failed to load summary: {fetchError}
          </div>
        )}
      </section>

      {summary && (
        <>
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg p-4 text-center font-semibold mt-6">
            Salary Summary Dashboard — {summary.month}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <StatCard label="Active Clients" value={summary.summary.activeClients} />
            <StatCard label="Total Locations" value={summary.summary.totalLocations} />
            <StatCard label="Total Guards" value={summary.summary.totalGuards} />
            <StatCard
              label="Total Salary (PKR)"
              value={summary.summary.totalSalary.toLocaleString()}
              highlight
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <InfoCard title="Guards by Type">
              <KV k="Civilian" v={summary.guardsByType.Civilian.toLocaleString()} />
              <KV k="Army" v={summary.guardsByType.Army.toLocaleString()} />
              {summary.guardsByType.Other > 0 && (
                <KV k="Other" v={summary.guardsByType.Other.toLocaleString()} />
              )}
            </InfoCard>
            <InfoCard title="Avg Salary Rates">
              <KV k="Civilian" v={`PKR ${summary.avgSalaryRates.Civilian.toLocaleString()}`} />
              <KV k="Army" v={`PKR ${summary.avgSalaryRates.Army.toLocaleString()}`} />
            </InfoCard>
            <InfoCard title="Attendance Stats">
              <KV k="Total Days" v={summary.attendanceStats.totalDays.toLocaleString()} />
              <KV k="Extra Days" v={summary.attendanceStats.extraDays.toLocaleString()} />
            </InfoCard>
          </div>

          <section className="ui-card p-4 mt-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-semibold">Salary Report Data</h3>
              <details className="text-sm">
                <summary className="cursor-pointer text-[var(--brand)]">
                  Column Visibility
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL_COLUMNS.map((c) => (
                    <label
                      key={c.id}
                      className={`px-2 py-1 rounded text-xs cursor-pointer border ${
                        visibleCols.has(c.id)
                          ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                          : "bg-[var(--surface)] border-[var(--border)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={visibleCols.has(c.id)}
                        onChange={() => toggleCol(c.id)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </details>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[var(--surface-muted)]">
                  <tr>
                    {visibleColumns.map((c) => (
                      <th key={c.id} className="px-3 py-2 text-left">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.branches.length === 0 && (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 1}
                        className="px-3 py-6 text-center text-[var(--text-muted)]"
                      >
                        No branches for this selection.
                      </td>
                    </tr>
                  )}
                  {summary.branches.map((b) => (
                    <tr key={b.branchId ?? b.sr} className="border-t border-[var(--border)]">
                      {visibleColumns.map((c) => (
                        <td
                          key={c.id}
                          className={`px-3 py-2 ${c.id === "totalSalary" ? "text-right font-semibold" : ""}`}
                        >
                          {c.id === "totalSalary"
                            ? `PKR ${b.totalSalary.toLocaleString()}`
                            : c.id === "sr"
                              ? b.sr
                              : String((b as unknown as Record<string, unknown>)[c.id] ?? "")}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {b.branchId ? (
                          <Link
                            href={`/payroll/salary-v2/branch/${b.branchId}?month=${month}`}
                            className="text-[var(--brand)] hover:underline text-xs"
                          >
                            Details →
                          </Link>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </PayrollPageShell>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number | string
  highlight?: boolean
}) {
  return (
    <div
      className={`ui-card p-4 text-center ${highlight ? "bg-cyan-50 border-cyan-200" : ""}`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-[var(--text-muted)] mt-1">{label}</div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ui-card p-4">
      <div className="text-sm font-semibold text-indigo-700 mb-2">{title}</div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-muted)]">{k}:</span>
      <span className="font-semibold">{v}</span>
    </div>
  )
}
