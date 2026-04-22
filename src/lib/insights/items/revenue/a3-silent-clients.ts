import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "silent-clients",
  title: "A3 — Silent clients",
  description:
    "Clients with at least one active contract but no invoice in the configured silent window.",
  category: "EFFICIENCY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    silentDays: 30,
  },
  thresholdDocs: {
    silentDays: "Clients with no invoice created within this many days are flagged.",
  },
  compute: async (ctx) => {
    const silentDays = Number(ctx.thresholds.silentDays ?? 30)
    const cutoff = new Date(ctx.now.getTime() - silentDays * 24 * 60 * 60 * 1000)

    const clientWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const clients = await ctx.prisma.client.findMany({
      where: {
        status: "ACTIVE",
        contracts: { some: { isActive: true } },
        ...clientWhere,
      },
      select: {
        id: true,
        name: true,
        invoices: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })

    type Row = { id: string; name: string; lastInvoiceAt: Date | null; daysSince: number }
    const silent: Row[] = []
    for (const c of clients) {
      const last = c.invoices[0]?.createdAt ?? null
      if (last && last >= cutoff) continue
      const daysSince = last
        ? Math.floor((ctx.now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
        : Number.POSITIVE_INFINITY
      silent.push({ id: c.id, name: c.name, lastInvoiceAt: last, daysSince })
    }

    if (silent.length === 0) return { count: 0, summary: "No issues" }

    silent.sort((a, b) => b.daysSince - a.daysSince)
    const items = silent.slice(0, 5).map((r) => ({
      id: r.id,
      label: r.name,
      sub:
        r.lastInvoiceAt == null
          ? "Never invoiced"
          : `Last invoice ${Number.isFinite(r.daysSince) ? r.daysSince : "?"}d ago`,
      href: `/clients/${r.id}`,
    }))

    const count = silent.length
    return {
      count,
      summary: `${count} active client${count === 1 ? "" : "s"} not invoiced in ${silentDays}+ days`,
      drillUrl: "/clients/invoicing",
      items,
    }
  },
})
