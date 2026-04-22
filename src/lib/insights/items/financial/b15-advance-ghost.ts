import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "advance-ghost",
  title: "B15 — Advance ghost",
  description:
    "InvoiceAdvanceApplication rows whose cumulative `applied amount` exceeds the parent ClientAdvancePayment amount, or whose parent deposit is effectively empty. Points to over-application or a missing receipt.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    toleranceRupees: 1,
  },
  thresholdDocs: {
    toleranceRupees: "Rupee tolerance absorbed as rounding before flagging over-application.",
  },
  compute: async (ctx) => {
    const tolerance = Number(ctx.thresholds.toleranceRupees ?? 1)

    const advances = await ctx.prisma.clientAdvancePayment.findMany({
      select: {
        id: true,
        amount: true,
        appliedAmount: true,
        paymentDate: true,
        client: { select: { id: true, name: true } },
        applications: {
          select: { id: true, amount: true, invoice: { select: { invoiceNumber: true } } },
        },
      },
    })

    type Offender = {
      advanceId: string
      clientId: string
      clientName: string
      depositAmount: number
      applied: number
      overBy: number
      apps: number
    }

    const offenders: Offender[] = []
    for (const adv of advances) {
      const appliedSum = adv.applications.reduce((s, a) => s + (a.amount || 0), 0)
      const overBy = appliedSum - (adv.amount || 0)
      if (overBy > tolerance) {
        offenders.push({
          advanceId: adv.id,
          clientId: adv.client?.id ?? "",
          clientName: adv.client?.name ?? "(unknown)",
          depositAmount: adv.amount || 0,
          applied: appliedSum,
          overBy,
          apps: adv.applications.length,
        })
      }
    }

    if (offenders.length === 0) {
      return { count: 0, summary: "Every advance application is within its deposit amount." }
    }

    offenders.sort((a, b) => b.overBy - a.overBy)
    const totalOverage = offenders.reduce((s, o) => s + o.overBy, 0)

    return {
      count: offenders.length,
      amount: totalOverage,
      summary: `${offenders.length} client advance${
        offenders.length === 1 ? "" : "s"
      } over-applied by ₨ ${Math.round(totalOverage).toLocaleString()}.`,
      drillUrl: "/clients/invoicing",
      items: offenders.slice(0, 5).map((o) => ({
        id: o.advanceId,
        label: o.clientName,
        sub: `Deposit ₨ ${Math.round(o.depositAmount).toLocaleString()} · applied ₨ ${Math.round(
          o.applied
        ).toLocaleString()} (${o.apps} invoice${o.apps === 1 ? "" : "s"})`,
        href: o.clientId ? `/clients/${o.clientId}` : "/clients/invoicing",
        amount: o.overBy,
      })),
    }
  },
})
