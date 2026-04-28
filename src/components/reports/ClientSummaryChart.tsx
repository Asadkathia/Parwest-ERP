"use client"

/**
 * Canonical Parwest x Recharts migration template (Phase 6C).
 *
 * Use this file as the reference when migrating other charts in the ERP.
 *
 *   1. Wrap the chart in `<ResponsiveContainer width="100%" height={300}>`.
 *   2. Source series colours from `var(--chart-1)` ... `var(--chart-5)`
 *      (defined in `src/styles/tokens-v1.1.css`). NEVER hardcode hex values
 *      so the colourblind-safe v1.0 viz palette stays the single source of
 *      truth and dark-mode swaps stay automatic.
 *   3. Use a custom `<Tooltip>` content that renders shadcn surface tokens:
 *      `bg-popover text-popover-foreground border rounded-md shadow-sm p-2`.
 *   4. `<Legend iconType="square" />` with small text to match shadcn density.
 *   5. Apply `tabular-nums` (className) to axis labels so numeric ticks align.
 *   6. Keep the chart `"use client"` — Recharts uses `ResizeObserver` and
 *      will warn during SSR; rendering on the client side avoids hydration
 *      mismatches in App Router.
 *
 * For new charts: copy the structure of `ClientSummaryChart`, swap the
 * series fields, and bump `--chart-N` indices as needed (palette has 8
 * colours: cobalt, emerald, amber, red, indigo, cyan, violet, orange).
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

type ClientSummaryRow = {
  clientName?: string
  dayDeployments?: number
  nightDeployments?: number
}

type Props = {
  rows: Array<Record<string, unknown>>
  /** Cap the chart to the top N clients by total deployments for legibility. */
  limit?: number
}

type ChartDatum = {
  client: string
  day: number
  night: number
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
  const mapped: ChartDatum[] = rows.map((row) => {
    const r = row as ClientSummaryRow
    return {
      client: String(r.clientName ?? "—"),
      day: toNumber(r.dayDeployments),
      night: toNumber(r.nightDeployments),
    }
  })

  return mapped
    .sort((a, b) => b.day + b.night - (a.day + a.night))
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

export default function ClientSummaryChart({ rows, limit = 10 }: Props) {
  const data = toDataset(rows, limit)

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          Day vs. Night deployments by client
        </CardTitle>
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
            <Bar dataKey="day" name="Day" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="night" name="Night" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
