import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "payrolled-without-deployment",
  title: "B3 — Payrolled without deployment",
  description:
    "Payroll rows in the current month with net salary paid out but zero deployment days — classic ghost-payee pattern.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    minNetSalary: 1,
  },
  thresholdDocs: {
    minNetSalary: "Ignore payroll rows whose netSalary is at or below this amount (trivial payouts).",
  },
  compute: async (ctx) => {
    const minNetSalary = Number(ctx.thresholds.minNetSalary ?? 1)
    const scopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const monthStart = new Date(ctx.now.getFullYear(), ctx.now.getMonth(), 1)
    const monthEnd = new Date(ctx.now.getFullYear(), ctx.now.getMonth() + 1, 1)

    const where = {
      ...scopeWhere,
      month: { gte: monthStart, lt: monthEnd },
      deploymentDays: 0,
      netSalary: { gt: minNetSalary },
    }

    const [count, top] = await Promise.all([
      ctx.prisma.payroll.count({ where }),
      ctx.prisma.payroll.findMany({
        where,
        select: {
          id: true,
          netSalary: true,
          guard: { select: { id: true, name: true, parwestId: true } },
        },
        orderBy: { netSalary: "desc" },
        take: 5,
      }),
    ])

    if (count === 0) {
      return { count: 0, summary: "No payrolled-without-deployment rows this month." }
    }

    const items = top.map((p) => ({
      id: p.id,
      label: p.guard?.name ?? "(unknown)",
      sub: `${p.guard?.parwestId ?? ""} — Rs ${Math.round(p.netSalary).toLocaleString()}`,
      href: p.guard?.id ? `/guards/${p.guard.id}` : null,
      amount: p.netSalary,
    }))

    return {
      count,
      summary: `${count} payroll row${count === 1 ? "" : "s"} paid this month with zero deployment days.`,
      drillUrl: "/payroll",
      items,
      severity: "HIGH",
    }
  },
})
