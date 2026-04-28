"use client"

/**
 * Guard Deployment report — shift-type distribution (DAY / NIGHT / BOTH).
 *
 * Sub-report : `/reports/guard-deployment` (binding: `guard-deployment`).
 * Data shape : Array of deployment rows from `/api/reports/guards/deployment`,
 *              each carrying `shiftType: "DAY" | "NIGHT" | "BOTH"`.
 * Chart      : Recharts `PieChart` — distribution of deployments by shift.
 * Colors     : `--chart-1` (Day · cobalt), `--chart-2` (Night · emerald),
 *              `--chart-3` (Both · amber). Sourced from the v1.0 viz palette
 *              via `src/styles/tokens-v1.1.css`. NEVER hardcode hex.
 * Tooltip    : shadcn surface tokens —
 *              `bg-popover text-popover-foreground border rounded-md shadow-sm p-2`.
 * SSR        : `'use client'` because Recharts uses ResizeObserver.
 */

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"

type DeploymentRow = {
  shiftType?: string
}

type Props = {
  rows: Array<Record<string, unknown>>
}

type ChartDatum = {
  name: string
  value: number
  colorVar: string
}

const SHIFT_BUCKETS: Array<{ key: "DAY" | "NIGHT" | "BOTH"; label: string; colorVar: string }> = [
  { key: "DAY", label: "Day", colorVar: "var(--chart-1)" },
  { key: "NIGHT", label: "Night", colorVar: "var(--chart-2)" },
  { key: "BOTH", label: "Both", colorVar: "var(--chart-3)" },
]

function toDataset(rows: Props["rows"]): ChartDatum[] {
  const counts: Record<string, number> = { DAY: 0, NIGHT: 0, BOTH: 0 }
  for (const raw of rows) {
    const r = raw as DeploymentRow
    const shift = String(r.shiftType ?? "").toUpperCase()
    if (shift in counts) counts[shift] += 1
  }
  return SHIFT_BUCKETS.map((bucket) => ({
    name: bucket.label,
    value: counts[bucket.key] || 0,
    colorVar: bucket.colorVar,
  })).filter((datum) => datum.value > 0)
}

type TooltipPayload = {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: ChartDatum }>
}

function ChartTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover text-popover-foreground border rounded-md shadow-sm p-2 text-xs">
      <ul className="space-y-0.5">
        {payload.map((entry, idx) => (
          <li key={idx} className="flex items-center gap-2 tabular-nums">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: entry.payload?.colorVar }}
            />
            <span>{entry.name}</span>
            <span className="ml-auto font-medium">{entry.value ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function GuardDeploymentChart({ rows }: Props) {
  const data = toDataset(rows)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Deployments by shift</CardTitle>
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
        <CardTitle className="text-sm font-semibold">Deployments by shift</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={100}
              paddingAngle={2}
            >
              {data.map((datum, idx) => (
                <Cell key={idx} fill={datum.colorVar} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
