"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import StatusChip from "@/components/ui/status-chip"
import type { GeneratedReport, ReportTemplate } from "@/lib/reports/system-report-types"

type Props = {
  templates: ReportTemplate[]
  generated: GeneratedReport[]
}

export default function SystemReportList({ templates, generated }: Props) {
  const [templateState, setTemplateState] = useState(templates)
  const [generatedState, setGeneratedState] = useState(generated)
  const [search, setSearch] = useState("")

  const estimateRowCount = (templateId: string) => {
    const existing = generatedState.find((item) => item.templateId === templateId)
    if (existing) return existing.rowCount
    const defaults: Record<string, number> = {
      "rpt-1": 120,
      "rpt-2": 80,
      "rpt-3": 40,
      "rpt-4": 25,
      "rpt-5": 30,
    }
    return defaults[templateId] || 20
  }

  const runNow = (templateId: string) => {
    setTemplateState((prev) => prev.map((item) => (item.id === templateId ? { ...item, status: "RUNNING" } : item)))

    window.setTimeout(() => {
      const template = templateState.find((item) => item.id === templateId)
      const rowCount = estimateRowCount(templateId)
      const timestamp = new Date().toISOString()

      setTemplateState((prev) =>
        prev.map((item) =>
          item.id === templateId ? { ...item, status: "READY", lastGeneratedAt: timestamp } : item
        )
      )

      setGeneratedState((prev) => [
        {
          id: `gen-${crypto.randomUUID()}`,
          templateId,
          templateName: template?.name || "Generated report",
          generatedAt: timestamp,
          status: "READY",
          rowCount,
        },
        ...prev,
      ])
    }, 900)
  }

  const filteredGenerated = useMemo(() => {
    if (!search.trim()) return generatedState
    const q = search.toLowerCase()
    return generatedState.filter((item) => item.templateName.toLowerCase().includes(q) || item.status.toLowerCase().includes(q))
  }, [generatedState, search])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templateState.map((template) => (
          <article key={template.id} className="ui-card p-4">
            <p className="text-sm font-semibold text-[var(--text)]">{template.name}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{template.frequency} • Owner: {template.owner}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Last generated: {new Date(template.lastGeneratedAt).toLocaleString("en-US")}</p>
            <div className="mt-3 flex items-center justify-between">
              <StatusChip label={template.status} variant={template.status === "FAILED" ? "danger" : template.status === "RUNNING" ? "warning" : "success"} />
              <ActionButton className="px-2.5 py-1.5 text-xs" onClick={() => runNow(template.id)}>Run now</ActionButton>
            </div>
          </article>
        ))}
      </div>

      <section className="ui-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">Recent Generated Outputs</h3>
          <input className="ui-input max-w-xs" placeholder="Filter generated reports" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Report</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Generated At</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Rows</th>
                <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredGenerated.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 text-sm text-[var(--text)]">{item.templateName}</td>
                  <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{new Date(item.generatedAt).toLocaleString("en-US")}</td>
                  <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{item.rowCount}</td>
                  <td className="px-4 py-2 text-sm">
                    <StatusChip label={item.status} variant={item.status === "FAILED" ? "danger" : item.status === "RUNNING" ? "warning" : "success"} />
                  </td>
                </tr>
              ))}
              {filteredGenerated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No generated reports found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
