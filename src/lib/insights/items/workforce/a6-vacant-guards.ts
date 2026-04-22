import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "vacant-guards",
  title: "A6 — Vacant guards",
  description:
    "Guards whose lifecycleStatus is ACTIVE but who have no ACTIVE deployment — billable headcount sitting idle.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    highCount: 50,
  },
  thresholdDocs: {
    highCount: "Bump severity to HIGH when vacant-guard count exceeds this number.",
  },
  compute: async (ctx) => {
    const highCount = Number(ctx.thresholds.highCount ?? 50)
    const scopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const where = {
      ...scopeWhere,
      lifecycleStatus: "ACTIVE",
      deployments: { none: { status: "ACTIVE" } },
    }

    const [count, top] = await Promise.all([
      ctx.prisma.guard.count({ where }),
      ctx.prisma.guard.findMany({
        where,
        select: { id: true, name: true, parwestId: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ])

    if (count === 0) {
      return { count: 0, summary: "No vacant active guards." }
    }

    const items = top.map((g) => ({
      id: g.id,
      label: g.name,
      sub: g.parwestId,
      href: `/guards/${g.id}`,
    }))

    return {
      count,
      summary: `${count} active guard${count === 1 ? "" : "s"} with no active deployment.`,
      drillUrl: "/guards?status=ACTIVE",
      items,
      severity: count > highCount ? "HIGH" : undefined,
    }
  },
})
