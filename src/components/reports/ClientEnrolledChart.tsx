"use client"

/**
 * Client Enrolled report — branches and active deployments per client.
 *
 * Sub-report : `/reports/client-enrolled` (binding: `client-enrolled`).
 * Data shape : Array of client rows from `/api/reports/clients/enrolled`,
 *              each carrying `clientName`, `branchCount`, `activeDeployments`.
 * Chart      : Recharts grouped `BarChart` — branches vs active deployments.
 * Colors     : `--chart-1` (Branches · cobalt), `--chart-2` (Active
 *              deployments · emerald). Sourced from the v1.0 viz palette via
 *              `src/styles/tokens-v1.1.css`. NEVER hardcode hex.
 * Tooltip    : shadcn surface tokens —
 *              `bg-popover text-popover-foreground border rounded-md shadow-sm p-2`.
 * SSR        : `'use client'` because Recharts uses ResizeObserver.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"

type EnrolledRow = {
  clientName?: string
  branchCount?: number
  activeDeployments?: number
}

type Props = {
  rows: Array<Record<string, unknown>>
  /** Cap chart to the top N clients by deployments + branches. */
  limit?: number
}

type ChartDatum = {
  client: string
  branches: number
  deployments: number
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toDataset(rows: Props["rows"], limit: number): ChartDatum[] {
  return rows
    .map((row) => {
      const r = row as EnrolledRow
      return {
        client: String(r.clientName ?? "—"),
        branches: toNumber(r.branchCount),
        deployments: toNumber(r.activeDeployments),
      }
    })
    .sort((a, b) => b.branches + b.deployments - (a.branches + a.deployments))
    .slice(0, limit)
}

type TooltipPayload = {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover text-popover-foreground border rounded-md shadow-sm p-2 text-xs">
      <p className="font-medium mb-1">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((entry, idx) => (
          <li key={idx} className="flex items-center gap-2 tabular-nums">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="capitalize">{entry.name}</span>
            <span className="ml-auto font-medium">{entry.value ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ClientEnrolledChart({ rows, limit = 10 }: Props) {
  const data = toDataset(rows, limit)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Branches vs. active deployments by client</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data for selected period</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Branches vs. active deployments by client</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="client"
              tick={{ fontSize: 11 }}
              className="tabular-nums"
              interval={0}
              angle={-20}
              textAnchor="end"
              height={56}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              className="tabular-nums"
              width={32}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-muted)" }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="branches" name="Branches" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="deployments" name="Deployments" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
