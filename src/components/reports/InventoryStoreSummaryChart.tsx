"use client"

/**
 * Inventory Store Summary report — top products by inventory value.
 *
 * Sub-report : `/reports/inventory-store-summary` (binding:
 *              `inventory-store-summary`).
 * Data shape : Array of balance rows from
 *              `/api/reports/inventory/store-summary`, each carrying
 *              `productName`, `quantityOnHand`, `inventoryValue`.
 * Chart      : Recharts `BarChart` — top N products by inventory value.
 * Colors     : `--chart-3` (Inventory value · amber), `--chart-5`
 *              (Quantity on hand · indigo). Sourced from the v1.0 viz
 *              palette via `src/styles/tokens-v1.1.css`. NEVER hardcode hex.
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

type InventoryRow = {
  productName?: string
  sku?: string
  quantityOnHand?: number
  inventoryValue?: number
}

type Props = {
  rows: Array<Record<string, unknown>>
  /** Cap to the top N products by inventory value. */
  limit?: number
}

type ChartDatum = {
  product: string
  onHand: number
  value: number
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
  // Aggregate by product name across stores so a single product summed across
  // multiple stores is represented as one bar.
  const buckets = new Map<string, ChartDatum>()
  for (const raw of rows) {
    const r = raw as InventoryRow
    const product = String(r.productName || r.sku || "—") || "—"
    const existing = buckets.get(product) || { product, onHand: 0, value: 0 }
    existing.onHand += toNumber(r.quantityOnHand)
    existing.value += toNumber(r.inventoryValue)
    buckets.set(product, existing)
  }
  return Array.from(buckets.values())
    .sort((a, b) => b.value - a.value)
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

export default function InventoryStoreSummaryChart({ rows, limit = 10 }: Props) {
  const data = toDataset(rows, limit)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Top products by inventory value</CardTitle>
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
        <CardTitle className="text-sm font-semibold">Top products by inventory value</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="product"
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
              width={48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-muted)" }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="value" name="Inventory value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="onHand" name="On hand" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
