"use client"
import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card"

interface Kpis {
  totalGuards: number
  deployedGuards: number
  availableGuards: number
  totalClients: number
  activeBranches: number
  guardlessBranches: number
  pendingVerifications: number
  expiringDocs: number
}

const LABELS: Record<keyof Kpis, string> = {
  totalGuards: "Total Guards",
  deployedGuards: "Deployed",
  availableGuards: "Available",
  totalClients: "Total Clients",
  activeBranches: "Active Branches",
  guardlessBranches: "Guardless Branches",
  pendingVerifications: "Pending Verifications",
  expiringDocs: "Expiring Docs (30d)",
}

export function DashboardKpis() {
  const [kpis, setKpis] = useState<Kpis | null>(null)

  useEffect(() => {
    let mounted = true
    fetch("/api/reports/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setKpis(d.data?.kpis ?? null)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  if (!kpis) {
    return <div className="text-sm text-muted-foreground">Loading KPIs…</div>
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {(Object.keys(LABELS) as (keyof Kpis)[]).map((key) => (
        <Card key={key}>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              {LABELS[key]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {kpis[key].toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
