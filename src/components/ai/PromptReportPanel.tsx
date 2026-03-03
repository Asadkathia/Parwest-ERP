"use client"

import { useEffect, useMemo, useState } from "react"
import ActionButton from "@/components/ui/action-button"

type PromptReportResponse = {
  narrative: string
  kpis: { label: string; value: string }[]
  rows: { label: string; value: string }[]
}

type Snapshot = {
  guardsTotal: number
  inactiveGuards: number
  clientsTotal: number
  deploymentsTotal: number
  activeDeployments: number
  guardRows: Array<{ label: string; value: string }>
  clientRows: Array<{ label: string; value: string }>
  topClient: string
  topBranch: string
}

const EMPTY_SNAPSHOT: Snapshot = {
  guardsTotal: 0,
  inactiveGuards: 0,
  clientsTotal: 0,
  deploymentsTotal: 0,
  activeDeployments: 0,
  guardRows: [],
  clientRows: [],
  topClient: "—",
  topBranch: "—",
}

function inferResponse(prompt: string, snapshot: Snapshot): PromptReportResponse {
  const text = prompt.toLowerCase()

  if (text.includes("attendance")) {
    return {
      narrative: "Attendance coverage is stable with a small no-record segment requiring follow-up.",
      kpis: [
        { label: "Guards", value: String(snapshot.guardsTotal) },
        { label: "Expected Present", value: String(Math.max(snapshot.guardsTotal - snapshot.inactiveGuards, 0)) },
        { label: "Missing", value: String(snapshot.inactiveGuards) },
      ],
      rows: snapshot.guardRows.length > 0 ? snapshot.guardRows : [{ label: "No guard records", value: "—" }],
    }
  }

  if (text.includes("branch") || text.includes("client")) {
    return {
      narrative: "Client/branch footprint remains concentrated in banking clients with active deployment demand.",
      kpis: [
        { label: "Clients", value: String(snapshot.clientsTotal) },
        { label: "Deployments", value: String(snapshot.deploymentsTotal) },
        { label: "Active", value: String(snapshot.activeDeployments) },
      ],
      rows: snapshot.clientRows.length > 0 ? snapshot.clientRows : [{ label: "No client records", value: "—" }],
    }
  }

  return {
    narrative: "Operational snapshot generated. Use specific prompts for attendance, branch, client, or deployment insights.",
    kpis: [
      { label: "Total Guards", value: String(snapshot.guardsTotal) },
      { label: "Total Clients", value: String(snapshot.clientsTotal) },
      { label: "Total Deployments", value: String(snapshot.deploymentsTotal) },
    ],
    rows: [
      { label: "Top client", value: snapshot.topClient },
      { label: "Top branch", value: snapshot.topBranch },
      { label: "Inactive guards", value: String(snapshot.inactiveGuards) },
    ],
  }
}

export default function PromptReportPanel() {
  const [prompt, setPrompt] = useState("Give me a dashboard summary")
  const [submittedPrompt, setSubmittedPrompt] = useState("Give me a dashboard summary")
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoadError("")
        const [guardsResp, clientsResp, deploymentsResp] = await Promise.all([
          fetch("/api/guards", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
          fetch("/api/deployments", { cache: "no-store" }),
        ])

        if (!guardsResp.ok || !clientsResp.ok || !deploymentsResp.ok) {
          throw new Error("Unable to load dashboard snapshot right now.")
        }

        const guards = (await guardsResp.json()) as Array<{ name?: string; status?: string }>
        const clients = (await clientsResp.json()) as Array<{ name?: string; branchCount?: number }>
        const deployments = (await deploymentsResp.json()) as Array<{ status?: string; branchId?: string | null }>

        const next: Snapshot = {
          guardsTotal: guards.length,
          inactiveGuards: guards.filter((guard) => String(guard.status || "").toUpperCase() !== "ACTIVE").length,
          clientsTotal: clients.length,
          deploymentsTotal: deployments.length,
          activeDeployments: deployments.filter((deployment) => String(deployment.status || "").toUpperCase() === "ACTIVE").length,
          guardRows: guards.slice(0, 5).map((guard, index) => ({
            label: guard.name || `Guard ${index + 1}`,
            value: guard.status || "UNKNOWN",
          })),
          clientRows: clients.slice(0, 5).map((client, index) => ({
            label: client.name || `Client ${index + 1}`,
            value: `${Number(client.branchCount || 0)} branches`,
          })),
          topClient: clients[0]?.name || "—",
          topBranch: deployments.find((deployment) => deployment.branchId)?.branchId || "—",
        }

        if (active) setSnapshot(next)
      } catch (error: unknown) {
        if (!active) return
        setSnapshot(EMPTY_SNAPSHOT)
        setLoadError(error instanceof Error ? error.message : "Unable to load dashboard snapshot right now.")
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const data = useMemo(() => inferResponse(submittedPrompt, snapshot), [submittedPrompt, snapshot])

  return (
    <section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
      {loadError ? (
        <div className="rounded-[var(--radius-md)] border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          {loadError}
        </div>
      ) : null}
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
