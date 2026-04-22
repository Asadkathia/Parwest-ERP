import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "short-deployments",
  title: "A15 — Short-lived deployments",
  description:
    "Deployments that ended within a few days of being created — possible onboarding mismatch.",
  category: "EFFICIENCY",
  defaultSeverity: "LOW",
  defaultThresholds: {
    threshDays: 7,
    windowDays: 30,
  },
  thresholdDocs: {
    threshDays: "Deployment counts as short-lived when endDate is within this many days of createdAt.",
    windowDays: "Only consider deployments created within this many past days.",
  },
  compute: async (ctx) => {
    const threshDays = Number(ctx.thresholds.threshDays ?? 7)
    const windowDays = Number(ctx.thresholds.windowDays ?? 30)

    const windowStart = new Date(ctx.now.getTime() - windowDays * 24 * 60 * 60 * 1000)
    const msThresh = threshDays * 24 * 60 * 60 * 1000

    const scopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionalOfficeId: "regionalOfficeId",
    })

    // Prisma can't express endDate < createdAt + N days directly in a simple filter,
    // so fetch candidates (endDate NOT NULL within the window) and filter in-memory.
    const candidates = await ctx.prisma.deployment.findMany({
      where: {
        ...scopeWhere,
        endDate: { not: null },
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        endDate: true,
        guard: { select: { id: true, name: true, parwestId: true } },
        client: { select: { id: true, name: true } },
      },
    })

    const shorts = candidates.filter(
      (d) => d.endDate && d.endDate.getTime() - d.createdAt.getTime() < msThresh
    )

    const count = shorts.length
    if (count === 0) {
      return { count: 0, summary: "No short-lived deployments in window." }
    }

    const items = shorts.slice(0, 5).map((d) => {
      const days = Math.max(
        0,
        Math.floor(((d.endDate as Date).getTime() - d.createdAt.getTime()) / (24 * 60 * 60 * 1000))
      )
      return {
        id: d.id,
        label: `${d.guard?.name ?? "?"} @ ${d.client?.name ?? "?"}`,
        sub: `lifespan ${days}d`,
        href: "/deployments",
      }
    })

    return {
      count,
      summary: `${count} deployment${count === 1 ? "" : "s"} ended < ${threshDays}d after start (last ${windowDays}d).`,
      drillUrl: "/deployments",
      items,
    }
  },
})
