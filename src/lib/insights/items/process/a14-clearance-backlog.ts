import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "clearance-backlog",
  title: "A14 — Clearance backlog",
  description:
    "INACTIVE/TERMINATED guards still holding assigned inventory or pledged documents.",
  category: "EFFICIENCY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    highCount: 20,
  },
  thresholdDocs: {
    highCount: "Bump severity to HIGH when backlog exceeds this count.",
  },
  compute: async (ctx) => {
    const highCount = Number(ctx.thresholds.highCount ?? 20)
    const scopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const where = {
      ...scopeWhere,
      lifecycleStatus: { in: ["INACTIVE", "TERMINATED"] },
      OR: [
        { storeInventoryAssignments: { some: { status: "ASSIGNED" as const } } },
        { pledgedDocumentRecords: { some: { status: "HELD" } } },
      ],
    }

    const [count, top] = await Promise.all([
      ctx.prisma.guard.count({ where }),
      ctx.prisma.guard.findMany({
        where,
        orderBy: { lifecycleStatusUpdatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          parwestId: true,
          lifecycleStatus: true,
          storeInventoryAssignments: {
            where: { status: "ASSIGNED" as const },
            select: { id: true },
          },
          pledgedDocumentRecords: {
            where: { status: "HELD" },
            select: { id: true },
          },
        },
      }),
    ])

    if (count === 0) {
      return { count: 0, summary: "No clearance backlog." }
    }

    const items = top.map((g) => {
      const inv = g.storeInventoryAssignments.length
      const pdr = g.pledgedDocumentRecords.length
      const parts: string[] = []
      if (inv > 0) parts.push(`${inv} inventory item${inv === 1 ? "" : "s"}`)
      if (pdr > 0) parts.push(`${pdr} pledged doc${pdr === 1 ? "" : "s"}`)
      return {
        id: g.id,
        label: `${g.name} (${g.parwestId})`,
        sub: `${g.lifecycleStatus} · holding ${parts.join(" + ")}`,
        href: `/guards/${g.id}`,
      }
    })

    return {
      count,
      summary: `${count} inactive/terminated guard${count === 1 ? "" : "s"} still holding assets.`,
      drillUrl: "/guards",
      items,
      severity: count > highCount ? "HIGH" : undefined,
    }
  },
})
