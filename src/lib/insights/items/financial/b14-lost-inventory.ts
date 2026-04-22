import { registerInsight } from "@/lib/insights/registry"

registerInsight({
  key: "lost-inventory",
  title: "B14 — Lost inventory",
  description:
    "Store inventory assignments marked LOST in the trailing window. Each lost item is a potential write-off or theft case.",
  category: "ANOMALY",
  defaultSeverity: "HIGH",
  defaultThresholds: {
    windowDays: 90,
    criticalCount: 5,
  },
  thresholdDocs: {
    windowDays: "Look-back window in days for LOST status assignments.",
    criticalCount: "Severity stays HIGH once total lost items reach this threshold.",
  },
  compute: async (ctx) => {
    const windowDays = Number(ctx.thresholds.windowDays ?? 90)
    const criticalCount = Number(ctx.thresholds.criticalCount ?? 5)
    const since = new Date(ctx.now.getTime() - windowDays * 86_400_000)

    const [total, top] = await Promise.all([
      ctx.prisma.storeInventoryAssignment.count({
        where: { status: "LOST", updatedAt: { gte: since } },
      }),
      ctx.prisma.storeInventoryAssignment.findMany({
        where: { status: "LOST", updatedAt: { gte: since } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          updatedAt: true,
          product: { select: { name: true } },
          assignedToGuard: { select: { id: true, name: true, parwestId: true } },
          assignedToUser: { select: { id: true, name: true } },
        },
      }),
    ])

    if (total === 0) {
      return { count: 0, summary: `No inventory marked LOST in the last ${windowDays} days.` }
    }

    return {
      count: total,
      summary: `${total} inventory item${total === 1 ? "" : "s"} marked LOST in the last ${windowDays} days.`,
      severity: total >= criticalCount ? "HIGH" : "MEDIUM",
      drillUrl: "/store-inventory",
      items: top.map((l) => ({
        id: l.id,
        label: l.product?.name ?? "(unknown item)",
        sub: l.assignedToGuard
          ? `${l.assignedToGuard.name} · ${l.assignedToGuard.parwestId}`
          : l.assignedToUser
          ? l.assignedToUser.name ?? "(user)"
          : "Unassigned",
        href: l.assignedToGuard ? `/guards/${l.assignedToGuard.id}` : "/store-inventory",
      })),
    }
  },
})
