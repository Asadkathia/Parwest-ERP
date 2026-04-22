import { registerInsight } from "@/lib/insights/registry"
import { buildManagerScopeWhere } from "@/lib/access/scope"

registerInsight({
  key: "pending-enrollment-stall",
  title: "A7 — Pending enrollment stall",
  description:
    "Guards stuck in PENDING lifecycle beyond the stall window, grouped by which prerequisite documents are still blocking them.",
  category: "EFFICIENCY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    stallDays: 14,
  },
  thresholdDocs: {
    stallDays: "Number of days after createdAt before a PENDING guard is considered stalled.",
  },
  compute: async (ctx) => {
    const stallDays = Number(ctx.thresholds.stallDays ?? 14)
    const cutoff = new Date(ctx.now.getTime() - stallDays * 24 * 60 * 60 * 1000)
    const scopeWhere = buildManagerScopeWhere(ctx.scope, {
      regionId: "regionId",
      regionalOfficeId: "regionalOfficeId",
    })

    const where = {
      ...scopeWhere,
      lifecycleStatus: "PENDING",
      createdAt: { lt: cutoff },
    }

    const [count, oldest] = await Promise.all([
      ctx.prisma.guard.count({ where }),
      ctx.prisma.guard.findMany({
        where,
        select: {
          id: true,
          name: true,
          parwestId: true,
          createdAt: true,
          prerequisites: {
            where: { status: { not: "VERIFIED" } },
            select: { docTypeName: true },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
    ])

    if (count === 0) {
      return { count: 0, summary: `No PENDING guards older than ${stallDays} days.` }
    }

    const items = oldest.map((g) => {
      const blockingDocs = Array.from(new Set(g.prerequisites.map((p) => p.docTypeName)))
      const primary = blockingDocs[0] ?? "No prereq records"
      const extra = blockingDocs.length > 1 ? ` (+${blockingDocs.length - 1} more)` : ""
      return {
        id: g.id,
        label: g.name,
        sub: `${g.parwestId} · blocked by ${primary}${extra}`,
        href: `/guards/${g.id}`,
      }
    })

    return {
      count,
      summary: `${count} guard${count === 1 ? "" : "s"} stalled in PENDING > ${stallDays} days.`,
      drillUrl: "/guards?status=PENDING",
      items,
    }
  },
})
