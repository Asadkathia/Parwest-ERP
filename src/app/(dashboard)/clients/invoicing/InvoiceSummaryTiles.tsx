"use client"

import { useMemo } from "react"
import StatCard from "@/components/shadcn/parwest-stat-card"
import type { InvoiceRow } from "./types"

export default function InvoiceSummaryTiles({ rows }: { rows: InvoiceRow[] }) {
  const tiles = useMemo(() => {
    let outstanding = 0
    let overdue = 0
    let paidThisPeriod = 0
    let voided = 0
    const today = new Date()

    for (const r of rows) {
      const remaining = Math.max(0, (r.amount || 0) - (r.paidAmount || 0))
      if (r.status === "VOID") {
        voided += 1
        continue
      }
      paidThisPeriod += r.paidAmount || 0
      if (r.status !== "PAID") outstanding += remaining
      if (r.dueDate && new Date(r.dueDate) < today && r.status !== "PAID") {
        overdue += remaining
      }
    }

    return { outstanding, overdue, paidThisPeriod, count: rows.length, voided }
  }, [rows])

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Invoices" value={tiles.count} tone="brand" />
      <StatCard label="Outstanding" value={fmt(tiles.outstanding)} tone="warning" />
      <StatCard label="Overdue" value={fmt(tiles.overdue)} tone="danger" />
      <StatCard label="Paid (period)" value={fmt(tiles.paidThisPeriod)} tone="success" />
    </div>
  )
}
