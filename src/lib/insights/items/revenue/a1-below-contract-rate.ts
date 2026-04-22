import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"
import { formatShortMoney } from "@/lib/dashboard/queries"

type RateRow = {
  contractId: string
  guardType: string
  rate: number
  isCurrentRate: boolean
  rateStartDate: Date | null
  rateEndDate: Date | null
}

function normalizeType(t: string | null | undefined): string {
  return (t || "").trim().toUpperCase()
}

registerInsight({
  key: "below-contract-rate",
  title: "A1 — Deployments billed below contract rate",
  description:
    "Active deployments whose billing rate is below the matching contract rate card. Estimated monthly revenue loss.",
  category: "EFFICIENCY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    minDeviationPct: 1,
  },
  thresholdDocs: {
    minDeviationPct: "Only flag deployments whose rate is ≥ this % below the contract rate.",
  },
  compute: async (ctx) => {
    const minDeviationPct = Number(ctx.thresholds.minDeviationPct ?? 1)

    const clientWhere = {
      ...buildManagerScopeWhere(ctx.scope, { regionId: "regionId", regionalOfficeId: "regionalOfficeId" }),
    }

    // Load active client contracts with rates, scoped by client region if applicable.
    const contracts = await ctx.prisma.clientContract.findMany({
      where: {
        isActive: true,
        client: Object.keys(clientWhere).length > 0 ? clientWhere : undefined,
      },
      select: {
        id: true,
        clientId: true,
        rates: {
          select: {
            contractId: true,
            guardType: true,
            rate: true,
            isCurrentRate: true,
            rateStartDate: true,
            rateEndDate: true,
          },
        },
      },
    })

    // Build: clientId -> guardType(UPPER) -> best (highest) current rate
    const bestRateByClientType = new Map<string, Map<string, number>>()
    const now = ctx.now
    for (const c of contracts) {
      for (const r of c.rates as RateRow[]) {
        const startOk = !r.rateStartDate || r.rateStartDate <= now
        const endOk = !r.rateEndDate || r.rateEndDate >= now
        if (!r.isCurrentRate && !(startOk && endOk)) continue
        const key = normalizeType(r.guardType)
        if (!key) continue
        let inner = bestRateByClientType.get(c.clientId)
        if (!inner) {
          inner = new Map()
          bestRateByClientType.set(c.clientId, inner)
        }
        const existing = inner.get(key) ?? 0
        if (r.rate > existing) inner.set(key, r.rate)
      }
    }

    if (bestRateByClientType.size === 0) {
      return { count: 0, summary: "No issues" }
    }

    const deployments = await ctx.prisma.deployment.findMany({
      where: {
        status: "ACTIVE",
        clientId: { in: Array.from(bestRateByClientType.keys()) },
        ...buildManagerScopeWhere(ctx.scope, { regionalOfficeId: "regionalOfficeId" }),
      },
      select: {
        id: true,
        clientId: true,
        guardType: true,
        designation: true,
        rate: true,
        client: { select: { name: true } },
        guard: { select: { id: true, name: true } },
      },
    })

    type Offender = {
      id: string
      clientName: string
      guardLabel: string
      deploymentRate: number
      contractRate: number
      monthlyLoss: number
    }
    const offenders: Offender[] = []
    let totalMonthlyLoss = 0

    for (const d of deployments) {
      if (d.rate == null || d.rate <= 0) continue
      const typeKey = normalizeType(d.guardType || d.designation)
      const inner = bestRateByClientType.get(d.clientId)
      if (!inner || inner.size === 0) continue
      let contractRate = inner.get(typeKey)
      // Fuzzy fallback: if exact guardType doesn't match, use the max contract rate for that client.
      if (contractRate == null) {
        contractRate = Math.max(...Array.from(inner.values()))
      }
      if (!contractRate || contractRate <= 0) continue
      const deviationPct = ((contractRate - d.rate) / contractRate) * 100
      if (deviationPct < minDeviationPct) continue
      const monthlyLoss = (contractRate - d.rate) * 30
      totalMonthlyLoss += monthlyLoss
      const guardLabel = d.guard ? d.guard.name || d.guard.id : "—"
      offenders.push({
        id: d.id,
        clientName: d.client?.name ?? "Unknown",
        guardLabel,
        deploymentRate: d.rate,
        contractRate,
        monthlyLoss,
      })
    }

    const count = offenders.length
    if (count === 0) return { count: 0, summary: "No issues" }

    offenders.sort((a, b) => b.monthlyLoss - a.monthlyLoss)
    const items = offenders.slice(0, 5).map((o) => ({
      id: o.id,
      label: `${o.clientName} — ${o.guardLabel}`,
      sub: `Billed ₨${o.deploymentRate.toFixed(0)} vs contract ₨${o.contractRate.toFixed(0)}`,
      href: `/deployments`,
      amount: o.monthlyLoss,
    }))

    const severity = totalMonthlyLoss > 500_000 ? ("HIGH" as const) : undefined

    return {
      count,
      amount: totalMonthlyLoss,
      summary: `${count} deployment${count === 1 ? "" : "s"} below contract rate (~₨${formatShortMoney(totalMonthlyLoss)}/mo loss)`,
      drillUrl: "/deployments",
      items,
      severity,
    }
  },
})
