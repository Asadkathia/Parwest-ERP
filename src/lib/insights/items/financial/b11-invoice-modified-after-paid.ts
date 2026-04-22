import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "invoice-modified-after-paid",
  title: "B11 — Invoice modified after paid",
  description:
    "Paid invoices whose row was updated more than the grace window after payment — possible retroactive edit.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    graceSeconds: 10,
  },
  thresholdDocs: {
    graceSeconds:
      "Seconds of slack allowed between paidAt and updatedAt to account for the mark-as-paid action itself.",
  },
  compute: async (ctx) => {
    const graceSeconds = Number(ctx.thresholds.graceSeconds ?? 10)

    const paidInvoices = await ctx.prisma.invoice.findMany({
      where: { paidAt: { not: null } },
      select: {
        id: true,
        invoiceNumber: true,
        paidAt: true,
        updatedAt: true,
        client: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    })

    const offenders = paidInvoices.filter((inv) => {
      if (!inv.paidAt) return false
      const diffSec = (inv.updatedAt.getTime() - inv.paidAt.getTime()) / 1000
      return diffSec > graceSeconds
    })

    const count = offenders.length
    if (count === 0) return { count: 0, summary: "No issues" }

    const items = offenders.slice(0, 5).map((inv) => {
      const diffSec = Math.floor(
        (inv.updatedAt.getTime() - (inv.paidAt as Date).getTime()) / 1000
      )
      const human =
        diffSec < 60
          ? `${diffSec}s after paid`
          : diffSec < 3600
          ? `${Math.floor(diffSec / 60)}m after paid`
          : diffSec < 86400
          ? `${Math.floor(diffSec / 3600)}h after paid`
          : `${Math.floor(diffSec / 86400)}d after paid`
      return {
        id: inv.id,
        label: `${inv.client?.name ?? "Unknown"} — ${inv.invoiceNumber}`,
        sub: human,
        href: "/clients/invoicing",
        amount: null,
      }
    })

    return {
      count,
      summary: `${count} paid invoice${count === 1 ? "" : "s"} modified after payment`,
      drillUrl: "/clients/invoicing",
      items,
    }
  },
})
