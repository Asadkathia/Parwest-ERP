import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "payroll-cycle-slippage",
  title: "A11 — Payroll cycle slippage",
  description:
    "Current-month Payroll rows still below GLOBAL_FINALIZED after the cutoff day of the month.",
  category: "EFFICIENCY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    cutoffDayOfMonth: 10,
  },
  thresholdDocs: {
    cutoffDayOfMonth: "Day of month after which unfinalized payroll is considered slipping.",
  },
  compute: async (ctx) => {
    const cutoff = Number(ctx.thresholds.cutoffDayOfMonth ?? 10)
    const dayOfMonth = ctx.now.getUTCDate()

    const monthStart = new Date(Date.UTC(ctx.now.getUTCFullYear(), ctx.now.getUTCMonth(), 1))

    const scopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const where = {
      ...scopeWhere,
      month: monthStart,
      state: { not: "GLOBAL_FINALIZED" },
    }

    if (dayOfMonth <= cutoff) {
      // Not yet past cutoff — nothing to flag.
      const total = await ctx.prisma.payroll.count({ where: { ...scopeWhere, month: monthStart } })
      return {
        count: 0,
        summary:
          total === 0
            ? "No payroll rows for current month yet."
            : `Within cutoff window (day ${dayOfMonth}/${cutoff}); no slippage flagged.`,
      }
    }

    const [count, byRegion] = await Promise.all([
      ctx.prisma.payroll.count({ where }),
      ctx.prisma.payroll.groupBy({
        by: ["regionId"],
        where,
        _count: { _all: true },
        orderBy: { _count: { regionId: "desc" } },
        take: 5,
      }),
    ])

    if (count === 0) {
      return { count: 0, summary: "All current-month payrolls globally finalized." }
    }

    const regionIds = byRegion.map((r) => r.regionId).filter((id): id is string => !!id)
    const regions = regionIds.length
      ? await ctx.prisma.region.findMany({ where: { id: { in: regionIds } }, select: { id: true, name: true } })
      : []
    const regionNameMap = new Map(regions.map((r) => [r.id, r.name]))

    const items = byRegion.map((row) => ({
      id: row.regionId ?? "no-region",
      label: row.regionId ? (regionNameMap.get(row.regionId) ?? `Region ${row.regionId}`) : "No region assigned",
      sub: `${row._count._all} payroll${row._count._all === 1 ? "" : "s"} pending finalization`,
      href: "/payroll",
    }))

    return {
      count,
      summary: `${count} payroll row${count === 1 ? "" : "s"} still below GLOBAL_FINALIZED (day ${dayOfMonth} > cutoff ${cutoff}).`,
      drillUrl: "/payroll",
      items,
    }
  },
})
