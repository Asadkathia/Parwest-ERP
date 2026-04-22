import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "salary-override",
  title: "B12 — Salary override",
  description:
    "Current-month payrolls whose netSalary deviates from the expected (deploymentDays/30 × baseSalary) baseline.",
  category: "ANOMALY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    deviationPct: 0.2,
    criticalDeviationPct: 0.5,
  },
  thresholdDocs: {
    deviationPct:
      "Fractional deviation between expected and actual netSalary above which a row is flagged (0.2 = 20%).",
    criticalDeviationPct:
      "If any single row deviates by more than this fraction, escalate severity to HIGH (0.5 = 50%).",
  },
  compute: async (ctx) => {
    const deviationPct = Number(ctx.thresholds.deviationPct ?? 0.2)
    const criticalDeviationPct = Number(ctx.thresholds.criticalDeviationPct ?? 0.5)

    const now = ctx.now
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const payrolls = await ctx.prisma.payroll.findMany({
      where: {
        month: { gte: monthStart, lt: monthEnd },
        ...buildManagerScopeWhere(ctx.scope, {
          regionId: "regionId",
          regionalOfficeId: "regionalOfficeId",
        }),
      },
      select: {
        id: true,
        guardId: true,
        deploymentDays: true,
        baseSalary: true,
        netSalary: true,
        guard: { select: { id: true, name: true } },
      },
    })

    type Offender = {
      id: string
      guardId: string
      guardName: string
      expected: number
      actual: number
      deviation: number
    }
    const offenders: Offender[] = []
    let maxDeviation = 0

    for (const p of payrolls) {
      if (!p.deploymentDays || p.deploymentDays === 0) continue
      if (!p.baseSalary || p.baseSalary === 0) continue
      const expected = (p.deploymentDays / 30) * p.baseSalary
      if (expected <= 0) continue
      const deviation = Math.abs(p.netSalary - expected) / expected
      if (deviation < deviationPct) continue
      if (deviation > maxDeviation) maxDeviation = deviation
      offenders.push({
        id: p.id,
        guardId: p.guardId,
        guardName: p.guard?.name ?? "Unknown",
        expected,
        actual: p.netSalary,
        deviation,
      })
    }

    const count = offenders.length
    if (count === 0) return { count: 0, summary: "No issues" }

    offenders.sort((a, b) => b.deviation - a.deviation)
    const items = offenders.slice(0, 5).map((o) => ({
      id: o.id,
      label: o.guardName,
      sub: `Expected ₨${o.expected.toFixed(0)} vs actual ₨${o.actual.toFixed(0)} (${(o.deviation * 100).toFixed(0)}%)`,
      href: `/guards/${o.guardId}`,
      amount: o.actual - o.expected,
    }))

    const severity = maxDeviation > criticalDeviationPct ? ("HIGH" as const) : undefined

    return {
      count,
      summary: `${count} payroll${count === 1 ? "" : "s"} deviate from expected by >${(deviationPct * 100).toFixed(0)}%`,
      drillUrl: "/payroll",
      items,
      severity,
    }
  },
})
