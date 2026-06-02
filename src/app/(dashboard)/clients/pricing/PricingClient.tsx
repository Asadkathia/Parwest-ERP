"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/shadcn/card"

type PricingRow = {
  id: string
  name: string
  type: string
  status: string
  contractCount: number
  branchContractCount: number
  clientLevelContractCount: number
  currentRates: {
    guardType: string
    exService: string | null
    rate: number
    extraHourRate: number | null
  }[]
}

export default function PricingClient() {
  const [rows, setRows] = useState<PricingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [guardTypeFilter, setGuardTypeFilter] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (status) params.set("status", status)
    if (guardTypeFilter) params.set("guardType", guardTypeFilter)
    try {
      const res = await fetch(`/api/clients/pricing-summary?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRows(await res.json())
    } catch (e) {
      setError((e as Error).message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search, status, guardTypeFilter])

  useEffect(() => {
    load()
  }, [load])

  const guardTypes = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => r.currentRates.forEach((rt) => set.add(rt.guardType)))
    return Array.from(set).sort()
  }, [rows])

  const summary = useMemo(() => {
    const clientsWithPricing = rows.filter((r) => r.contractCount > 0).length
    const totalContracts = rows.reduce((s, r) => s + r.contractCount, 0)
    const totalCurrentRates = rows.reduce((s, r) => s + r.currentRates.length, 0)
    return { clientsWithPricing, totalContracts, totalCurrentRates }
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Client Pricing</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cross-client view of active contracts and current rates. Edit pricing on the client profile.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="ui-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Clients with Pricing</div>
          <div className="text-2xl font-bold">
            {summary.clientsWithPricing}{" "}
            <span className="text-sm text-[var(--text-muted)]">/ {rows.length}</span>
          </div>
        </div>
        <div className="ui-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Active Contracts</div>
          <div className="text-2xl font-bold">{summary.totalContracts}</div>
        </div>
        <div className="ui-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Current Rates</div>
          <div className="text-2xl font-bold">{summary.totalCurrentRates}</div>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search client name…"
            className="ui-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="ui-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            className="ui-select"
            value={guardTypeFilter}
            onChange={(e) => setGuardTypeFilter(e.target.value)}
          >
            <option value="">All Guard Types</option>
            {guardTypes.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        </CardContent>
      </Card>

      {error && (
        <div className="ui-card p-4 text-sm text-red-500">Error loading pricing: {error}</div>
      )}

      <section className="ui-card overflow-x-auto p-0">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">
                Contracts
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">
                Current Rates
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No clients found.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[var(--surface-muted)]">
                <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      r.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.contractCount === 0 ? (
                    <span className="text-[var(--text-muted)]">None</span>
                  ) : (
                    <span>
                      {r.contractCount}{" "}
                      <span className="text-xs text-[var(--text-muted)]">
                        ({r.clientLevelContractCount} client / {r.branchContractCount} branch)
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.currentRates.length === 0 ? (
                    <span className="text-[var(--text-muted)]">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.currentRates.slice(0, 4).map((rt, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 bg-[var(--surface-muted)] rounded px-2 py-0.5 text-xs"
                          title={rt.exService ? `${rt.guardType} (${rt.exService})` : rt.guardType}
                        >
                          <span className="font-medium">{rt.guardType}</span>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span>PKR {rt.rate.toLocaleString()}</span>
                        </span>
                      ))}
                      {r.currentRates.length > 4 && (
                        <span className="text-xs text-[var(--text-muted)]">
                          +{r.currentRates.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={`/clients/${r.id}?tab=pricing`}
                    className="text-[var(--brand)] hover:underline font-medium"
                  >
                    {r.contractCount === 0 ? "Add Pricing" : "Manage"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
