"use client"
import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts"

interface DashboardData {
  deployTrend: Array<{ day: string; count: number }>
  salaryMoM: Array<{ month: string; total: number }>
  inventoryByStatus: Array<{ status: string; count: number }>
}

const PIE_COLORS = [
  "var(--brand-600)",
  "var(--accent-500)",
  "var(--success-500)",
]

function formatPKRShort(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export function DashboardCharts() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    let mounted = true
    fetch("/api/reports/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return
        const raw = d.data
        if (!raw) return
        setData({
          deployTrend: (raw.deployTrend ?? []).map(
            (p: { day: string; count: number }) => ({
              day: new Date(p.day).toISOString().slice(5, 10),
              count: p.count,
            })
          ),
          salaryMoM: (raw.salaryMoM ?? []).map(
            (p: { month: string; total: number }) => ({
              month: new Date(p.month).toISOString().slice(0, 7),
              total: p.total,
            })
          ),
          inventoryByStatus: raw.inventoryByStatus ?? [],
        })
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Deployments — last 30 days</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer>
            <LineChart
              data={data?.deployTrend ?? []}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Salary cost — last 6 months</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart
              data={data?.salaryMoM ?? []}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatPKRShort} />
              <Tooltip
                formatter={(v) =>
                  `PKR ${typeof v === "number" ? v.toLocaleString() : String(v)}`
                }
              />
              <Bar dataKey="total" fill="var(--brand-600)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Inventory by status</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data?.inventoryByStatus ?? []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {(data?.inventoryByStatus ?? []).map((_, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
