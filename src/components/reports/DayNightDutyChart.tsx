"use client"

/**
 * Day & Night Duty report — duty-type breakdown by regional office.
 *
 * Sub-report : `/reports/day-night-duty` (binding: `day-night-duty`).
 * Data shape : Array of deployment rows from
 *              `/api/reports/guards/day-night-duty`, each carrying
 *              `dutyType: "DAY" | "NIGHT" | "BOTH"` and `regionalOffice`.
 * Chart      : Recharts stacked `BarChart` — duty counts per regional office.
 * Colors     : `--chart-1` (Day · cobalt), `--chart-2` (Night · emerald),
 *              `--chart-3` (Both · amber). Sourced from the v1.0 viz palette
 *              via `src/styles/tokens-v1.1.css`. NEVER hardcode hex.
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

type DutyRow = {
  dutyType?: string
  regionalOffice?: string
  client?: string
}

type Props = {
  rows: Array<Record<string, unknown>>
  /** Cap to top N regional offices by total duties for legibility. */
  limit?: number
}

type ChartDatum = {
  office: string
  day: number
  night: number
  both: number
}

function toDataset(rows: Props["rows"], limit: number): ChartDatum[] {
  const buckets = new Map<string, ChartDatum>()
  for (const raw of rows) {
    const r = raw as DutyRow
    const office = String(r.regionalOffice || r.client || "—") || "—"
    const duty = String(r.dutyType ?? "").toUpperCase()
    const existing = buckets.get(office) || { office, day: 0, night: 0, both: 0 }
    if (duty === "DAY") existing.day += 1
    else if (duty === "NIGHT") existing.night += 1
    else if (duty === "BOTH") existing.both += 1
    buckets.set(office, existing)
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.day + b.night + b.both - (a.day + a.night + a.both))
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

export default function DayNightDutyChart({ rows, limit = 10 }: Props) {
  const data = toDataset(rows, limit)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Day vs. Night duties by regional office</CardTitle>
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
        <CardTitle className="text-sm font-semibold">Day vs. Night duties by regional office</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="office"
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
            <Bar dataKey="day" name="Day" stackId="duty" fill="var(--chart-1)" />
            <Bar dataKey="night" name="Night" stackId="duty" fill="var(--chart-2)" />
            <Bar dataKey="both" name="Both" stackId="duty" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
