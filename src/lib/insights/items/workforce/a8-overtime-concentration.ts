import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "overtime-concentration",
  title: "A8 — Overtime concentration",
  description:
    "Current-month payroll rows ranked by overtime hours — flags guards whose OT exceeds the configured threshold.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    hoursThreshold: 40,
    criticalHours: 80,
  },
  thresholdDocs: {
    hoursThreshold: "Overtime hours above which a guard is counted as concentrated.",
    criticalHours: "If any single guard exceeds this, severity is bumped to HIGH.",
  },
  compute: async (ctx) => {
    const hoursThreshold = Number(ctx.thresholds.hoursThreshold ?? 40)
    const criticalHours = Number(ctx.thresholds.criticalHours ?? 80)

    const monthStart = new Date(ctx.now.getFullYear(), ctx.now.getMonth(), 1)
    const nextMonth = new Date(ctx.now.getFullYear(), ctx.now.getMonth() + 1, 1)

    const guardScopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const where = {
      month: { gte: monthStart, lt: nextMonth },
      ...(Object.keys(guardScopeWhere).length > 0 ? { guard: { is: guardScopeWhere } } : {}),
    }

    const top = await ctx.prisma.payroll.findMany({
      where,
      orderBy: { overtimeHours: "desc" },
      take: 10,
      select: {
        id: true,
        overtimeHours: true,
        guard: { select: { id: true, name: true, parwestId: true } },
      },
    })

    const overThreshold = top.filter((p) => (p.overtimeHours ?? 0) > hoursThreshold)
    const count = overThreshold.length
    const maxHours = top[0]?.overtimeHours ?? 0

    if (count === 0) {
      return { count: 0, summary: `No guards over ${hoursThreshold} OT hours this month.` }
    }

    const items = overThreshold.slice(0, 5).map((p) => ({
      id: p.guard.id,
      label: p.guard.name,
      sub: `${p.guard.parwestId} · ${p.overtimeHours.toFixed(1)} OT hrs`,
      href: `/guards/${p.guard.id}`,
      amount: p.overtimeHours,
    }))

    return {
      count,
      summary: `${count} guard${count === 1 ? "" : "s"} over ${hoursThreshold} OT hrs (peak ${maxHours.toFixed(1)}).`,
      drillUrl: "/payroll",
      items,
      severity: maxHours > criticalHours ? "HIGH" : undefined,
    }
  },
})
