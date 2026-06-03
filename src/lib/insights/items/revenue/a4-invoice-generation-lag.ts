import { registerInsight } from "@/lib/insights/registry"
import { clientScopeWhere } from "@/lib/clients/access"

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

registerInsight({
  key: "invoice-generation-lag",
  title: "A4 — Invoice generation lag",
  description:
    "Mean days between the end of the invoiced month and invoice creation. Flags invoices generated late.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    windowDays: 60,
    warnDays: 7,
  },
  thresholdDocs: {
    windowDays: "Only invoices created within this many days are considered.",
    warnDays: "Invoices lagging more than this many days past month-end are counted.",
  },
  compute: async (ctx) => {
    const windowDays = Number(ctx.thresholds.windowDays ?? 60)
    const warnDays = Number(ctx.thresholds.warnDays ?? 7)
    const from = new Date(ctx.now.getTime() - windowDays * 24 * 60 * 60 * 1000)

    // Branch-aware: branchful clients are region-less, so scope invoices via the
    // client's branches (clientScopeWhere), not the now-null Client.regionId. (region-less)
    const clientWhere = clientScopeWhere(ctx.scope)

    const invoices = await ctx.prisma.invoice.findMany({
      where: {
        createdAt: { gte: from },
        ...(Object.keys(clientWhere).length > 0 ? { client: clientWhere } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        month: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    })

    if (invoices.length === 0) return { count: 0, summary: "No issues" }

    type Row = {
      id: string
      invoiceNumber: string
      clientId: string
      clientName: string
      lagDays: number
    }
    const rows: Row[] = invoices.map((inv) => {
      const eom = endOfMonth(inv.month)
      const lagMs = Math.max(0, inv.createdAt.getTime() - eom.getTime())
      const lagDays = Math.floor(lagMs / (24 * 60 * 60 * 1000))
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.client?.id ?? "",
        clientName: inv.client?.name ?? "Unknown",
        lagDays,
      }
    })

    const meanLag = rows.reduce((s, r) => s + r.lagDays, 0) / rows.length
    const laggers = rows.filter((r) => r.lagDays > warnDays)
    const count = laggers.length

    if (count === 0) {
      return {
        count: 0,
        summary: `Mean lag ${meanLag.toFixed(1)}d over ${rows.length} invoices — within target`,
      }
    }

    laggers.sort((a, b) => b.lagDays - a.lagDays)
    const items = laggers.slice(0, 5).map((r) => ({
      id: r.id,
      label: `${r.clientName} — ${r.invoiceNumber}`,
      sub: `${r.lagDays} days after month-end`,
      href: `/clients/invoicing`,
    }))

    return {
      count,
      summary: `${count} invoice${count === 1 ? "" : "s"} lagged > ${warnDays}d (mean ${meanLag.toFixed(1)}d)`,
      drillUrl: "/clients/invoicing",
      items,
    }
  },
})
