"use client"

import { useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"
import { mockClientsList, mockDeploymentsList, mockGuardsList } from "@/lib/mockData"

type PromptReportResponse = {
  narrative: string
  kpis: { label: string; value: string }[]
  rows: { label: string; value: string }[]
}

function inferResponse(prompt: string): PromptReportResponse {
  const text = prompt.toLowerCase()

  if (text.includes("attendance")) {
    return {
      narrative: "Attendance coverage is stable with a small no-record segment requiring follow-up.",
      kpis: [
        { label: "Guards", value: String(mockGuardsList.length) },
        { label: "Expected Present", value: String(Math.max(mockGuardsList.length - 1, 0)) },
        { label: "Missing", value: "1" },
      ],
      rows: mockGuardsList.slice(0, 5).map((guard) => ({ label: guard.name, value: guard.status })),
    }
  }

  if (text.includes("branch") || text.includes("client")) {
    return {
      narrative: "Client/branch footprint remains concentrated in banking clients with active deployment demand.",
      kpis: [
        { label: "Clients", value: String(mockClientsList.length) },
        { label: "Deployments", value: String(mockDeploymentsList.length) },
        { label: "Active", value: String(mockDeploymentsList.filter((d) => d.status === "ACTIVE").length) },
      ],
      rows: mockClientsList.map((client) => ({ label: client.name, value: `${client.branchCount} branches` })),
    }
  }

  return {
    narrative: "Operational snapshot generated. Use specific prompts for attendance, branch, client, or deployment insights.",
    kpis: [
      { label: "Total Guards", value: String(mockGuardsList.length) },
      { label: "Total Clients", value: String(mockClientsList.length) },
      { label: "Total Deployments", value: String(mockDeploymentsList.length) },
    ],
    rows: [
      { label: "Top client", value: mockClientsList[0]?.name || "—" },
      { label: "Top branch", value: mockDeploymentsList[0]?.branchId || "—" },
      { label: "Inactive guards", value: String(mockGuardsList.filter((g) => g.status !== "ACTIVE").length) },
    ],
  }
}

export default function PromptReportPanel() {
  const [prompt, setPrompt] = useState("Give me a dashboard summary")
  const [submittedPrompt, setSubmittedPrompt] = useState("Give me a dashboard summary")

  const data = useMemo(() => inferResponse(submittedPrompt), [submittedPrompt])

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[280px]">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Prompt Based Reporting</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="ui-textarea"
            rows={3}
            placeholder="Ask for attendance gaps, client trends, or deployment summary"
          />
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={() => setSubmittedPrompt(prompt)}>Generate</ActionButton>
          <ActionButton variant="secondary" onClick={() => setPrompt("Show attendance gaps for this week")}>Preset</ActionButton>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text)]">
        <p className="font-medium">Narrative</p>
        <p className="mt-1 text-[var(--text-muted)]">{data.narrative}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {data.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{kpi.label}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
        <table className="w-full min-w-[520px]">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Metric</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-[var(--text-muted)]">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.label} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 text-sm text-[var(--text)]">{row.label}</td>
                <td className="px-4 py-2 text-sm text-[var(--text-muted)]">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
