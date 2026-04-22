import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "concurrent-deployment",
  title: "B5 — Concurrent deployments",
  description:
    "Guards holding two or more ACTIVE deployments simultaneously — should be impossible per business rules.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  compute: async (ctx) => {
    const scopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionalOfficeId: "regionalOfficeId",
    })

    const groups = await ctx.prisma.deployment.groupBy({
      by: ["guardId"],
      where: { status: "ACTIVE", ...scopeWhere },
      _count: { guardId: true },
      having: { guardId: { _count: { gt: 1 } } },
      orderBy: { _count: { guardId: "desc" } },
    })

    const count = groups.length
    if (count === 0) {
      return { count: 0, summary: "No guards with concurrent active deployments." }
    }

    const top = groups.slice(0, 5)
    const guards = await ctx.prisma.guard.findMany({
      where: { id: { in: top.map((g) => g.guardId) } },
      select: { id: true, name: true, parwestId: true },
    })

    const items = top.map((g) => {
      const guard = guards.find((x) => x.id === g.guardId)
      return {
        id: g.guardId,
        label: guard?.name ?? "(unknown guard)",
        sub: `${guard?.parwestId ?? ""} — ${g._count.guardId} active deployments`,
        href: `/guards/${g.guardId}`,
      }
    })

    return {
      count,
      summary: `${count} guard${count === 1 ? "" : "s"} with multiple active deployments.`,
      drillUrl: "/deployments?status=ACTIVE",
      items,
      severity: "HIGH",
    }
  },
})
