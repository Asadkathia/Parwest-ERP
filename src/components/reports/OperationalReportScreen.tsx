"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ScreenConfig } from "@/lib/parity/screenConfigs"
import type { ApiEnvelope } from "@/lib/api/response"
import SectionTitle from "@/components/ui/section-title"
import ActionButton from "@/components/ui/action-button"
import InlineAlert from "@/components/ui/inline-alert"

import { REPORT_BINDINGS } from "@/lib/reports/bindings"
import ClientSummaryChart from "@/components/reports/ClientSummaryChart"
import GuardDeploymentChart from "@/components/reports/GuardDeploymentChart"
import DayNightDutyChart from "@/components/reports/DayNightDutyChart"
import ClientEnrolledChart from "@/components/reports/ClientEnrolledChart"
import InventoryStoreSummaryChart from "@/components/reports/InventoryStoreSummaryChart"
import { PermissionGate } from "@/components/shadcn/permission-gate"

type Props = {
  screen: string
  config: ScreenConfig
  links: Array<{ label: string; href: string }>
}

function toQuery(filters: Record<string, string>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) query.set(key, value.trim())
  }
  return query
}

export default function OperationalReportScreen({ screen, config, links }: Props) {
  const binding = REPORT_BINDINGS[screen]

  const [filters, setFilters] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const tableColumns = useMemo(() => {
    if (config.table?.columns?.length) return config.table.columns
    const first = rows[0]
    return first ? Object.keys(first) : []
  }, [config.table?.columns, rows])

  const loadReport = async () => {
    setLoading(true)
    setNotice(null)

    try {
      const query = toQuery(filters)
      const response = await fetch(`${binding.endpoint}?${query.toString()}`)
      const payload = (await response.json()) as ApiEnvelope<{
        summary?: Record<string, unknown>
        rows?: Array<Record<string, unknown>>
      }>

      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Failed to load report." : payload.message)
      }

      const data = payload.data || {}
      setSummary(data.summary || null)
      setRows(Array.isArray(data.rows) ? data.rows : [])
      setNotice({ type: "success", message: "Report generated from live API." })
    } catch (error) {
      setSummary(null)
      setRows([])
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to generate report.",
      })
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = async () => {
    setLoading(true)
    setNotice(null)

    try {
      const query = toQuery(filters)
      query.set("format", "csv")
      const response = await fetch(`${binding.endpoint}?${query.toString()}`)
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiEnvelope | null
        throw new Error(payload && !payload.success ? payload.message : "Failed to export CSV.")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${screen}-report.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      setNotice({ type: "success", message: "CSV export downloaded." })
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to export CSV.",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({})
    setRows([])
    setSummary(null)
    setNotice({ type: "success", message: "Filters reset." })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionTitle title={config.title} subtitle={config.description || "Live operational reporting endpoint."} />
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2 justify-end">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="ui-btn ui-btn-secondary">
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {notice ? <InlineAlert type={notice.type} message={notice.message} /> : null}

      <section className="ui-card p-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Filters</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {binding.fields.map((field) => (
            <label key={field.key} className="space-y-1 text-sm text-[var(--text-muted)]">
              <span>{field.label}</span>
              {field.options ? (
                <select
                  className="ui-select"
                  value={filters[field.key] || ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">All</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="ui-input"
                  type={field.type || "text"}
                  value={filters[field.key] || ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <ActionButton type="button" variant="secondary" onClick={resetFilters} disabled={loading}>
            Reset
          </ActionButton>
          <PermissionGate module="REPORTS" action="VIEW" mode="disable">
            <ActionButton type="button" variant="secondary" onClick={exportCsv} disabled={loading}>
              Export CSV
            </ActionButton>
          </PermissionGate>
          <ActionButton type="button" onClick={loadReport} disabled={loading}>
            {loading ? "Loading..." : "Generate Report"}
          </ActionButton>
        </div>
      </section>

      {summary ? (
        <section className="ui-card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Summary</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{key}</p>
                <p className="text-base font-semibold text-[var(--text)]">{String(value)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {screen === "client-summary" && rows.length > 0 ? (
        <ClientSummaryChart rows={rows} />
      ) : null}

      {(screen === "guard-deployment" || screen === "guardDeploymentreports") && rows.length > 0 ? (
        <GuardDeploymentChart rows={rows} />
      ) : null}

      {(screen === "day-night-duty" || screen === "dayNightDutyGuards") && rows.length > 0 ? (
        <DayNightDutyChart rows={rows} />
      ) : null}

      {(screen === "client-enrolled" || screen === "clientEnrolledreports") && rows.length > 0 ? (
        <ClientEnrolledChart rows={rows} />
      ) : null}

      {screen === "inventory-store-summary" && rows.length > 0 ? (
        <InventoryStoreSummaryChart rows={rows} />
      ) : null}

      <section className="ui-card overflow-x-auto">
        <table className="w-full min-w-[880px]">
          <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
            <tr>
              {tableColumns.map((column) => (
                <th key={column} className="px-4 py-3 text-left text-xs uppercase text-[var(--text-muted)]">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(tableColumns.length, 1)} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  No report rows yet. Apply filters and click Generate Report.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="hover:bg-[var(--surface-muted)]">
                  {tableColumns.map((column) => {
                    const key = Object.keys(row).find((candidate) => candidate.toLowerCase() === column.toLowerCase()) || column
                    return (
                      <td key={column} className="px-4 py-3 text-sm text-[var(--text)]">
                        {String(row[key] ?? "")}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
