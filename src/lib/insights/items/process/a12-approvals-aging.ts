import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "approvals-aging",
  title: "A12 — Approvals aging",
  description:
    "GuardAgeApproval rows stuck in PENDING beyond the aging threshold.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    ageDays: 7,
    criticalAgeDays: 21,
  },
  thresholdDocs: {
    ageDays: "Days a pending age approval must sit before it counts as aged.",
    criticalAgeDays: "Any pending approval older than this escalates severity to HIGH.",
  },
  compute: async (ctx) => {
    const ageDays = Number(ctx.thresholds.ageDays ?? 7)
    const criticalAgeDays = Number(ctx.thresholds.criticalAgeDays ?? 21)

    const cutoff = new Date(ctx.now.getTime() - ageDays * 24 * 60 * 60 * 1000)
    const criticalCutoff = new Date(ctx.now.getTime() - criticalAgeDays * 24 * 60 * 60 * 1000)

    const guardScope = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const where = {
      status: "PENDING",
      createdAt: { lt: cutoff },
      ...(Object.keys(guardScope).length > 0 ? { guard: guardScope } : {}),
    }

    const [count, oldest, criticalCount] = await Promise.all([
      ctx.prisma.guardAgeApproval.count({ where }),
      ctx.prisma.guardAgeApproval.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: 5,
        include: { guard: { select: { id: true, name: true, parwestId: true } } },
      }),
      ctx.prisma.guardAgeApproval.count({
        where: { ...where, createdAt: { lt: criticalCutoff } },
      }),
    ])

    if (count === 0) {
      return { count: 0, summary: "No aged pending age approvals." }
    }

    const items = oldest.map((row) => {
      const days = Math.floor((ctx.now.getTime() - row.createdAt.getTime()) / (24 * 60 * 60 * 1000))
      return {
        id: row.id,
        label: row.guard?.name ?? row.guardId,
        sub: `${row.reason} · ${days}d pending`,
        href: "/admin-approvals/guards-approval",
      }
    })

    return {
      count,
      summary: `${count} age approval${count === 1 ? "" : "s"} pending > ${ageDays}d.`,
      drillUrl: "/admin-approvals/guards-approval",
      items,
      severity: criticalCount > 0 ? "HIGH" : undefined,
    }
  },
})
