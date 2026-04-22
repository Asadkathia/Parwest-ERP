import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "guard-churn",
  title: "A9 — Guard churn",
  description:
    "Termination rate over the configured window (terminations / avg active headcount), broken down by termination reason.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    windowDays: 90,
    warnRate: 15,
  },
  thresholdDocs: {
    windowDays: "Trailing window, in days, over which churn is measured.",
    warnRate: "Churn rate (%) above which the insight is flagged as a concern.",
  },
  compute: async (ctx) => {
    const windowDays = Number(ctx.thresholds.windowDays ?? 90)
    const warnRate = Number(ctx.thresholds.warnRate ?? 15)
    const windowStart = new Date(ctx.now.getTime() - windowDays * 24 * 60 * 60 * 1000)

    const guardScopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const historyWhere = {
      toStatus: "TERMINATED",
      createdAt: { gte: windowStart },
      ...(Object.keys(guardScopeWhere).length > 0 ? { guard: { is: guardScopeWhere } } : {}),
    }

    // Terminations in window (distinct guards terminated)
    const terminatedEvents = await ctx.prisma.guardStatusHistory.findMany({
      where: historyWhere as never,
      select: { guardId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    const terminatedGuardIds = Array.from(new Set(terminatedEvents.map((e) => e.guardId)))
    const terminationCount = terminatedGuardIds.length

    // Active headcount (current) — approximate "average" as current active count
    const activeHeadcount = await ctx.prisma.guard.count({
      where: { ...guardScopeWhere, lifecycleStatus: "ACTIVE" },
    })

    const denominator = activeHeadcount + terminationCount
    const churnRate = denominator > 0 ? (terminationCount / denominator) * 100 : 0

    if (terminationCount === 0) {
      return { count: 0, summary: `No terminations in the last ${windowDays} days.` }
    }

    // Breakdown by terminationReason via Guard.terminationReason
    const terminatedGuards = await ctx.prisma.guard.findMany({
      where: { id: { in: terminatedGuardIds } },
      select: { id: true, name: true, parwestId: true, terminationReason: true },
    })

    const reasonCounts = new Map<string, number>()
    for (const g of terminatedGuards) {
      const reason = g.terminationReason || "UNSPECIFIED"
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
    }

    const items = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, n]) => ({
        id: reason,
        label: reason,
        sub: `${n} guard${n === 1 ? "" : "s"}`,
        href: "/guards/blacklist",
        amount: n,
      }))

    const severity: "HIGH" | undefined = churnRate > warnRate ? "HIGH" : undefined

    return {
      count: terminationCount,
      summary: `${terminationCount} termination${terminationCount === 1 ? "" : "s"} in ${windowDays}d (${churnRate.toFixed(1)}% churn).`,
      drillUrl: "/guards/blacklist",
      items,
      severity,
    }
  },
})
