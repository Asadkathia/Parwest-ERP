import { registerInsight } from "@/lib/insights/registry"
import { clientScopeWhere } from "@/lib/clients/access"

registerInsight({
  key: "dso-trend",
  title: "A5 — DSO trend",
  description:
    "Average Days Sales Outstanding (paid date minus due date) for recently paid invoices, with delta vs prior window.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    windowDays: 90,
    warnDays: 14,
  },
  thresholdDocs: {
    windowDays: "Window (in days) of paid invoices averaged for DSO.",
    warnDays: "A paid invoice with DSO greater than this many days is counted as overdue-paid.",
  },
  compute: async (ctx) => {
    const windowDays = Number(ctx.thresholds.windowDays ?? 90)
    const warnDays = Number(ctx.thresholds.warnDays ?? 14)
    const day = 24 * 60 * 60 * 1000
    const currStart = new Date(ctx.now.getTime() - windowDays * day)
    const prevStart = new Date(ctx.now.getTime() - 2 * windowDays * day)

    // Branch-aware: branchful clients are region-less, so scope invoices via the
    // client's branches (clientScopeWhere), not the now-null Client.regionId. (region-less)
    const clientWhere = clientScopeWhere(ctx.scope)

    const invoices = await ctx.prisma.invoice.findMany({
      where: {
        paidAt: { gte: prevStart, lte: ctx.now },
        dueDate: { not: null },
        ...(Object.keys(clientWhere).length > 0 ? { client: clientWhere } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        paidAt: true,
        dueDate: true,
        client: { select: { name: true } },
      },
    })

    type Row = {
      id: string
      invoiceNumber: string
      clientName: string
      paidAt: Date
      dso: number
    }
    const rows: Row[] = []
    for (const inv of invoices) {
      if (!inv.paidAt || !inv.dueDate) continue
      const dso = Math.round((inv.paidAt.getTime() - inv.dueDate.getTime()) / day)
      rows.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client?.name ?? "Unknown",
        paidAt: inv.paidAt,
        dso,
      })
    }

    if (rows.length === 0) return { count: 0, summary: "No issues" }

    const current = rows.filter((r) => r.paidAt >= currStart)
    const prior = rows.filter((r) => r.paidAt < currStart)

    const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
    const currMean = mean(current.map((r) => r.dso))
    const priorMean = mean(prior.map((r) => r.dso))
    const delta = currMean - priorMean

    const overdue = current.filter((r) => r.dso > warnDays)
    const count = overdue.length

    if (count === 0) {
      return {
        count: 0,
        summary: `Mean DSO ${currMean.toFixed(1)}d over ${current.length} invoices — within target`,
      }
    }

    overdue.sort((a, b) => b.dso - a.dso)
    const items = overdue.slice(0, 5).map((r) => ({
      id: r.id,
      label: `${r.clientName} — ${r.invoiceNumber}`,
      sub: `DSO ${r.dso}d`,
      href: `/clients/invoicing`,
    }))

    const deltaStr =
      prior.length > 0
        ? ` (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}d vs prior ${windowDays}d)`
        : ""

    return {
      count,
      summary: `Mean DSO ${currMean.toFixed(1)}d${deltaStr}; ${count} invoice${count === 1 ? "" : "s"} > ${warnDays}d`,
      drillUrl: "/clients/invoicing",
      items,
    }
  },
})
