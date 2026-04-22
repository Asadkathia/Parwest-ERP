"use client"

/**
 * Payroll state-machine dashboard.
 *
 * Layout cribbed from `src/app/(dashboard)/payroll/loans/page.tsx` (month +
 * region filter bar, ui-card sections, table conventions).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import ActionButton from "@/components/ui/action-button"
import PayrollPageShell from "@/components/payroll/shared/PayrollPageShell"
import PayrollStateBadge from "@/components/payroll/PayrollStateBadge"
import PayrollStateActions from "@/components/payroll/PayrollStateActions"
import InlineAlert from "@/components/ui/inline-alert"

type Region = { id: string; name: string }
type Office = { id: string; name: string }

type PayrollRow = {
  id: string
  state: string
  regionId: string | null
  regionalOfficeId: string | null
  netSalary: number | string | null
  reserveAmount: number | string | null
}

type FinalizationHistoryRecord = {
  id: string
  finalizedAt: string
  finalizedByName: string
  scope: string
  regionId: string | null
  regionalOfficeId: string | null
  month: string
  payrollCount: number
  totalNetPayable: number | string | null
  totalReserve: number | string | null
}

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; message: string; code?: string }

const KNOWN_STATES = [
  "DRAFT",
  "CALCULATED",
  "REGIONAL_LOCKED",
  "GLOBAL_FINALIZED",
  "PAID",
  "HOLD",
  "EMERGENCY_RELEASED",
] as const

function asNumber(v: number | string | null | undefined): number {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export default function PayrollStatePage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const permissions =
    (session?.user as { permissions?: string[] } | undefined)?.permissions ?? []
  const isSuperAdmin = role === "Admin" && permissions.length === 0

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [regionId, setRegionId] = useState("")
  const [regionalOfficeId, setRegionalOfficeId] = useState("")
  const [regions, setRegions] = useState<Region[]>([])
  const [offices, setOffices] = useState<Office[]>([])

  const [rows, setRows] = useState<PayrollRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [rowsError, setRowsError] = useState<string | null>(null)

  const [history, setHistory] = useState<FinalizationHistoryRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [resultMessage, setResultMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRegions(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch("/api/regional-offices")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.offices ?? data.rows ?? []
        setOffices(
          list.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }))
        )
      })
      .catch(() => {})
  }, [])

  const loadPayrolls = useCallback(async () => {
    setLoadingRows(true)
    setRowsError(null)
    try {
      // The /api/payroll/salary endpoint returns Payroll rows for a month,
      // including fields like `state`, `regionId`, `regionalOfficeId`, netSalary
      // and reserveAmount (via default findMany).
      const params = new URLSearchParams()
      params.set("month", `${month}-01`)
      const res = await fetch(`/api/payroll/salary?${params.toString()}`)
      if (!res.ok) {
        setRowsError(`HTTP ${res.status}`)
        setRows([])
        return
      }
      const data = (await res.json()) as PayrollRow[] | { rows: PayrollRow[] }
      const list = Array.isArray(data) ? data : data.rows ?? []
      // Apply client-side region/office filter
      const filtered = list.filter((r) => {
        if (regionId && r.regionId !== regionId) return false
        if (regionalOfficeId && r.regionalOfficeId !== regionalOfficeId) return false
        return true
      })
      setRows(filtered)
    } catch (e) {
      setRowsError((e as Error).message ?? "Failed to load payrolls.")
    } finally {
      setLoadingRows(false)
    }
  }, [month, regionId, regionalOfficeId])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const params = new URLSearchParams()
      params.set("month", month)
      const res = await fetch(
        `/api/payroll/state/finalization-history?${params.toString()}`
      )
      const json = (await res.json().catch(() => null)) as
        | ApiEnvelope<{ records: FinalizationHistoryRecord[] }>
        | null
      if (json && json.success) setHistory(json.data.records)
      else setHistory([])
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [month])

  useEffect(() => {
    loadPayrolls()
    loadHistory()
  }, [loadPayrolls, loadHistory])

  const refresh = () => {
    setResultMessage("Action succeeded — refreshing.")
    loadPayrolls()
    loadHistory()
  }

  // Group rows by region (null region = "—")
  const perRegion = useMemo(() => {
    const byRegion = new Map<
      string,
      { regionId: string | null; regionName: string; counts: Record<string, number>; rows: PayrollRow[] }
    >()
    for (const r of rows) {
      const key = r.regionId ?? "__none__"
      if (!byRegion.has(key)) {
        const regionName =
          r.regionId
            ? regions.find((reg) => reg.id === r.regionId)?.name ?? r.regionId
            : "—"
        byRegion.set(key, {
          regionId: r.regionId,
          regionName,
          counts: {},
          rows: [],
        })
      }
      const entry = byRegion.get(key)!
      entry.counts[r.state] = (entry.counts[r.state] ?? 0) + 1
      entry.rows.push(r)
    }
    return Array.from(byRegion.values()).sort((a, b) =>
      a.regionName.localeCompare(b.regionName)
    )
  }, [rows, regions])

  const globalStateSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) counts[r.state] = (counts[r.state] ?? 0) + 1
    const total = rows.length
    const regionalLocked = counts.REGIONAL_LOCKED ?? 0
    const calculated = counts.CALCULATED ?? 0
    const globalFinalized = counts.GLOBAL_FINALIZED ?? 0
    const hold = counts.HOLD ?? 0
    const paid = counts.PAID ?? 0
    return { counts, total, regionalLocked, calculated, globalFinalized, hold, paid }
  }, [rows])

  const readyToFinalizeGlobally =
    globalStateSummary.regionalLocked > 0 &&
    globalStateSummary.calculated === 0

  return (
    <PayrollPageShell
      title="Payroll — Salary State"
      subtitle="Lock regions, globally finalize, and review state-change history."
    >
      <section className="ui-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">
              Month *
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
              Region
            </label>
            <select
              className="ui-select"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
            >
              <option value="">All regions</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
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
              <option value="">All offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <ActionButton variant="secondary" onClick={() => { loadPayrolls(); loadHistory(); }}>
            Refresh
          </ActionButton>
        </div>
        {rowsError && <InlineAlert type="error" message={rowsError} />}
        {resultMessage && <InlineAlert type="success" message={resultMessage} />}
      </section>

      {/* Section 1: Per-Region Status */}
      <section className="ui-card p-4 mt-6 space-y-3">
        <h3 className="text-base font-semibold">Per-Region Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Region</th>
                {KNOWN_STATES.map((s) => (
                  <th key={s} className="px-3 py-2 text-right text-xs">
                    {s}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total Net</th>
                <th className="px-3 py-2 text-right">Total Reserve</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr>
                  <td
                    colSpan={KNOWN_STATES.length + 4}
                    className="px-3 py-6 text-center text-[var(--text-muted)]"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!loadingRows && perRegion.length === 0 && (
                <tr>
                  <td
                    colSpan={KNOWN_STATES.length + 4}
                    className="px-3 py-6 text-center text-[var(--text-muted)]"
                  >
                    No payrolls for this month.
                  </td>
                </tr>
              )}
              {perRegion.map((group) => {
                const totalNet = group.rows.reduce(
                  (s, r) => s + asNumber(r.netSalary),
                  0
                )
                const totalReserve = group.rows.reduce(
                  (s, r) => s + asNumber(r.reserveAmount),
                  0
                )
                // Determine the dominant state for bulk actions: prefer
                // CALCULATED (can lock) or REGIONAL_LOCKED (can global-finalize
                // / unlock) when present.
                const dominantState = (() => {
                  if ((group.counts.CALCULATED ?? 0) > 0) return "CALCULATED"
                  if ((group.counts.REGIONAL_LOCKED ?? 0) > 0) return "REGIONAL_LOCKED"
                  if ((group.counts.GLOBAL_FINALIZED ?? 0) > 0) return "GLOBAL_FINALIZED"
                  return "DRAFT"
                })()
                return (
                  <tr
                    key={group.regionId ?? "__none__"}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="px-3 py-2 font-semibold">
                      {group.regionName}
                    </td>
                    {KNOWN_STATES.map((s) => (
                      <td key={s} className="px-3 py-2 text-right">
                        {group.counts[s] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      {totalNet.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {totalReserve.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {group.regionId ? (
                        <PayrollStateActions
                          state={dominantState}
                          scope={{
                            month,
                            regionId: group.regionId,
                            regionalOfficeId: regionalOfficeId || undefined,
                          }}
                          isSuperAdmin={isSuperAdmin}
                          onActionComplete={refresh}
                        />
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Global Finalization */}
      <section className="ui-card p-4 mt-6 space-y-3">
        <h3 className="text-base font-semibold">Global Finalization</h3>
        <div className="text-sm">
          {globalStateSummary.globalFinalized > 0 ? (
            <InlineAlert
              type="success"
              message={`${globalStateSummary.globalFinalized} payrolls are already GLOBAL_FINALIZED for ${month}.`}
            />
          ) : readyToFinalizeGlobally ? (
            <InlineAlert
              type="success"
              message={`All locked regions ready — ${globalStateSummary.regionalLocked} REGIONAL_LOCKED payrolls can be globally finalized.`}
            />
          ) : (
            <div className="text-[var(--text-muted)]">
              Locked: {globalStateSummary.regionalLocked} • Still CALCULATED:{" "}
              {globalStateSummary.calculated} • On Hold: {globalStateSummary.hold}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {isSuperAdmin && (
            <PayrollStateActions
              state={
                globalStateSummary.globalFinalized > 0
                  ? "GLOBAL_FINALIZED"
                  : "REGIONAL_LOCKED"
              }
              scope={{ month }}
              isSuperAdmin={isSuperAdmin}
              onActionComplete={refresh}
            />
          )}
          {!isSuperAdmin && (
            <div className="text-xs text-[var(--text-muted)]">
              Only SuperAdmin can globally finalize or unfreeze.
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Finalization History */}
      <section className="ui-card p-4 mt-6 space-y-3">
        <h3 className="text-base font-semibold">Finalization History</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Scope</th>
                <th className="px-3 py-2 text-left">Region</th>
                <th className="px-3 py-2 text-right">Payrolls</th>
                <th className="px-3 py-2 text-right">Total Net</th>
                <th className="px-3 py-2 text-right">Total Reserve</th>
                <th className="px-3 py-2 text-left">By</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loadingHistory && history.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No events for {month}.
                  </td>
                </tr>
              )}
              {history.map((h) => {
                const regionName = h.regionId
                  ? regions.find((r) => r.id === h.regionId)?.name ?? h.regionId
                  : h.scope === "GLOBAL"
                    ? "— (global)"
                    : "—"
                return (
                  <tr key={h.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-xs">
                      {new Date(h.finalizedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <PayrollStateBadge
                        state={
                          h.scope === "GLOBAL"
                            ? "GLOBAL_FINALIZED"
                            : "REGIONAL_LOCKED"
                        }
                      />
                    </td>
                    <td className="px-3 py-2">{regionName}</td>
                    <td className="px-3 py-2 text-right">{h.payrollCount}</td>
                    <td className="px-3 py-2 text-right">
                      {asNumber(h.totalNetPayable).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {asNumber(h.totalReserve).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{h.finalizedByName}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PayrollPageShell>
  )
}
