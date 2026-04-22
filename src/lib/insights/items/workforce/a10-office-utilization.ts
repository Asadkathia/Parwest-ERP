import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "office-utilization",
  title: "A10 — Office utilization",
  description:
    "Per regional office, the ratio of guards with an active deployment vs. active headcount. Flags under-utilized offices.",
  category: "EFFICIENCY",
  defaultSeverity: "MEDIUM",
  defaultThresholds: {
    minUtilization: 0.7,
  },
  thresholdDocs: {
    minUtilization: "Utilization floor (0–1). Offices below this are surfaced as under-utilized.",
  },
  compute: async (ctx) => {
    const minUtilization = Number(ctx.thresholds.minUtilization ?? 0.7)

    const officeScopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "id",
    })
    const guardScopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const offices = await ctx.prisma.regionalOffice.findMany({
      where: officeScopeWhere,
      select: { id: true, name: true },
    })

    if (offices.length === 0) {
      return { count: 0, summary: "No offices in scope." }
    }

    const rows = await Promise.all(
      offices.map(async (office) => {
        const [active, deployed] = await Promise.all([
          ctx.prisma.guard.count({
            where: {
              ...guardScopeWhere,
              regionalOfficeId: office.id,
              lifecycleStatus: "ACTIVE",
            },
          }),
          ctx.prisma.guard.count({
            where: {
              ...guardScopeWhere,
              regionalOfficeId: office.id,
              lifecycleStatus: "ACTIVE",
              deployments: { some: { status: "ACTIVE" } },
            },
          }),
        ])
        const utilization = active > 0 ? deployed / active : 0
        return { office, active, deployed, utilization }
      })
    )

    const under = rows
      .filter((r) => r.active > 0 && r.utilization < minUtilization)
      .sort((a, b) => a.utilization - b.utilization)

    const count = under.length

    if (count === 0) {
      return {
        count: 0,
        summary: `All ${rows.length} office${rows.length === 1 ? "" : "s"} at or above ${(minUtilization * 100).toFixed(0)}% utilization.`,
      }
    }

    const items = under.slice(0, 5).map((r) => ({
      id: r.office.id,
      label: r.office.name,
      sub: `${r.deployed}/${r.active} deployed · ${(r.utilization * 100).toFixed(0)}%`,
      href: "/guards",
      amount: Number((r.utilization * 100).toFixed(1)),
    }))

    return {
      count,
      summary: `${count} office${count === 1 ? "" : "s"} under ${(minUtilization * 100).toFixed(0)}% utilization.`,
      items,
    }
  },
})
